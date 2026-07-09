//
//  Themes.swift
//  Cappy
//
//  The 10 selectable theme styles. `classic` follows the Light/Dark/System
//  mode with the original Cappy palette; every other style layers its own
//  background + brand + accent personality over the light or dark base.
//
//  Dose-safety colors (due / early / recent / overdue) are deliberately NOT
//  themed — their meaning must read identically in every theme.
//

import SwiftUI

enum ThemeStyle: String, CaseIterable, Identifiable {
    case classic, calm, neon, midnight, sunset, lavender, forest, ocean, rose, mono

    var id: String { rawValue }

    var label: String {
        switch self {
        case .classic: return "Classic"
        case .calm: return "Calm"
        case .neon: return "Neon"
        case .midnight: return "Midnight"
        case .sunset: return "Sunset"
        case .lavender: return "Lavender"
        case .forest: return "Forest"
        case .ocean: return "Ocean"
        case .rose: return "Rose"
        case .mono: return "Mono"
        }
    }

    var subtitle: String {
        switch self {
        case .classic: return "Cappy's signature teal & cream"
        case .calm: return "Soothing teal-blue pastels"
        case .neon: return "Electric colors on true dark"
        case .midnight: return "Deep navy & indigo"
        case .sunset: return "Warm coral & amber"
        case .lavender: return "Soft violet & periwinkle"
        case .forest: return "Deep evergreen dark"
        case .ocean: return "Fresh sea blues"
        case .rose: return "Blush & rosewood"
        case .mono: return "Minimal high-contrast ink"
        }
    }

    /// Styles with a fixed appearance. nil = follow the Light/Dark/System mode.
    var forcedScheme: ColorScheme? {
        switch self {
        case .classic: return nil
        case .neon, .midnight, .forest: return .dark
        default: return .light
        }
    }

    /// Three representative swatches for the Settings picker card.
    var swatches: [Color] {
        let t = SemanticTokens.style(self, scheme: forcedScheme ?? .light)
        return [t.bg, t.brand, t.accent2]
    }
}

extension SemanticTokens {

