//
//  Allergens.swift
//  Cappy
//
//  Curated allergen catalog + medication contraindication logic, ported from
//  app/src/lib/allergens.ts.
//

import Foundation

struct Allergen: Hashable, Identifiable {
    let key: String
    let label: String
    var id: String { key }
}

enum Allergens {
    static let catalog: [Allergen] = [
        Allergen(key: "acetaminophen", label: "Acetaminophen (Tylenol)"),
        Allergen(key: "ibuprofen", label: "Ibuprofen (Motrin / Advil)"),
        Allergen(key: "nsaid", label: "NSAIDs (general)"),
        Allergen(key: "aspirin", label: "Aspirin"),
        Allergen(key: "naproxen", label: "Naproxen (Aleve)"),
        Allergen(key: "penicillin", label: "Penicillin"),
        Allergen(key: "amoxicillin", label: "Amoxicillin"),
        Allergen(key: "cephalosporin", label: "Cephalosporins"),
        Allergen(key: "sulfa", label: "Sulfa drugs"),
        Allergen(key: "codeine", label: "Codeine"),
        Allergen(key: "erythromycin", label: "Erythromycin"),
        Allergen(key: "latex", label: "Latex"),
        Allergen(key: "peanut", label: "Peanuts"),
        Allergen(key: "tree_nut", label: "Tree nuts"),
        Allergen(key: "egg", label: "Eggs"),
        Allergen(key: "soy", label: "Soy"),
        Allergen(key: "dairy", label: "Dairy / milk"),
        Allergen(key: "dye", label: "Food dyes")
    ]

    static func search(_ query: String) -> [Allergen] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty { return catalog }
        return catalog.filter { $0.label.lowercased().contains(q) || $0.key.contains(q) }
    }

    // Allergen keys that contraindicate each antipyretic (conservative —
    // ibuprofen is blocked by any NSAID-class allergy).
    private static let blocking: [MedicationKind: [String]] = [
        .acetaminophen: ["acetaminophen"],
        .ibuprofen: ["ibuprofen", "nsaid", "aspirin", "naproxen"]
    ]

    /// True if any of the child's allergen keys contraindicate the medication.
    static func isAllergic(kind: MedicationKind, allergenKeys: [String]) -> Bool {
        let blockers = blocking[kind] ?? []
        return allergenKeys.contains(where: { blockers.contains($0) })
    }
}
