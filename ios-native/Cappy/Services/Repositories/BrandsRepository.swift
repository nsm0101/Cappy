//
//  BrandsRepository.swift
//  Cappy
//
//  Per-family medication brand preferences. Port of app/src/api/brands.ts.
//

import Foundation

enum BrandsRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    private struct BrandPrefRow: Decodable { let generic: String; let brandKey: String }

    /// Map of generic name → chosen brand_key for a family.
    static func getFamilyBrandPrefs(familyId: String) async throws -> [String: String] {
        let rows = try await db.from("family_med_brands")
            .select("generic, brand_key")
            .eq("family_id", familyId)
            .execute(decoding: [BrandPrefRow].self)
        var map: [String: String] = [:]
        for r in rows { map[r.generic] = r.brandKey }
        return map
    }

    static func setFamilyBrand(familyId: String, generic: String, brandKey: String) async throws {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        _ = try await db.from("family_med_brands").upsert([
            "family_id": familyId,
            "generic": generic,
            "brand_key": brandKey,
            "updated_by": uid,
            "updated_at": Date().iso
        ], onConflict: "family_id,generic").run()
    }
}
