//
//  DosePill.swift
//  Cappy
//
//  The dose-safety pill — the signature Cappy UI element. Color reinforces
//  safe-vs-too-early WITHOUT implying clinical certainty; always pair with
//  DoseSafetyText. Port of app/src/components/DosePill.tsx.
//

import SwiftUI

struct DosePill: View {
    @Environment(\.theme) private var theme
    let label: String
    let status: DoseStatus
    var solid: Bool = false

    private enum Slot { case solid, fg, bg, ring }

    private func color(_ slot: Slot) -> Color {
        let t = theme.tokens
        switch status {
        case .due:
            switch slot { case .solid: return t.doseDueSolid; case .fg: return t.doseDueFg
                         case .bg: return t.doseDueBg; case .ring: return t.doseDueRing }
        case .early:
            switch slot { case .solid: return t.doseEarlySolid; case .fg: return t.doseEarlyFg
                         case .bg: return t.doseEarlyBg; case .ring: return t.doseEarlyRing }
        case .recent:
            switch slot { case .solid: return t.doseRecentSolid; case .fg: return t.doseRecentFg
                         case .bg: return t.doseRecentBg; case .ring: return t.doseRecentRing }
        case .overdue, .maxReached:
            switch slot { case .solid: return t.doseOverdueSolid; case .fg: return t.doseOverdueFg
                         case .bg: return t.doseOverdueBg; case .ring: return t.doseOverdueRing }
        case .unknown:
            switch slot { case .solid: return t.fgMuted; case .fg: return t.fg2
                         case .bg: return t.bgInset; case .ring: return t.border }
        }
    }

    var body: some View {
        let bg = solid ? color(.solid) : color(.bg)
        let fg = solid ? Color.white : color(.fg)
        let ring = solid ? Color.clear : color(.ring)
        let dot = solid ? Color.white.opacity(0.9) : color(.solid)

        HStack(spacing: 8) {
            Circle().fill(dot).frame(width: 8, height: 8)
            Text(label)
                .font(CappyFont.sansBold(FontSizeToken.sm))
                .foregroundStyle(fg)
        }
        .padding(.leading, 10)
        .padding(.trailing, 12)
        .padding(.vertical, 7)
        .background(bg)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(ring, lineWidth: solid ? 0 : 1))
        .accessibilityLabel("Dose status: \(label)")
    }
}

/// Soft, non-clinical guidance text. Always pair with a DosePill.
struct DoseSafetyText: View {
    @Environment(\.theme) private var theme
    let text: String
    var alignment: TextAlignment = .leading

    var body: some View {
        Text(text)
            .font(CappyFont.sans(FontSizeToken.xs))
            .lineSpacing(FontSizeToken.xs * 0.4)
            .foregroundStyle(theme.tokens.fg3)
            .multilineTextAlignment(alignment)
            .frame(maxWidth: alignment == .center ? .infinity : nil)
    }
}
