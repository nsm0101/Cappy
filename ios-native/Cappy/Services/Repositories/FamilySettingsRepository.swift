//
//  FamilySettingsRepository.swift
//  Cappy
//
//  Family-level settings, starting with the manual-dose-log passcode.
//  The passcode is stored server-side as sha256("familyId:passcode") so
//  every caregiver's device in the family can verify it — the old local
//  Keychain copy only ever worked on the admin's own device.
//

import Foundation
import CryptoKit

enum FamilySettingsRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    private struct Row: Codable {
        var familyId: String
        var manualDosePasscodeHash: String?
    }

    static func passcodeHash(familyId: String, passcode: String) -> String {
        let digest = SHA256.hash(data: Data("\(familyId):\(passcode)".utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    /// The family's manual-dose passcode hash, or nil if no passcode is set.
    static func manualDosePasscodeHash(familyId: String) async throws -> String? {
        let rows = try await db.from("family_settings")
            .select("family_id,manual_dose_passcode_hash")
            .eq("family_id", familyId)
            .execute(decoding: [Row].self)
        return rows.first?.manualDosePasscodeHash
    }

    /// Set (or clear, with nil) the family's manual-dose passcode. Admin-only — RLS enforced.
    static func setManualDosePasscode(familyId: String, passcode: String?) async throws {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        let hash = passcode.map { passcodeHash(familyId: familyId, passcode: $0) }
        _ = try await db.from("family_settings").upsert([
            "family_id": familyId,
            "manual_dose_passcode_hash": hash,
            "updated_by": uid,
            "updated_at": Date().iso
        ], onConflict: "family_id").run()
    }
}
