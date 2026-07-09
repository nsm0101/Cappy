//
//  Brands.swift
//  Cappy
//
//  Brand accent colors + at-a-glance medication identity, ported from
//  app/src/lib/brands.ts. We use brand ACCENT COLORS and NAMES only (no
//  third-party logos / trade dress — those need licensing).
//

import SwiftUI

struct Brand: Hashable {
    let key: String
    let name: String
    let accent: Color
}

enum Brands {
    private static let cappyTeal = Color(cappy: "#1FA89B")

    static let byGeneric: [MedicationKind: [Brand]] = [
        .acetaminophen: [
            Brand(key: "generic", name: "Generic", accent: cappyTeal),
            Brand(key: "tylenol", name: "Tylenol", accent: Color(cappy: "#E4002B"))
        ],
        .ibuprofen: [
            Brand(key: "generic", name: "Generic", accent: cappyTeal),
            Brand(key: "motrin", name: "Motrin", accent: Color(cappy: "#005EB8")),
            Brand(key: "advil", name: "Advil", accent: Color(cappy: "#0B3D91"))
        ]
    ]

    private static let fallback = Brand(key: "generic", name: "Generic", accent: cappyTeal)

    /// Resolve a brand for a generic + stored brand_key (defaults to Generic).
    static func brand(forGeneric genericName: String, brandKey: String?) -> Brand {
        let kind = Dosing.kind(forGeneric: genericName)
        let list = byGeneric[kind] ?? []
        return list.first(where: { $0.key == brandKey }) ?? list.first ?? fallback
    }

    static func brands(forGeneric genericName: String) -> [Brand] {
        let kind = Dosing.kind(forGeneric: genericName)
        return byGeneric[kind] ?? [fallback]
    }

    /// Stable, brand-independent visual identity so the two medications are
    /// always distinguishable at a glance.
    struct MedVisual: Hashable {
        let kind: MedicationKind
        let label: String
        let letter: String
        let systemIcon: String
        let color: Color
    }

    private static let visuals: [MedicationKind: MedVisual] = [
        .acetaminophen: MedVisual(kind: .acetaminophen, label: "Acetaminophen",
                                  letter: "A", systemIcon: "thermometer.medium",
                                  color: Color(cappy: "#E4002B")),
        .ibuprofen: MedVisual(kind: .ibuprofen, label: "Ibuprofen",
                              letter: "I", systemIcon: "flame.fill",
                              color: Color(cappy: "#0B62C4"))
    ]

    static func visual(forGeneric genericName: String) -> MedVisual {
        visuals[Dosing.kind(forGeneric: genericName)] ?? visuals[.acetaminophen]!
    }
}
