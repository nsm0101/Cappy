//
//  Theme.swift
//  Cappy
//
//  Resolves the active `SemanticTokens` from the color scheme and exposes a
//  `ThemeManager` (light / dark / system, persisted). Mirrors the behaviour
//  of app/src/theme/ThemeProvider.tsx.
//

import SwiftUI

enum ThemeMode: String, CaseIterable, Identifiable {
    case light, dark, system
    var id: String { rawValue }

    /// The SwiftUI override, or nil to follow the OS.
    var colorSchemeOverride: ColorScheme? {
        switch self {
        case .light: return .light
        case .dark: return .dark
        case .system: return nil
        }
    }

    var label: String {
        switch self {
        case .light: return "Light"
        case .dark: return "Dark"
        case .system: return "System"
        }
    }
}

/// The active theme: resolved tokens + a few shadow presets.
struct Theme {
    let colorScheme: ColorScheme
    let tokens: SemanticTokens

    static func resolve(_ scheme: ColorScheme) -> Theme {
        Theme(colorScheme: scheme, tokens: scheme == .dark ? .dark : .light)
    }

    // Shadow presets (iOS uses these directly). Tinted with the brand-adjacent
    // `tokens.shadow` so elevation feels warm, not sooty.
    var shadow1: ShadowStyle { ShadowStyle(color: tokens.shadow.opacity(0.06), radius: 6, x: 0, y: 2) }
    var shadow2: ShadowStyle { ShadowStyle(color: tokens.shadow.opacity(0.10), radius: 14, x: 0, y: 5) }
    var shadow3: ShadowStyle { ShadowStyle(color: tokens.shadow.opacity(0.18), radius: 26, x: 0, y: 12) }
    /// No-op shadow for conditional application.
    var shadowNone: ShadowStyle { ShadowStyle(color: .clear, radius: 0, x: 0, y: 0) }

    /// The signature brand gradient — hero surfaces, primary CTAs, and the
    /// launch screen. Derived from the active theme's brand ramp so every
    /// theme style keeps its own personality.
    var brandGradient: LinearGradient {
        LinearGradient(colors: [tokens.brand, tokens.brandPress],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    /// Accent (blue) gradient for the "log dose" family of CTAs.
    var accentGradient: LinearGradient {
        LinearGradient(colors: [tokens.accent2, tokens.accent2Press],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

extension View {
    /// Apply a design-system shadow preset.
    func cappyShadow(_ style: ShadowStyle) -> some View {
        shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
}

// MARK: - Environment plumbing

private struct ThemeKey: EnvironmentKey {
    static let defaultValue: Theme = .resolve(.light)
}

extension EnvironmentValues {
    var theme: Theme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}

/// Reads the resolved color scheme (already reflecting any `preferredColorScheme`
/// override applied above it) and injects the matching `Theme` into the
/// environment for the whole subtree.
struct ThemeProvider<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    @ViewBuilder var content: Content

    var body: some View {
        content.environment(\.theme, Theme.resolve(scheme))
    }
}

/// Persisted appearance preferences: light/dark/system mode + theme style.
final class ThemeManager: ObservableObject {
    private static let modeKey = "cappy.themeMode"
    private static let styleKey = "cappy.themeStyle"

    @Published var mode: ThemeMode {
        didSet { UserDefaults.standard.set(mode.rawValue, forKey: Self.modeKey) }
    }

    @Published var style: ThemeStyle {
        didSet { UserDefaults.standard.set(style.rawValue, forKey: Self.styleKey) }
    }

    init() {
        let rawMode = UserDefaults.standard.string(forKey: Self.modeKey) ?? ThemeMode.system.rawValue
        self.mode = ThemeMode(rawValue: rawMode) ?? .system
        let rawStyle = UserDefaults.standard.string(forKey: Self.styleKey) ?? ThemeStyle.classic.rawValue
        self.style = ThemeStyle(rawValue: rawStyle) ?? .classic
    }

    /// The scheme forced on SwiftUI: a style with a fixed appearance wins,
    /// otherwise the Light/Dark/System mode applies.
    var schemeOverride: ColorScheme? { style.forcedScheme ?? mode.colorSchemeOverride }

    /// Resolve the active theme for the (already override-adjusted) scheme.
    func resolvedTheme(for scheme: ColorScheme) -> Theme {
        let effective = style.forcedScheme ?? scheme
        return Theme(colorScheme: effective, tokens: .style(style, scheme: effective))
    }
}
