//
//  DosingRulesRepository.swift
//  Cappy
//
//  Pulls the clinical rule set down so the device can evaluate a dose without
//  the network, and so a corrected coefficient reaches families without an App
//  Store release.
//
//  ¶[0048]: the values "may originate from a clinician, manufacturer,
//  pharmacy, authoritative formulary, or configuration under appropriate
//  oversight. The system need not independently establish a clinical rule."
//  Cappy's job is to apply them faithfully and to say where they came from,
//  which is why `source` travels with every rule and is shown on the dose card.
//
//  Refresh is best-effort. A failure leaves the previous cache in place, which
//  is right: OTC dosing rules do not change weekly, and refusing to dose
//  because a background fetch failed would fail in the wrong direction.
//

import Foundation

enum DosingRulesRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    private struct PolicyRow: Decodable {
        let key: String
        let numericValue: Double
    }

    private struct VelocityRow: Decodable {
        let minAgeMonths: Double
        let maxAgeMonths: Double
        let fractionalGainPerMonth: Double
        let label: String
    }

    /// Fetch everything the offline evaluator needs, in one pass, and store it
    /// atomically. Partial rule sets are not written — a cache holding new
    /// coefficients but stale interaction rules would be worse than the old one.
    @discardableResult
    static func refresh() async -> Bool {
        do {
            async let rules = db.from("medication_dose_rules")
                .select("generic_name,min_age_months,max_age_months,dose_coefficient_mg_per_kg,fixed_dose_mg,single_dose_max_mg,min_interval_hours,rolling_window_hours,rolling_window_max_mg_per_kg,rolling_window_max_mg,rolling_window_max_doses,refuse_reason,source")
                .execute(decoding: [MedicationDoseRule].self)

            async let interactions = db.from("medication_interactions")
                .select("generic_a,generic_b,b_after_a_hours,a_after_b_hours,severity,rationale")
                .execute(decoding: [MedicationInteraction].self)

            async let contraindications = db.from("medication_contraindications")
                .select("generic_name,allergen_key")
                .execute(decoding: [MedicationContraindication].self)

            async let velocity = db.from("weight_growth_velocity")
                .select("min_age_months,max_age_months,fractional_gain_per_month,label")
                .order("min_age_months", ascending: true)
                .execute(decoding: [VelocityRow].self)

            async let policy = db.from("dosing_policy")
                .select("key,numeric_value")
                .execute(decoding: [PolicyRow].self)

            let set = try await DosingRuleSet(
                fetchedAt: Date(),
                rules: rules,
                interactions: interactions,
                contraindications: contraindications,
                growthBands: velocity.map {
                    GrowthBand(minAgeMonths: $0.minAgeMonths,
                               maxAgeMonths: $0.maxAgeMonths,
                               fractionalGainPerMonth: $0.fractionalGainPerMonth,
                               label: $0.label)
                },
                policy: Dictionary(uniqueKeysWithValues: policy.map { ($0.key, $0.numericValue) }))

            // A rule set with no rules in it is a failed fetch wearing a
            // success's clothes. Keep whatever is already cached.
            guard !set.rules.isEmpty else { return false }
            DosingRuleCache.shared.store(set)
            return true
        } catch {
            return false
        }
    }
}

/// Commissioning and re-commissioning of identifying articles (¶[0047]).
enum TagAssociationsRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    struct TagAssociation: Codable, Hashable, Identifiable {
        let id: String
        let tagUid: String
        let familyId: String
        let medicationId: String
        let bindingStrength: BindingStrength
        let isClassIdentifier: Bool
        let medicationClass: String?
        let commissioningSource: String
        let commissionedAt: String?
        let supersededAt: String?
        let retiredAt: String?
    }

    /// The association in force for a tag, or nil when the identifier has been
    /// retired and must cease to resolve.
    static func active(tagUid: String, familyId: String) async throws -> TagAssociation? {
        try await db.rpc("active_tag_association",
                         params: ["p_tag_uid": tagUid, "p_family_id": familyId])
            .execute(decoding: TagAssociation?.self)
    }

    /// Bind, or re-bind, an article to a medication. The prior association is
    /// kept as superseded rather than overwritten, so a dose logged in March
    /// still reads as a dose of whatever the token pointed at in March.
    @discardableResult
    static func commission(tagUid: String, familyId: String, medicationId: String,
                           binding: BindingStrength = .strong,
                           source: String = "manual",
                           isClassIdentifier: Bool = false,
                           medicationClass: String? = nil) async throws -> TagAssociation {
        try await db.rpc("commission_tag", params: [
            "p_tag_uid": tagUid,
            "p_family_id": familyId,
            "p_medication_id": medicationId,
            "p_binding_strength": binding.rawValue,
            "p_commissioning_source": source,
            "p_is_class_identifier": isClassIdentifier,
            "p_medication_class": medicationClass ?? NSNull()
        ]).execute(decoding: TagAssociation.self)
    }

    /// A lost or damaged article. Its identifier stops resolving; the doses
    /// logged under it stay exactly where they are.
    static func retire(tagUid: String, familyId: String, reason: String?) async throws {
        _ = try await db.rpc("retire_tag", params: [
            "p_tag_uid": tagUid,
            "p_family_id": familyId,
            "p_reason": reason ?? NSNull()
        ]).run()
    }

    static func history(tagUid: String, familyId: String) async throws -> [TagAssociation] {
        try await db.from("tag_associations").select("*")
            .eq("tag_uid", tagUid)
            .eq("family_id", familyId)
            .order("commissioned_at", ascending: false)
            .execute(decoding: [TagAssociation].self)
    }
}
