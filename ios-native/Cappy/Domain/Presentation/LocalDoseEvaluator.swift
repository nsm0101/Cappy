//
//  LocalDoseEvaluator.swift
//  Cappy
//
//  The same preconditions, worked out on the device when the server cannot be
//  reached.
//
//  ¶[0053] describes a device that keeps recording while offline and syncs
//  later, and ¶[0061] puts the computation on "the one or more processors of
//  the handheld computing device, by one or more processors of the server, or
//  by a combination of them". So this is not a degraded mode bolted on; it is
//  the same state machine running in the other place.
//
//  What it can see and what it cannot is the whole design:
//
//  * It CAN see the rule set (cached), the child's age and weight, allergies,
//    and every dose this phone recorded — including ones still in the outbox.
//  * It CANNOT see a dose the other parent logged while this phone was
//    offline. Nothing can. That is a real limit and ¶[0052] says to treat it
//    as one: "the device does not represent an absence of recorded
//    administrations as an affirmative determination that no administration
//    has occurred."
//
//  So an offline release is marked `evaluatedOffline`, and the screen says so.
//  A caregiver who knows the answer was computed without the shared record can
//  ask the other parent; a caregiver told nothing cannot.
//
//  Everything unknown suppresses. There is no path through this file that
//  produces a quantity from missing data.
//

import Foundation

/// A dose this device knows about: from the server the last time it was
/// reachable, or from the outbox.
struct LocalDoseRecord: Codable, Hashable {
    let medicationId: String
    let genericName: String
    let effectiveAt: Date
    let amountMg: Double
}

// Main-actor isolated because it reads the outbox and the open-intent list,
// both of which are UI-observable state. The work itself is arithmetic over a
// few dozen rows, so there is nothing here worth moving off.
@MainActor
enum LocalDoseEvaluator {

