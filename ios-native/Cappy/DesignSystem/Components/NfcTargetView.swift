//
//  NfcTargetView.swift
//  Cappy
//
//  Pulsing NFC tap target: two concentric rings expand and fade, with the
//  capybara mark centered. Respects Reduce Motion. Port of
//  app/src/components/NfcTarget.tsx.
//

import SwiftUI

struct NfcTargetView: View {
    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var size: CGFloat = 180
    var pulsing: Bool = true

    @State private var animate = false

    var body: some View {
        ZStack {
            Circle()
                .fill(theme.tokens.accent2Tint)
                .overlay(Circle().stroke(theme.tokens.nfcRing, lineWidth: 1))
                .frame(width: size, height: size)

            if pulsing && !reduceMotion {
                ring(delay: 0)
                ring(delay: 1.2)
            }

            Image("CappyMark")
                .resizable()
                .scaledToFill()
                .frame(width: size * 0.7, height: size * 0.7)
                .clipShape(Circle())
        }
        .frame(width: size, height: size)
        .onAppear { animate = true }
        .accessibilityLabel("NFC tap area")
    }

    private func ring(delay: Double) -> some View {
        Circle()
            .stroke(theme.tokens.nfcRing, lineWidth: 2)
            .frame(width: size, height: size)
            .scaleEffect(animate ? 1.45 : 1)
            .opacity(animate ? 0 : 0.7)
            .animation(
                .easeOut(duration: 2.4).repeatForever(autoreverses: false).delay(delay),
                value: animate)
    }
}
