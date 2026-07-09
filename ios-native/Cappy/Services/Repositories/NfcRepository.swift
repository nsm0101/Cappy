//
//  NfcRepository.swift
//  Cappy
//
//  NFC tag resolution + medication catalog + tag registration.
//  Port of app/src/api/nfc.ts.
//

import Foundation

enum NfcRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    /// Resolve a tag UID to its full medication + family + recipients context
    /// via the nfc-resolve Edge Function. Returns nil for a 404 (unknown tag
    /// or a slug tag tapped without an active family).
    static func resolveTag(tagUid: String, activeFamilyId: String?) async throws -> ResolvedTag? {
        // Build the body explicitly so a nil familyId serializes as JSON null
        // (passing `Optional.none as Any` would crash JSONSerialization).
        var body: [String: Any] = ["tagUid": tagUid, "familyId": NSNull()]
        if let activeFamilyId { body["familyId"] = activeFamilyId }
        do {
            return try await SupabaseClient.shared.functions.invoke(
                "nfc-resolve", body: body, decoding: ResolvedTag.self)
        } catch let error as SupabaseError where error.status == 404 {
            return nil
        }
    }

    /// The medication catalog (manual dose logging without a tag).
    static func listMedications() async throws -> [Medication] {
        try await db.from("medications").select("*")
            .order("generic_name", ascending: true)
            .order("brand_name", ascending: true)
            .execute(decoding: [Medication].self)
    }

    /// Register a family-bound hardware-UID tag (admins only — RLS enforced).
    static func registerTag(tagUid: String, familyId: String, medicationId: String, label: String?) async throws {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        _ = try await db.from("nfc_tags").insert([
            "tag_uid": tagUid,
            "family_id": familyId,
            "medication_id": medicationId,
            "label": label?.trimmingCharacters(in: .whitespaces).nilIfEmpty,
            "registered_by": uid,
            "status": "active"
        ]).run()
    }
}
