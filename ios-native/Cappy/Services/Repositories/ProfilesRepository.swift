//
//  ProfilesRepository.swift
//  Cappy
//
//  Caregiver profile (name, DOB, consent, avatar). Port of app/src/api/profiles.ts.
//

import Foundation

enum ProfilesRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    private struct DisplayNameRow: Decodable { let displayName: String? }

    static func getMyDisplayName() async throws -> String? {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else { return nil }
        let rows = try await db.from("profiles").select("display_name").eq("id", uid)
            .execute(decoding: [DisplayNameRow].self)
        return rows.first?.displayName ?? nil
    }

    static func getMyProfile() async throws -> CaregiverProfile? {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else { return nil }
        let rows = try await db.from("profiles")
            .select("display_name, first_name, last_name, date_of_birth, avatar_url, consent_version, consent_accepted_at")
            .eq("id", uid)
            .execute(decoding: [CaregiverProfile].self)
        return rows.first
    }

    static func updateMyDisplayName(_ displayName: String) async throws {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        _ = try await db.from("profiles")
            .update(["display_name": displayName.trimmingCharacters(in: .whitespaces)])
            .eq("id", uid)
            .run()
    }

    struct UpdateProfileInput {
        let firstName: String
        let lastName: String
        let dateOfBirth: String   // YYYY-MM-DD
        var consentVersion: String?
    }

    /// Save first-run identity: first/last name, DOB, denormalized display_name,
    /// and (optionally) consent acceptance.
    static func updateMyProfile(_ input: UpdateProfileInput) async throws {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        let first = input.firstName.trimmingCharacters(in: .whitespaces)
        let last = input.lastName.trimmingCharacters(in: .whitespaces)
        let displayName = [first, last].filter { !$0.isEmpty }.joined(separator: " ")

        var patch: [String: Any?] = [
            "first_name": first,
            "last_name": last,
            "date_of_birth": input.dateOfBirth,
            "display_name": displayName,
            "updated_at": Date().iso
        ]
        if let consentVersion = input.consentVersion {
            patch["consent_version"] = consentVersion
            patch["consent_accepted_at"] = Date().iso
        }
        _ = try await db.from("profiles").update(patch).eq("id", uid).run()
    }
}