    /// Tokens for a theme style resolved against a color scheme.
    static func style(_ style: ThemeStyle, scheme: ColorScheme) -> SemanticTokens {
        let dark = scheme == .dark
        var t: SemanticTokens = dark ? .dark : .light

        switch style {
        case .classic:
            return t

        case .calm:
            t.bg = Color(cappy: "#F0F7F8")
            t.bgMuted = Color(cappy: "#E6F0F2")
            t.bgInset = Color(cappy: "#EAF3F4")
            t.bgTint = Color(cappy: "#DCEFF1")
            t.bgTint2 = Color(cappy: "#CDE7EA")
            t.brand = Color(cappy: "#3D9EA8")
            t.brandHover = Color(cappy: "#33878F")
            t.brandPress = Color(cappy: "#2A6F76")
            t.brandTint = Color(cappy: "#E1F2F3")
            t.link = Color(cappy: "#33878F")
            t.accent2 = Color(cappy: "#6FA8DC")
            t.accent2Hover = Color(cappy: "#5C93C7")
            t.accent2Press = Color(cappy: "#4A7FB2")
            t.accent2Tint = Color(cappy: "#E7F0F9")
            t.focus = Color(cappy: "#3D9EA8")
            t.focusHalo = Color(cappy: "rgba(61,158,168,0.20)")

        case .neon:
            t.bg = Color(cappy: "#0A0A12")
            t.bgMuted = Color(cappy: "#10101B")
            t.bgCard = Color(cappy: "#14141F")
            t.bgInset = Color(cappy: "#1B1B2A")
            t.bgTint = Color(cappy: "rgba(57,255,136,0.10)")
            t.bgTint2 = Color(cappy: "rgba(38,229,255,0.12)")
            t.brand = Color(cappy: "#39FF88")
            t.brandHover = Color(cappy: "#66FFA9")
            t.brandPress = Color(cappy: "#1FE07A")
            t.brandTint = Color(cappy: "rgba(57,255,136,0.14)")
            t.fgOnBrand = Color(cappy: "#06120B")
            t.link = Color(cappy: "#26E5FF")
            t.accent2 = Color(cappy: "#26E5FF")
            t.accent2Hover = Color(cappy: "#5FEDFF")
            t.accent2Press = Color(cappy: "#0FC7E0")
            t.accent2Tint = Color(cappy: "rgba(38,229,255,0.14)")
            t.accent2Fg = Color(cappy: "#04121A")
            t.focus = Color(cappy: "#FF4DA6")
            t.focusHalo = Color(cappy: "rgba(255,77,166,0.28)")
            t.nfcCore = Color(cappy: "#26E5FF")
            t.nfcGlow = Color(cappy: "rgba(38,229,255,0.30)")
            t.nfcRing = Color(cappy: "rgba(38,229,255,0.50)")

        case .midnight:
            t.bg = Color(cappy: "#0A1220")
            t.bgMuted = Color(cappy: "#0E1829")
            t.bgCard = Color(cappy: "#101B2E")
            t.bgInset = Color(cappy: "#16233A")
            t.bgTint = Color(cappy: "rgba(91,141,239,0.14)")
            t.bgTint2 = Color(cappy: "rgba(139,124,246,0.16)")
            t.brand = Color(cappy: "#5B8DEF")
            t.brandHover = Color(cappy: "#7CA3F2")
            t.brandPress = Color(cappy: "#4677D6")
            t.brandTint = Color(cappy: "rgba(91,141,239,0.16)")
            t.link = Color(cappy: "#7CA3F2")
            t.accent2 = Color(cappy: "#8B7CF6")
            t.accent2Hover = Color(cappy: "#A497F8")
            t.accent2Press = Color(cappy: "#7263E0")
            t.accent2Tint = Color(cappy: "rgba(139,124,246,0.16)")
            t.focus = Color(cappy: "#7CA3F2")
            t.focusHalo = Color(cappy: "rgba(91,141,239,0.26)")
            t.nfcCore = Color(cappy: "#8B7CF6")
            t.nfcGlow = Color(cappy: "rgba(139,124,246,0.26)")
            t.nfcRing = Color(cappy: "rgba(139,124,246,0.46)")

        case .sunset:
            t.bg = Color(cappy: "#FFF6EF")
            t.bgMuted = Color(cappy: "#FBEDE2")
            t.bgInset = Color(cappy: "#FCF0E6")
            t.bgTint = Color(cappy: "#FBE6D4")
            t.bgTint2 = Color(cappy: "#F8DBC2")
            t.brand = Color(cappy: "#E8703A")
            t.brandHover = Color(cappy: "#D45F2B")
            t.brandPress = Color(cappy: "#B84E20")
            t.brandTint = Color(cappy: "#FCE8DC")
            t.link = Color(cappy: "#D45F2B")
            t.accent2 = Color(cappy: "#D8536B")
            t.accent2Hover = Color(cappy: "#C24259")
            t.accent2Press = Color(cappy: "#A63348")
            t.accent2Tint = Color(cappy: "#FAE3E7")
            t.focus = Color(cappy: "#E8703A")
            t.focusHalo = Color(cappy: "rgba(232,112,58,0.22)")

        case .lavender:
            t.bg = Color(cappy: "#F7F4FB")
            t.bgMuted = Color(cappy: "#EFEAF7")
            t.bgInset = Color(cappy: "#F1EDF8")
            t.bgTint = Color(cappy: "#E9E2F5")
            t.bgTint2 = Color(cappy: "#DED3F0")
            t.brand = Color(cappy: "#8B6FC9")
            t.brandHover = Color(cappy: "#7A5DB8")
            t.brandPress = Color(cappy: "#684CA3")
            t.brandTint = Color(cappy: "#EEE8F8")
            t.link = Color(cappy: "#7A5DB8")
            t.accent2 = Color(cappy: "#6C7FD8")
            t.accent2Hover = Color(cappy: "#5A6DC4")
            t.accent2Press = Color(cappy: "#4A5BAD")
            t.accent2Tint = Color(cappy: "#E8ECF9")
            t.focus = Color(cappy: "#8B6FC9")
            t.focusHalo = Color(cappy: "rgba(139,111,201,0.22)")

        case .forest:
            t.bg = Color(cappy: "#0C1510")
            t.bgMuted = Color(cappy: "#101B15")
            t.bgCard = Color(cappy: "#142019")
            t.bgInset = Color(cappy: "#1B2A22")
            t.bgTint = Color(cappy: "rgba(79,176,136,0.14)")
            t.bgTint2 = Color(cappy: "rgba(143,191,90,0.14)")
            t.brand = Color(cappy: "#4FB088")
            t.brandHover = Color(cappy: "#6BC29D")
            t.brandPress = Color(cappy: "#3B9A72")
            t.brandTint = Color(cappy: "rgba(79,176,136,0.16)")
            t.link = Color(cappy: "#6BC29D")
            t.accent2 = Color(cappy: "#9CC069")
            t.accent2Hover = Color(cappy: "#AECD82")
            t.accent2Press = Color(cappy: "#84A854")
            t.accent2Tint = Color(cappy: "rgba(156,192,105,0.16)")
            t.accent2Fg = Color(cappy: "#0C1508")
            t.focus = Color(cappy: "#6BC29D")
            t.focusHalo = Color(cappy: "rgba(79,176,136,0.26)")
            t.nfcCore = Color(cappy: "#4FB088")
            t.nfcGlow = Color(cappy: "rgba(79,176,136,0.26)")
            t.nfcRing = Color(cappy: "rgba(79,176,136,0.46)")

        case .ocean:
            t.bg = Color(cappy: "#EFF7FA")
            t.bgMuted = Color(cappy: "#E3F0F5")
            t.bgInset = Color(cappy: "#E9F3F7")
            t.bgTint = Color(cappy: "#DBEDF4")
            t.bgTint2 = Color(cappy: "#C8E3EE")
            t.brand = Color(cappy: "#1F8FB8")
            t.brandHover = Color(cappy: "#1A7A9E")
            t.brandPress = Color(cappy: "#156585")
            t.brandTint = Color(cappy: "#E0F1F7")
            t.link = Color(cappy: "#1A7A9E")
            t.accent2 = Palette.blue500
            t.accent2Hover = Palette.blue600
            t.accent2Press = Palette.blue700
            t.accent2Tint = Palette.blue50
            t.focus = Color(cappy: "#1F8FB8")
            t.focusHalo = Color(cappy: "rgba(31,143,184,0.22)")

        case .rose:
            t.bg = Color(cappy: "#FBF2F4")
            t.bgMuted = Color(cappy: "#F7E8EC")
            t.bgInset = Color(cappy: "#F8ECEF")
            t.bgTint = Color(cappy: "#F5E0E6")
            t.bgTint2 = Color(cappy: "#EFD0DA")
            t.brand = Color(cappy: "#C9566F")
            t.brandHover = Color(cappy: "#B4455D")
            t.brandPress = Color(cappy: "#99364C")
            t.brandTint = Color(cappy: "#F8E4E9")
            t.link = Color(cappy: "#B4455D")
            t.accent2 = Color(cappy: "#9A6FB8")
            t.accent2Hover = Color(cappy: "#875DA6")
            t.accent2Press = Color(cappy: "#714B8D")
            t.accent2Tint = Color(cappy: "#F1E8F7")
            t.focus = Color(cappy: "#C9566F")
            t.focusHalo = Color(cappy: "rgba(201,86,111,0.22)")

        case .mono:
            t.bg = Color(cappy: "#F7F7F5")
            t.bgMuted = Color(cappy: "#EFEFEC")
            t.bgInset = Color(cappy: "#F1F1EE")
            t.bgTint = Color(cappy: "#E9E9E5")
            t.bgTint2 = Color(cappy: "#DEDED9")
            t.brand = Color(cappy: "#2A2A2A")
            t.brandHover = Color(cappy: "#1A1A1A")
            t.brandPress = Color(cappy: "#000000")
            t.brandTint = Color(cappy: "#EAEAE7")
            t.link = Color(cappy: "#1A1A1A")
            t.accent2 = Color(cappy: "#4A4A4A")
            t.accent2Hover = Color(cappy: "#3A3A3A")
            t.accent2Press = Color(cappy: "#2A2A2A")
            t.accent2Tint = Color(cappy: "#E5E5E2")
            t.focus = Color(cappy: "#2A2A2A")
            t.focusHalo = Color(cappy: "rgba(42,42,42,0.18)")
        }

        return t
    }
}
