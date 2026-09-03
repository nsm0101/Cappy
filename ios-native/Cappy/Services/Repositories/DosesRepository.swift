//
//  DosesRepository.swift
//  Cappy
//
//  Dose logging, history, corrections, and server-side safety status.
//  Port of app/src/api/doses.ts.
//

import Foundation

enum DosesRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    /// Embedded-relation select. Aliased so `.convertFromSnakeCase` maps each
    /// embed to a `DoseEventWithDetails` property.
    private static let detailsSelect = """
    *,\
    medication:medications(*),\
    logged_by_profile:profiles!dose_events_logged_by_fkey(display_name),\
    caregiver_recipient:profiles!dose_events_caregiver_user_id_fkey(display_name,avatar_url),\
    child:children(display_name,avatar_url)
    """

    struct LogDoseInput {
        var id: String = UUID().uuidString
        var childId: String?
        var caregiverUserId: String?
        var familyId: String
        var medicationId: String
        var givenAt: Date
        var amountMg: Double
        var amountVolumeMl: Double?
        var unitCount: Int?
        var note: String?
        /// Set when this row corrects another. Keeps the reconciler off it —
        /// a correction and its original look exactly like an offline
        /// double-log, and merging them would drop both out of the active
        /// history once the original is superseded.
        var correctsDoseEventId: String?
    }

    /// Log a dose. Idempotent on retry — a duplicate `id` (Postgres 23505) is
    /// treated as success and the existing row is returned.
    @discardableResult
    static func logDose(_ input: LogDoseInput) async throws -> DoseEvent {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        let row: [String: Any?] = [
            "id": input.id,
            "family_id": input.familyId,
            "child_id": input.childId,
            "caregiver_user_id": input.caregiverUserId,
            "medication_id": input.medicationId,
            "logged_by": uid,
            "given_at": input.givenAt.iso,
            "amount_mg": input.amountMg,
            "amount_volume_ml": input.amountVolumeMl,
            "unit_count": input.unitCount,
            "note": input.note?.trimmingCharacters(in: .whitespaces).nilIfEmpty,
            "corrects_dose_event_id": input.correctsDoseEventId
        ]
        do {
            return try await db.from("dose_events").insert(row).select().single()
                .execute(decoding: DoseEvent.self)
        } catch let error as SupabaseError where error.code == "23505" {
            // Unique-violation: the dose already exists — fetch and return it.
            return try await db.from("dose_events").select("*").eq("id", input.id).single()
                .execute(decoding: DoseEvent.self)
        }
    }

    /// Attach a symptom note to a just-logged dose. Server-enforced: only the
    /// caregiver who logged it, only within an hour of logging.
    static func setNote(doseEventId: String, note: String) async throws {
        _ = try await db.rpc("set_dose_note",
                             params: ["dose_event_uuid": doseEventId, "note_text": note]).run()
    }

    static func listDosesForChild(_ childId: String, limit: Int = 50, before: Date? = nil) async throws -> [DoseEvent] {
        let q = db.from("dose_events").select("*").eq("child_id", childId)
            .order("given_at", ascending: false).limit(limit)
        if let before { q.lt("given_at", before.iso) }
        return try await q.execute(decoding: [DoseEvent].self)
    }

    // MARK: Offline-first logging (¶[0053])

    /// Send one queued event. Called only by `DoseOutbox` — every other path
    /// goes through the outbox, so that a dose is written to durable local
    /// storage before the network is ever touched.
    ///
    /// The client-generated primary key is the idempotency mechanism: a retry
    /// after an ambiguous failure lands on the same row, and the unique
    /// violation is success.
    static func insertPending(_ event: PendingDoseEvent) async throws {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        var row = event.wireRow
        row["logged_by"] = uid
        _ = try await db.from("dose_events").insert(row).run()
    }

    /// Recent administrations for one recipient, in the shape the offline
    /// evaluator reads. Merged duplicates are excluded — ¶[0056] says a
    /// reconciled pair is one administration, and counting it twice would
    /// wrongly consume the rolling-window allowance.
    static func recentHistory(childId: String?, caregiverUserId: String?,
                              hours: Double = 48) async throws -> [LocalDoseRecord] {
        struct Row: Decodable {
            let medicationId: String
            let effectiveAt: String?
            let givenAt: String
            let amountMg: Double
            let medication: Medication?
        }
        let since = Date().addingTimeInterval(-hours * 3600).iso
        let q = db.from("dose_events")
            .select("medication_id,effective_at,given_at,amount_mg,medication:medications(*)")
            .eq("status", "active")
            .neq("reconciliation_status", "merged")
            .gt("given_at", since)
        if let childId { q.eq("child_id", childId) }
        if let caregiverUserId { q.eq("caregiver_user_id", caregiverUserId) }

        return try await q.execute(decoding: [Row].self).compactMap { row in
            guard let at = (row.effectiveAt ?? row.givenAt).flatMap(CappyTime.date(from:)) else { return nil }
            return LocalDoseRecord(
                medicationId: row.medicationId,
                genericName: (row.medication?.genericName ?? "").lowercased(),
                effectiveAt: at,
                amountMg: row.amountMg)
        }
    }

    /// Refresh the local history cache for one recipient, so the interlocks
    /// keep working the next time the network does not.
    static func refreshLocalHistory(childId: String?, caregiverUserId: String?) async {
        guard let records = try? await recentHistory(childId: childId, caregiverUserId: caregiverUserId)
        else { return }
        LocalDoseHistory.shared.replace(childId: childId, caregiverUserId: caregiverUserId, with: records)
    }

    /// Server-side dose status (compute_dose_status RPC) for a child.
    static func getDoseStatus(childId: String, medicationId: String) async throws -> DoseStatusResult {
        let rows = try await db.rpc("compute_dose_status",
                                    params: ["child_uuid": childId, "medication_uuid": medicationId])
            .execute(decoding: [DoseStatusResult].self)
        return rows.first ?? .due
    }

    static func listDosesWithDetails(forChild childId: String, limit: Int = 50) async throws -> [DoseEventWithDetails] {
        try await db.from("dose_events").select(detailsSelect)
            .eq("child_id", childId)
            .order("given_at", ascending: false).limit(limit)
            .execute(decoding: [DoseEventWithDetails].self)
    }

    static func listDosesWithDetails(forFamily familyId: String, limit: Int = 50) async throws -> [DoseEventWithDetails] {
        try await db.from("dose_events").select(detailsSelect)
            .eq("family_id", familyId)
            .order("given_at", ascending: false).limit(limit)
            .execute(decoding: [DoseEventWithDetails].self)
    }

    struct CorrectionInput {
        var childId: String
        var familyId: String
        var medicationId: String
        var givenAt: Date
        var amountMg: Double
        var amountVolumeMl: Double?
        var unitCount: Int?
        var note: String?
        /// Set when this row corrects another. Keeps the reconciler off it —
        /// a correction and its original look exactly like an offline
        /// double-log, and merging them would drop both out of the active
        /// history once the original is superseded.
        var correctsDoseEventId: String?
    }

    /// Issue a correction — a new dose row + a dose_corrections link.
    @discardableResult
    static func correctDose(originalId: String, correction: CorrectionInput, reason: String?) async throws -> (originalId: String, correctionId: String) {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        let correctionId = UUID().uuidString
        _ = try await logDose(LogDoseInput(
            id: correctionId, childId: correction.childId, familyId: correction.familyId,
            medicationId: correction.medicationId, givenAt: correction.givenAt,
            amountMg: correction.amountMg, amountVolumeMl: correction.amountVolumeMl,
            unitCount: correction.unitCount, note: correction.note,
            correctsDoseEventId: originalId))
        _ = try await db.from("dose_corrections").insert([
            "original_dose_event_id": originalId,
            "correction_dose_event_id": correctionId,
            "corrected_by": uid,
            "reason": reason?.trimmingCharacters(in: .whitespaces).nilIfEmpty
        ]).run()
        return (originalId, correctionId)
    }
}

extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