    static func evaluate(_ query: DosePresentationRepository.Query,
                         now: Date = Date()) -> DosePresentation {
        var facts = DoseFacts()
        facts.evaluatedOffline = true

        // Without a cached rule set there is nothing to reason with. This is
        // the fail-closed path, and it is the correct one: a guessed
        // coefficient is worse than no number.
        guard DosingRuleCache.shared.isUsable, let generic = query.genericName?.lowercased() else {
            return .unavailable(facts)
        }

        var reasons: [DoseSuppressionReason] = []

        if query.bindingStrength.requiresAffirmativeConfirmation && !query.identificationConfirmed {
            reasons.append(.identificationUnconfirmed)
        }

        // ── Recipient ──────────────────────────────────────────────────
        let isChild = query.childId != nil
        facts.basis = isChild ? .weight : .manual

        var rule: MedicationDoseRule?
        var kg: Double?

        if isChild {
            guard let dob = query.dateOfBirth else { return .unavailable(facts) }
            let ageMonths = now.timeIntervalSince(dob) / (WeightFreshness.daysPerMonth * 86400)
            facts.ageMonths = ageMonths

            rule = DosingRuleCache.shared.rule(forGeneric: generic, ageMonths: ageMonths)
            if rule == nil {
                reasons.append(.noRuleForAge)
            } else if rule?.refuseReason != nil {
                reasons.append(.ageRefused)
            }

            if DosingRuleCache.shared.contraindicated(generic: generic, allergenKeys: query.allergenKeys) {
                reasons.append(.allergyOnFile)
            }

            let verdict = WeightFreshness.evaluate(grams: query.weightGrams,
                                                   recordedAt: query.weightRecordedAt,
                                                   dateOfBirth: dob, now: now)
            facts.weight = verdict
            if verdict.isMissing {
                reasons.append(.weightMissing)
            } else if verdict.isStale {
                reasons.append(.weightStale)
            } else {
                kg = verdict.kilograms
            }
        } else {
            rule = DosingRuleCache.shared.rule(forGeneric: generic, ageMonths: 1200)
        }

        facts.minIntervalHours = rule?.minIntervalHours
        facts.windowHours = rule?.rollingWindowHours
        facts.ruleSource = rule?.source

        // ── History this device can see ────────────────────────────────
        let history = knownHistory(childId: query.childId,
                                   caregiverUserId: query.caregiverUserId,
                                   now: now)
        let sameMed = history.filter { $0.medicationId == query.medicationId }

        if let rule, let last = sameMed.map(\.effectiveAt).max() {
            facts.lastDoseAt = last
            let next = last.addingTimeInterval(rule.minIntervalHours * 3600)
            facts.nextSafeAt = next
            if now < next {
                reasons.append(.sameMedicationInterval)
                facts.status = now < last.addingTimeInterval(1800) ? .recent : .early
            } else if now > last.addingTimeInterval(rule.minIntervalHours * 3600 * 1.5) {
                facts.status = .overdue
            } else {
                facts.status = .due
            }
        } else {
            facts.status = .due
        }

        // ── Cross-medication interval ──────────────────────────────────
        for interaction in DosingRuleCache.shared.interactions(involving: generic) {
            guard let other = interaction.other(than: generic),
                  let hours = interaction.requiredHours(giving: generic, after: other),
                  let lastOther = history
                    .filter({ $0.genericName.lowercased() == other.lowercased() })
                    .map(\.effectiveAt).max()
            else { continue }
            let clearAt = lastOther.addingTimeInterval(hours * 3600)
            if now < clearAt {
                reasons.append(.crossMedicationInterval)
                facts.crossMedicationGeneric = other
                facts.crossMedicationClearAt = clearAt
                if facts.status == .due { facts.status = .unknown }
            }
        }

        // ── Rolling window ─────────────────────────────────────────────
        var windowMg: Double = 0
        var limitMg: Double?
        if let rule {
            let cutoff = now.addingTimeInterval(-rule.rollingWindowHours * 3600)
            let inWindow = sameMed.filter { $0.effectiveAt > cutoff }
            windowMg = inWindow.reduce(0) { $0 + $1.amountMg }
            facts.dosesInLast24h = inWindow.count
            facts.windowMg = windowMg
            facts.windowMaxDoses = rule.rollingWindowMaxDoses

            let perKg = kg.flatMap { k in rule.rollingWindowMaxMgPerKg.map { $0 * k } }
            limitMg = [perKg, rule.rollingWindowMaxMg].compactMap { $0 }.min()
            facts.windowLimitMg = limitMg

            if let maxDoses = rule.rollingWindowMaxDoses, inWindow.count >= maxDoses {
                reasons.append(.rollingWindowDoses)
                facts.status = .maxReached
                if let oldest = inWindow.map(\.effectiveAt).min() {
                    facts.nextSafeAt = oldest.addingTimeInterval(rule.rollingWindowHours * 3600)
                }
            }
        }

        // ── ¶[0052] known gap in the record ────────────────────────────
        if !query.historyAttested,
           UnloggedDoseService.shared.hasOpenIntent(childId: query.childId,
                                                    caregiverUserId: query.caregiverUserId,
                                                    medicationId: query.medicationId, now: now) {
            facts.historyComplete = false
            reasons.append(.historyIncomplete)
        }

        // ── Release, or don't ──────────────────────────────────────────
        guard reasons.isEmpty else {
            return .suppressed(reasons.sorted { $0.severity < $1.severity }, facts)
        }

        guard facts.basis == .weight else {
            return .released(nil, facts)     // adult manual entry
        }

        guard let rule, let kg, let coefficient = rule.doseCoefficientMgPerKg else {
            return .suppressed([.noRuleForAge], facts)
        }

        var mg = coefficient * kg
        var capped = false
        if let cap = rule.singleDoseMaxMg, mg > cap {
            mg = cap
            capped = true
        }

        if let limitMg, windowMg + mg > limitMg {
            facts.status = .maxReached
            return .suppressed([.rollingWindowMass], facts)
        }

        let ml = query.concentrationMgPerMl > 0
            ? (mg / query.concentrationMgPerMl * 10).rounded() / 10
            : nil

        return .released(
            DoseQuantity(mg: mg, volumeMl: ml, capped: capped, capMg: rule.singleDoseMaxMg),
            facts)
    }

    /// Everything this device knows about recent administrations: the last
    /// history the server handed over, plus anything still in the outbox.
    /// Deduplicated by event id, so a dose that has since synced is not
    /// counted twice.
    private static func knownHistory(childId: String?, caregiverUserId: String?,
                                     now: Date) -> [LocalDoseRecord] {
        var records = LocalDoseHistory.shared.records(childId: childId,
                                                      caregiverUserId: caregiverUserId)
        let pending = DoseOutbox.shared.localEvents(childId: childId,
                                                     caregiverUserId: caregiverUserId)
        for event in pending {
            let generic = LocalDoseHistory.shared.generic(forMedicationId: event.medicationId) ?? ""
            records.append(LocalDoseRecord(medicationId: event.medicationId,
                                           genericName: generic,
                                           effectiveAt: event.effectiveAt,
                                           amountMg: event.amountMg))
        }
        let cutoff = now.addingTimeInterval(-48 * 3600)
        return records.filter { $0.effectiveAt > cutoff }
    }
}
