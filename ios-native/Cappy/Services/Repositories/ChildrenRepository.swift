//
//  ChildrenRepository.swift
//  Cappy
//
//  Children + weight records. Port of app/src/api/children.ts.
//

import Foundation

enum ChildrenRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    static func listChildren(inFamily familyId: String) async throws -> [Child] {
        try await db.from("children")
            .select("*")
            .eq("family_id", familyId)
            .isNull("deleted_at")
            .order("created_at", ascending: true)
            .execute(decoding: [Child].self)
    }

    static func getChild(_ childId: String) async throws -> Child {
        try await db.from("children").select("*").eq("id", childId).single()
            .execute(decoding: Child.self)
    }

    static func createChild(familyId: String, displayName: String, dateOfBirth: String) async throws -> Child {
        try await db.from("children")
            .insert([
                "family_id": familyId,
                "display_name": displayName.trimmingCharacters(in: .whitespaces),
                "date_of_birth": dateOfBirth
            ])
            .select().single()
            .execute(decoding: Child.self)
    }

    static func updateChildDetails(childId: String, displayName: String?, dateOfBirth: String?) async throws {
        var patch: [String: Any?] = ["updated_at": Date().iso]
        if let displayName { patch["display_name"] = displayName.trimmingCharacters(in: .whitespaces) }
        if let dateOfBirth { patch["date_of_birth"] = dateOfBirth }
        let data = try await db.from("children")
            .update(patch)
            .eq("id", childId)
            .isNull("deleted_at")
            .select("id")
            .run()
        if isEmptyArray(data) {
            throw SupabaseError(status: 403, message: "Only family admins can edit a child.")
        }
    }

    static func softDeleteChild(_ childId: String) async throws {
        let data = try await db.from("children")
            .update(["deleted_at": Date().iso])
            .eq("id", childId)
            .isNull("deleted_at")
            .select("id")
            .run()
        if isEmptyArray(data) {
            throw SupabaseError(status: 403, message: "Only family admins can remove a child.")
        }
    }

    // MARK: Weight

    static func recordWeight(childId: String, valueGrams: Int, recordedAt: Date = Date()) async throws {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        _ = try await db.from("weight_records")
            .insert([
                "child_id": childId,
                "value_grams": valueGrams,
                "recorded_at": recordedAt.iso,
                "recorded_by": uid
            ])
            .run()
    }

    private struct WeightValueRow: Decodable { let valueGrams: Int }

    static func getLatestWeight(childId: String) async throws -> Int? {
        let rows = try await db.from("weight_records")
            .select("value_grams")
            .eq("child_id", childId)
            .order("recorded_at", ascending: false)
            .limit(1)
            .execute(decoding: [WeightValueRow].self)
        return rows.first?.valueGrams
    }

    struct LatestWeight { let valueGrams: Int; let recordedAt: String }
    private struct WeightRecordRow: Decodable { let valueGrams: Int; let recordedAt: String }

    static func getLatestWeightRecord(childId: String) async throws -> LatestWeight? {
        let rows = try await db.from("weight_records")
            .select("value_grams, recorded_at")
            .eq("child_id", childId)
            .order("recorded_at", ascending: false)
            .limit(1)
            .execute(decoding: [WeightRecordRow].self)
        guard let r = rows.first else { return nil }
        return LatestWeight(valueGrams: r.valueGrams, recordedAt: r.recordedAt)
    }

    private static func isEmptyArray(_ data: Data) -> Bool {
        guard let arr = try? JSONSerialization.jsonObject(with: data) as? [Any] else { return false }
        return arr.isEmpty
    }
}
