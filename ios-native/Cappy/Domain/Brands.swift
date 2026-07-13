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

    // MARK: Medication card styling

    /// Colors for the med-branded dose card: a colored header band (echoing
    /// familiar children's OTC packaging so the right med is instantly
    /// recognizable at 2 AM) over a light inset panel that hosts the family
    /// member picker and dosing info. Custom palette — inspired by, not
    /// copied from, any manufacturer's artwork.
    struct MedCardStyle: Hashable {
        let displayName: String      // med name (accessibility / fallbacks)
        let band: Color              // header band background
        let bandText: Color          // logo tint + text color on the band
        let panel: Color             // light inset panel
        let uppercased: Bool         // acetaminophen band uses heavy caps
        let logoAsset: String        // "Children's …" wordmark (template image)
        let logoHeight: CGFloat      // rendered wordmark height on the band
    }

    /// Dark navy used for family member names on the dose card's light panel.
    static let doseCardName = Color(cappy: "#1D2B6E")

    private static let cardStyles: [MedicationKind: MedCardStyle] = [
        .ibuprofen: MedCardStyle(displayName: "Ibuprofen",
                                 band: Color(cappy: "#E8873A"),
                                 bandText: Color(cappy: "#1D2B6E"),
                                 panel: Color(cappy: "#F8DFC4"),
                                 uppercased: false,
                                 logoAsset: "MedLogoIbuprofen",
                                 logoHeight: 64),
        .acetaminophen: MedCardStyle(displayName: "Acetaminophen",
                                     band: Color(cappy: "#D22630"),
                                     bandText: .white,
                                     panel: Color(cappy: "#F0EAE7"),
                                     uppercased: true,
                                     logoAsset: "MedLogoAcetaminophen",
                                     logoHeight: 48)
    ]

    static func cardStyle(forGeneric genericName: String) -> MedCardStyle {
        cardStyles[Dosing.kind(forGeneric: genericName)] ?? cardStyles[.acetaminophen]!
    }
}
