//
//  DosePresentationRepository.swift
//  Cappy
//
//  Asks the server whether a dose may be presented, and — when it cannot be
//  asked — works the same question out locally.
//
//  The server is authoritative because it is the only party that can see every
//  caregiver's doses (¶[0053] shared record). The local path exists because
//  ¶[0053] also contemplates the device being offline, and because a dosing
//  app that shows a spinner at 2 AM in a house with one bar is not a dosing
//  app.
//
//  Both paths return the same `DosePresentation`, and both fail closed: an
//  answer that could not be established is `.suppressed([.statusUnavailable])`,
//  never a dose.
//

import Foundation

@MainActor
enum DosePresentationRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    /// The wire shape of `evaluate_dose_presentation`. Deliberately private:
    /// it has a nullable `doseMg` on it, and nothing outside this file is
    /// allowed to reach for that. Callers get the enum, where a suppressed
    /// state has no quantity to reach for at all.
    private struct Row: Decodable {
        let presentation: String
        let suppressionReasons: [String]
        let status: String
        let doseBasis: String
        let doseMg: Double?
        let doseVolumeMl: Double?
        let doseCapped: Bool
        let lastDoseAt: String?
        let nextSafeAt: String?
        let dosesInLast24h: Int
        let windowHours: Double?
        let windowMg: Double?
        let windowLimitMg: Double?
        let windowMaxDoses: Int?
        let weightGrams: Int?
        let weightRecordedAt: String?
        let weightStaleAt: String?
        let weightExpectedDrift: Double?
        let ageMonths: Double?
        let minIntervalHours: Double?
        let crossMedGeneric: String?
        let crossMedClearAt: String?
        let historyComplete: Bool
        let ruleSource: String?
    }

    struct Query {
        var medicationId: String
        var childId: String?
        var caregiverUserId: String?
        var bindingStrength: BindingStrength = .strong
        var identificationConfirmed: Bool = true
        var historyAttested: Bool = false

        /// Local context the offline path needs and the server already has.
        var dateOfBirth: Date?
        var weightGrams: Int?
        var weightRecordedAt: Date?
        var allergenKeys: [String] = []
        var genericName: String?
        var concentrationMgPerMl: Double = 0
    }

    /// Evaluate, preferring the server. Any failure — offline, timeout, a
    /// server error — falls through to the local evaluator rather than
    /// throwing, because the caregiver still needs an answer and the local one
    /// is honest about being local.
    static func evaluate(_ query: Query) async -> DosePresentation {
        do {
            var params: [String: Any] = [
                "p_medication_id": query.medicationId,
                "p_binding_strength": query.bindingStrength.rawValue,
                "p_identification_confirmed": query.identificationConfirmed,
                "p_history_attested": query.historyAttested
            ]
            params["p_child_id"] = query.childId ?? NSNull()
            params["p_caregiver_user_id"] = query.caregiverUserId ?? NSNull()

            let rows = try await db.rpc("evaluate_dose_presentation", params: params)
                .execute(decoding: [Row].self)
            guard let row = rows.first else {
                return LocalDoseEvaluator.evaluate(query)
            }
            var presentation = map(row)

            // A dose recorded on this device but not yet synced is invisible to
            // the server. Fold it in before releasing anything, or a phone with
            // a pending dose would be told the interval has elapsed when it
            // has not.
            presentation = foldInPendingLocalDoses(presentation, query: query)
            return presentation
        } catch {
            return LocalDoseEvaluator.evaluate(query)
        }
    }

    private static func map(_ row: Row) -> DosePresentation {
        var facts = DoseFacts()
        facts.status = DoseStatus(rawValue: row.status) ?? .unknown
        facts.basis = DoseBasis(rawValue: row.doseBasis) ?? .none
        facts.lastDoseAt = row.lastDoseAt.flatMap(CappyTime.date(from:))
        facts.nextSafeAt = row.nextSafeAt.flatMap(CappyTime.date(from:))
        facts.dosesInLast24h = row.dosesInLast24h
        facts.windowHours = row.windowHours
        facts.windowMg = row.windowMg
        facts.windowLimitMg = row.windowLimitMg
        facts.windowMaxDoses = row.windowMaxDoses
        facts.ageMonths = row.ageMonths
        facts.minIntervalHours = row.minIntervalHours
        facts.crossMedicationGeneric = row.crossMedGeneric
        facts.crossMedicationClearAt = row.crossMedClearAt.flatMap(CappyTime.date(from:))
        facts.historyComplete = row.historyComplete
        facts.ruleSource = row.ruleSource

        let recordedAt = row.weightRecordedAt.flatMap(CappyTime.date(from:))
        facts.weight = WeightFreshness.Verdict(
            grams: row.weightGrams,
            recordedAt: recordedAt,
            ageMonthsAtRecord: nil,
            expectedDrift: row.weightExpectedDrift,
            thresholdDays: nil,
            staleAt: row.weightStaleAt.flatMap(CappyTime.date(from:)),
            isStale: row.weightGrams == nil
                || row.suppressionReasons.contains(DoseSuppressionReason.weightStale.rawValue))

        guard row.presentation == "released" else {
            let reasons = row.suppressionReasons.compactMap(DoseSuppressionReason.init(rawValue:))
            // An unrecognised reason code from a newer server must not read as
            // "no reason", which would collapse to a release.
            return .suppressed(reasons.isEmpty ? [.statusUnavailable] : reasons, facts)
        }

        guard let mg = row.doseMg else {
            // Released with no quantity is the adult manual-entry case; for a
            // weight-based recipient it would be a server bug, and the safe
            // reading of a bug is suppression.
            return facts.basis == .manual
                ? .released(nil, facts)
                : .suppressed([.statusUnavailable], facts)
        }

        return .released(
            DoseQuantity(mg: mg, volumeMl: row.doseVolumeMl, capped: row.doseCapped, capMg: nil),
            facts)
    }

    /// ¶[0051] operates on "the administration history", and a dose sitting in
    /// this device's outbox is part of that history even though the server has
    /// not seen it.
    private static func foldInPendingLocalDoses(_ presentation: DosePresentation,
                                                query: Query) -> DosePresentation {
        let pending = DoseOutbox.shared.localEvents(childId: query.childId,
                                                     caregiverUserId: query.caregiverUserId,
                                                     medicationId: query.medicationId)
        guard let latest = pending.map(\.effectiveAt).max() else { return presentation }

        var facts = presentation.facts
        // The pending dose is newer than anything the server knows about.
        guard latest > (facts.lastDoseAt ?? .distantPast) else { return presentation }

        facts.lastDoseAt = latest
        let interval = facts.minIntervalHours ?? 6
        let next = latest.addingTimeInterval(interval * 3600)
        facts.nextSafeAt = next
        facts.dosesInLast24h += pending.filter { $0.effectiveAt > Date().addingTimeInterval(-86400) }.count

        guard Date() < next else { return .released(presentation.quantity, facts) }

        facts.status = Date() < latest.addingTimeInterval(1800) ? .recent : .early
        var reasons = presentation.reasons
        if !reasons.contains(.sameMedicationInterval) { reasons.append(.sameMedicationInterval) }
        return .suppressed(reasons, facts)
    }
}
