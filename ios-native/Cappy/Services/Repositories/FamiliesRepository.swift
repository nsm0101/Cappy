//
//  FamiliesRepository.swift
//  Cappy
//
//  Family + caregiver + invite operations. Port of app/src/api/families.ts.
//

import Foundation

enum FamiliesRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    /// Universal-link invite URL for a 6-digit code.
    static func inviteLink(code: String) -> String {
        "https://\(SupabaseConfig.tagUrlHost)/join/\(code)"
    }

    private struct MembershipRow: Decodable {
        let role: CaregiverRole
        let families: Family?
    }

    /// Families the signed-in user actively belongs to.
    static func listMyFamilies() async throws -> [FamilyWithRole] {
        let rows = try await db.from("family_caregivers")
            .select("role, families ( id, name, created_by, created_at, updated_at, deleted_at )")
            .eq("status", "active")
            .execute(decoding: [MembershipRow].self)
        return rows.compactMap { row in
            guard let f = row.families else { return nil }
            return FamilyWithRole(id: f.id, name: f.name, createdBy: f.createdBy,
                                  createdAt: f.createdAt, myRole: row.role)
        }
    }

    static func createFamily(name: String) async throws -> Family {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        return try await db.from("families")
            .insert(["name": name.trimmingCharacters(in: .whitespaces), "created_by": uid])
            .select().single()
            .execute(decoding: Family.self)
    }

    static func updateFamilyName(familyId: String, name: String) async throws -> Family {
        try await db.from("families")
            .update(["name": name.trimmingCharacters(in: .whitespaces)])
            .eq("id", familyId)
            .select().single()
            .execute(decoding: Family.self)
    }

    private struct CaregiverJoinRow: Decodable {
        let id: String
        let familyId: String
        let userId: String
        let role: CaregiverRole
        let status: CaregiverStatus
        let joinedAt: String?
        let expiresAt: String?
        let profiles: NestedProfile?
        struct NestedProfile: Decodable {
            let displayName: String?
            let avatarUrl: String?
            let dateOfBirth: String?
        }
    }

    static func listFamilyCaregivers(familyId: String) async throws -> [CaregiverWithProfile] {
        let rows = try await db.from("family_caregivers")
            .select("*, profiles ( display_name, avatar_url, date_of_birth )")
            .eq("family_id", familyId)
            .execute(decoding: [CaregiverJoinRow].self)
        return rows.map {
            CaregiverWithProfile(id: $0.id, familyId: $0.familyId, userId: $0.userId,
                                 role: $0.role, status: $0.status, joinedAt: $0.joinedAt,
                                 expiresAt: $0.expiresAt, displayName: $0.profiles?.displayName,
                                 avatarUrl: $0.profiles?.avatarUrl, dateOfBirth: $0.profiles?.dateOfBirth)
        }
    }

    /// Soft-revoke a caregiver (admins only — enforced by RLS).
    static func revokeCaregiver(caregiverId: String) async throws {
        let data = try await db.from("family_caregivers")
            .update(["status": "revoked", "revoked_at": Date().iso])
            .eq("id", caregiverId)
            .select("id")
            .run()
        if isEmptyArray(data) {
            throw SupabaseError(status: 403, message: "Only family admins can remove a member.")
        }
    }

    struct InviteResult: Decodable { let code: String; let expiresAt: String }

    static func createInvite(familyId: String, role: CaregiverRole, guestExpiresHours: Int?) async throws -> InviteResult {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        let code = String(Int.random(in: 100000...999999))
        let expiresAt = Date().addingTimeInterval(24 * 60 * 60).iso
        return try await db.from("invites")
            .insert([
                "family_id": familyId,
                "code": code,
                "proposed_role": role.serverValue,
                "created_by": uid,
                "expires_at": expiresAt,
                "guest_expires_hours": (role == .guestRole ? guestExpiresHours : nil)
            ])
            .select("code, expires_at").single()
            .execute(decoding: InviteResult.self)
    }

    private struct AcceptResult: Decodable { let caregiver: FamilyCaregiver }

    /// Accept an invite via the accept-invite Edge Function (atomic + no RLS
    /// read on invites needed).
    @discardableResult
    static func acceptInvite(code: String) async throws -> FamilyCaregiver {
        let result = try await SupabaseClient.shared.functions.invoke(
            "accept-invite", body: ["code": code], decoding: AcceptResult.self)
        return result.caregiver
    }

    private static func isEmptyArray(_ data: Data) -> Bool {
        guard let arr = try? JSONSerialization.jsonObject(with: data) as? [Any] else { return false }
        return arr.isEmpty
    }
}
