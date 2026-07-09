//
//  AllergiesRepository.swift
//  Cappy
//
//  Per-child allergy records. Port of app/src/api/allergies.ts.
//

import Foundation

enum AllergiesRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    static func listChildAllergies(childId: String) async throws -> [ChildAllergy] {
        try await db.from("child_allergies").select("*")
            .eq("child_id", childId)
            .order("created_at", ascending: true)
            .execute(decoding: [ChildAllergy].self)
    }

    @discardableResult
    static func addChildAllergy(childId: String, allergen: String, label: String) async throws -> ChildAllergy {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        return try await db.from("child_allergies")
            .insert(["child_id": childId, "allergen": allergen, "label": label, "created_by": uid])
            .select().single()
            .execute(decoding: ChildAllergy.self)
    }

    static func removeChildAllergy(id: String) async throws {
        _ = try await db.from("child_allergies").delete().eq("id", id).run()
    }
}
