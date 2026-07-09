//
//  Tokens.swift
//  Cappy
//
//  Direct Swift port of the Cappy design tokens (app/src/theme/tokens.ts).
//  When the source design system changes, mirror the change here.
//
//  Organized as:
//    - Palette:  raw color ramps (teal-500, blue-500, …)
//    - Semantic: meaning-bearing tokens (bg, fg, brand, dose-status, …)
//    - Spacing / Radii / Motion / Type scale: layout primitives
//
//  Light and dark variants live side by side; `Theme` picks one.
//

import SwiftUI

// MARK: - Palette (raw ramps — identical in light & dark)

enum Palette {
    // Teal — brand
    static let teal50 = Color(cappy: "#E8F6F2")
    static let teal100 = Color(cappy: "#C9EBE1")
    static let teal200 = Color(cappy: "#9FDDCC")
    static let teal300 = Color(cappy: "#6FCBB4")
    static let teal400 = Color(cappy: "#3FB89C")
    static let teal500 = Color(cappy: "#18A78D")
    static let teal600 = Color(cappy: "#128873")
    static let teal700 = Color(cappy: "#0E6D5C")
    static let teal800 = Color(cappy: "#0B5346")
    static let teal900 = Color(cappy: "#083E34")
    static let teal950 = Color(cappy: "#052822")

    // Blue — "log dose" accent
    static let blue50 = Color(cappy: "#EAF2FB")
    static let blue100 = Color(cappy: "#CFE2F6")
    static let blue200 = Color(cappy: "#A6C9EE")
    static let blue300 = Color(cappy: "#6FA8E0")
    static let blue400 = Color(cappy: "#3E86D2")
    static let blue500 = Color(cappy: "#1E6FC4")
    static let blue600 = Color(cappy: "#155AA6")
    static let blue700 = Color(cappy: "#114887")
    static let blue800 = Color(cappy: "#0E3A6E")
    static let blue900 = Color(cappy: "#0B2D55")

    static let mint50 = Color(cappy: "#F1F9F6")
    static let mint100 = Color(cappy: "#E8F5F1")
    static let mint200 = Color(cappy: "#D6EFE8")
    static let mint300 = Color(cappy: "#BFE4D8")
    static let mint400 = Color(cappy: "#9ED3C2")

    static let sage100 = Color(cappy: "#DDF1E6")
    static let sage300 = Color(cappy: "#8DD2AE")
    static let sage500 = Color(cappy: "#4FB088")
    static let sage600 = Color(cappy: "#2E9E6E")
    static let sage700 = Color(cappy: "#237A56")

    static let amber100 = Color(cappy: "#FCEBD2")
    static let amber300 = Color(cappy: "#F2C173")
    static let amber500 = Color(cappy: "#E89B2D")
    static let amber600 = Color(cappy: "#D97A0E")
    static let amber700 = Color(cappy: "#B05E08")

    static let coral100 = Color(cappy: "#FBE3E1")
    static let coral300 = Color(cappy: "#F2A8A2")
    static let coral500 = Color(cappy: "#E36B62")
    static let coral600 = Color(cappy: "#D84A4A")
    static let coral700 = Color(cappy: "#B43838")

    static let slate0 = Color(cappy: "#FFFFFF")
    static let slate25 = Color(cappy: "#FBFAF7")
    static let slate50 = Color(cappy: "#F7F5F0")
    static let slate100 = Color(cappy: "#EFEBE2")
    static let slate200 = Color(cappy: "#DDD8CC")
    static let slate300 = Color(cappy: "#BDB8AC")
    static let slate400 = Color(cappy: "#8F8B82")
    static let slate500 = Color(cappy: "#6A6760")
    static let slate600 = Color(cappy: "#4A4844")
    static let slate700 = Color(cappy: "#322F2C")
    static let slate800 = Color(cappy: "#1F1D1B")
    static let slate900 = Color(cappy: "#131211")

    static let cream = Color(cappy: "#FBF8F2")
    static let cream2 = Color(cappy: "#F4EFE5")
}

// MARK: - Spacing / Radii / Motion

enum Space {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let base: CGFloat = 16
    static let lg: CGFloat = 20
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
    static let xxxl: CGFloat = 40
    static let huge: CGFloat = 48
    static let giant: CGFloat = 64
    static let gutter: CGFloat = 20
    static let tapMin: CGFloat = 44
    static let tabBar: CGFloat = 84
}

