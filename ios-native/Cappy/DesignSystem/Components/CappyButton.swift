//
//  CappyButton.swift
//  Cappy
//
//  Design-system button. Port of app/src/components/Button.tsx — variants
//  primary / blue / secondary / ghost, sizes md / lg, loading + block.
//

import SwiftUI

enum CappyButtonVariant { case primary, blue, secondary, ghost }
enum CappyButtonSize { case md, lg }

struct CappyButton: View {
    @Environment(\.theme) private var theme
    @Environment(\.isEnabled) private var isEnabled

    let label: String
    var variant: CappyButtonVariant = .primary
    var size: CappyButtonSize = .md
    var block: Bool = false
    var loading: Bool = false
    var systemIcon: String? = nil
    var action: () -> Void

    private var isLg: Bool { size == .lg }
    private var isCTA: Bool { variant == .primary || variant == .blue }

    private var background: Color {
        switch variant {
        case .primary: return theme.tokens.brand
        case .blue: return theme.tokens.accent2
        case .secondary: return theme.tokens.bgCard
        case .ghost: return .clear
        }
    }
    private var foreground: Color {
        switch variant {
        case .primary: return theme.tokens.fgOnBrand
        case .blue: return theme.tokens.accent2Fg
        case .secondary: return theme.tokens.fg1
        case .ghost: return theme.tokens.fg2
        }
    }
    private var border: Color {
        switch variant {
        case .primary: return theme.tokens.brand
        case .blue: return theme.tokens.accent2
        case .secondary: return theme.tokens.borderStrong
        case .ghost: return .clear
        }
    }

    var body: some View {
        Button(action: { if !loading { action() } }) {
            HStack(spacing: 8) {
                if loading {
                    ProgressView().tint(foreground)
                } else {
                    if let systemIcon { Image(systemName: systemIcon) }
                    Text(label)
                        .font(CappyFont.sansSemibold(isLg ? FontSizeToken.lg : FontSizeToken.base))
                        .lineLimit(1)
                }
            }
            .foregroundStyle(foreground)
            .frame(maxWidth: block ? .infinity : nil)
            .frame(minHeight: isLg ? 56 : Space.tapMin)
            .padding(.horizontal, isLg ? Space.xl : Space.lg)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: isLg ? Radius.base : Radius.md)
                    .stroke(border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: isLg ? Radius.base : Radius.md))
            .cappyShadow(isCTA && isEnabled && !loading ? theme.shadow2 : ShadowStyle(color: .clear, radius: 0, x: 0, y: 0))
        }
        .buttonStyle(PressableButtonStyle())
        .opacity(isEnabled && !loading ? 1 : 0.5)
        .disabled(!isEnabled || loading)
        .accessibilityLabel(label)
    }
}

/// Subtle press feedback matching the RN button (opacity + 1px translate).
struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.88 : 1)
            .offset(y: configuration.isPressed ? 1 : 0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