enum Radius {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let base: CGFloat = 16
    static let lg: CGFloat = 24
    static let pill: CGFloat = 999
    static let sheet: CGFloat = 28
}

enum Motion {
    static let fast: Double = 0.20
    static let base: Double = 0.32
    static let slow: Double = 0.48
}

// MARK: - Type scale

enum FontSizeToken {
    static let xs: CGFloat = 12
    static let sm: CGFloat = 14
    static let smPlus: CGFloat = 15
    static let base: CGFloat = 16
    static let lg: CGFloat = 18
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    static let xxxl: CGFloat = 28
    static let display: CGFloat = 32
    static let displayLg: CGFloat = 40
    static let doseNumeral: CGFloat = 48
}

// MARK: - Semantic tokens

/// Meaning-bearing color tokens. Two instances exist: `.light` and `.dark`.
struct SemanticTokens {
    // Backgrounds
    var bg: Color
    var bgMuted: Color
    var bgCard: Color
    var bgInset: Color
    var bgTint: Color
    var bgTint2: Color
    // Foreground
    var fg: Color
    var fg1: Color
    var fg2: Color
    var fg3: Color
    var fgMuted: Color
    var fgOnBrand: Color
    // Lines
    var border: Color
    var borderStrong: Color
    var hairline: Color
    // Brand
    var brand: Color
    var brandHover: Color
    var brandPress: Color
    var brandTint: Color
    var link: Color
    // Capybara-blue accent (the "log dose" CTA)
    var accent2: Color
    var accent2Hover: Color
    var accent2Press: Color
    var accent2Tint: Color
    var accent2Fg: Color
    // Status
    var success: Color
    var warn: Color
    var error: Color
    // Focus
    var focus: Color
    var focusHalo: Color
    // Dose-safety palette
    var doseDueSolid: Color
    var doseDueFg: Color
    var doseDueBg: Color
    var doseDueRing: Color
    var doseEarlySolid: Color
    var doseEarlyFg: Color
    var doseEarlyBg: Color
    var doseEarlyRing: Color
    var doseRecentSolid: Color
    var doseRecentFg: Color
    var doseRecentBg: Color
    var doseRecentRing: Color
    var doseOverdueSolid: Color
    var doseOverdueFg: Color
    var doseOverdueBg: Color
    var doseOverdueRing: Color
    // NFC
    var nfcCore: Color
    var nfcGlow: Color
    var nfcRing: Color
    // Scrim / sheet
    var scrim: Color
    var sheetGrabber: Color
    // Shadow
    var shadow: Color
}

extension SemanticTokens {
    static let light = SemanticTokens(
        bg: Palette.cream,
        bgMuted: Palette.cream2,
        bgCard: Palette.slate0,
        bgInset: Palette.slate50,
        bgTint: Palette.mint100,
        bgTint2: Palette.mint200,
        fg: Palette.slate800,
        fg1: Palette.slate800,
        fg2: Palette.slate600,
        fg3: Palette.slate500,
        fgMuted: Palette.slate400,
        fgOnBrand: Color.white,
        border: Color(cappy: "rgba(11,30,29,0.08)"),
        borderStrong: Color(cappy: "rgba(11,30,29,0.14)"),
        hairline: Color(cappy: "rgba(11,30,29,0.06)"),
        brand: Palette.teal500,
        brandHover: Palette.teal600,
        brandPress: Palette.teal700,
        brandTint: Palette.teal50,
        link: Palette.teal600,
        accent2: Palette.blue500,
        accent2Hover: Palette.blue600,
        accent2Press: Palette.blue700,
        accent2Tint: Palette.blue50,
        accent2Fg: Color.white,
        success: Palette.sage600,
        warn: Palette.amber600,
        error: Palette.coral600,
        focus: Palette.teal500,
        focusHalo: Color(cappy: "rgba(24,167,141,0.22)"),
        doseDueSolid: Palette.teal500,
        doseDueFg: Palette.teal800,
        doseDueBg: Palette.teal50,
        doseDueRing: Color(cappy: "rgba(24,167,141,0.30)"),
        doseEarlySolid: Palette.amber600,
        doseEarlyFg: Palette.amber700,
        doseEarlyBg: Palette.amber100,
        doseEarlyRing: Color(cappy: "rgba(217,122,14,0.28)"),
        doseRecentSolid: Palette.blue500,
        doseRecentFg: Palette.blue700,
        doseRecentBg: Palette.blue50,
        doseRecentRing: Color(cappy: "rgba(30,111,196,0.26)"),
        doseOverdueSolid: Palette.coral600,
        doseOverdueFg: Palette.coral700,
        doseOverdueBg: Palette.coral100,
        doseOverdueRing: Color(cappy: "rgba(216,74,74,0.28)"),
        nfcCore: Palette.blue500,
        nfcGlow: Color(cappy: "rgba(30,111,196,0.22)"),
        nfcRing: Color(cappy: "rgba(30,111,196,0.40)"),
        scrim: Color(cappy: "rgba(8,26,24,0.42)"),
        sheetGrabber: Color(cappy: "rgba(11,30,29,0.18)"),
        shadow: Color(cappy: "#0B1E1D")
    )

    static let dark = SemanticTokens(
        bg: Color(cappy: "#0B1717"),
        bgMuted: Color(cappy: "#0F1C1B"),
        bgCard: Color(cappy: "#13201F"),
        bgInset: Color(cappy: "#1A2A29"),
        bgTint: Color(cappy: "#14302C"),
        bgTint2: Color(cappy: "#1B3F39"),
        fg: Color(cappy: "#ECECE6"),
        fg1: Color(cappy: "#ECECE6"),
        fg2: Color(cappy: "#B5B7B0"),
        fg3: Color(cappy: "#8A8C85"),
        fgMuted: Color(cappy: "#5E605A"),
        fgOnBrand: Color.white,
        border: Color(cappy: "rgba(255,255,255,0.08)"),
        borderStrong: Color(cappy: "rgba(255,255,255,0.16)"),
        hairline: Color(cappy: "rgba(255,255,255,0.05)"),
        brand: Palette.teal400,
        brandHover: Palette.teal300,
        brandPress: Palette.teal200,
        brandTint: Color(cappy: "rgba(54,169,154,0.16)"),
        link: Palette.teal300,
        accent2: Color(cappy: "#4D93DD"),
        accent2Hover: Color(cappy: "#6FA8E0"),
        accent2Press: Palette.blue200,
        accent2Tint: Color(cappy: "rgba(77,147,221,0.16)"),
        accent2Fg: Color(cappy: "#06121F"),
        success: Palette.sage500,
        warn: Palette.amber500,
        error: Palette.coral500,
        focus: Palette.teal300,
        focusHalo: Color(cappy: "rgba(111,195,179,0.25)"),
        doseDueSolid: Palette.teal400,
        doseDueFg: Color(cappy: "#8FE6CF"),
        doseDueBg: Color(cappy: "rgba(24,167,141,0.16)"),
        doseDueRing: Color(cappy: "rgba(63,184,156,0.34)"),
        doseEarlySolid: Palette.amber500,
        doseEarlyFg: Color(cappy: "#F4C173"),
        doseEarlyBg: Color(cappy: "rgba(217,122,14,0.18)"),
        doseEarlyRing: Color(cappy: "rgba(232,155,45,0.30)"),
        doseRecentSolid: Color(cappy: "#4D93DD"),
        doseRecentFg: Palette.blue200,
        doseRecentBg: Color(cappy: "rgba(77,147,221,0.16)"),
        doseRecentRing: Color(cappy: "rgba(77,147,221,0.32)"),
        doseOverdueSolid: Palette.coral500,
        doseOverdueFg: Palette.coral300,
        doseOverdueBg: Color(cappy: "rgba(216,74,74,0.18)"),
        doseOverdueRing: Color(cappy: "rgba(227,107,98,0.32)"),
        nfcCore: Color(cappy: "#4D93DD"),
        nfcGlow: Color(cappy: "rgba(77,147,221,0.26)"),
        nfcRing: Color(cappy: "rgba(77,147,221,0.46)"),
        scrim: Color(cappy: "rgba(0,0,0,0.58)"),
        sheetGrabber: Color(cappy: "rgba(255,255,255,0.22)"),
        shadow: Color.black
    )
}
