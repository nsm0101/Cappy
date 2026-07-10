//
//  RootView.swift
//  Cappy
//
//  Top-level routing gate: splash → sign-in → caregiver setup → main tabs.
//  Mirrors app/src/navigation/RootNavigator.tsx.
//

import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme

    var body: some View {
        ZStack {
            theme.tokens.bg.ignoresSafeArea()
            content
        }
    }

    @ViewBuilder private var content: some View {
        if model.isBootstrapping || (model.isSignedIn && model.profileLoading) {
            SplashView()
        } else if !model.isSignedIn {
            SignInView()
        } else if model.needsSetup {
            CaregiverSetupView()
        } else {
            MainTabView()
        }
    }
}

/// Branded loading screen: the Cappy mascot bobs on a full brand-gradient
/// field with the wordmark and three loping loading dots.
struct SplashView: View {
    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var entered = false
    @State private var bobbing = false
    @State private var dotPhase = 0

    private let dotTimer = Timer.publish(every: 0.35, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            theme.brandGradient.ignoresSafeArea()
            VStack(spacing: Space.lg) {
                Image("CappyMark")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 128, height: 128)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(.white.opacity(0.35), lineWidth: 4))
                    .cappyShadow(theme.shadow3)
                    .scaleEffect(entered || reduceMotion ? 1 : 0.5)
                    .offset(y: bobbing && !reduceMotion ? -8 : 8)

                Text("Cappy!")
                    .font(CappyFont.brandBold(FontSizeToken.displayLg))
                    .foregroundStyle(.white)

                Text("Dose tracking for the whole family")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(.white.opacity(0.85))

                HStack(spacing: 8) {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .fill(.white.opacity(dotPhase == i ? 0.95 : 0.4))
                            .frame(width: 8, height: 8)
                            .scaleEffect(dotPhase == i && !reduceMotion ? 1.3 : 1)
                    }
                }
                .padding(.top, Space.sm)
                .accessibilityLabel("Loading")
            }
            .opacity(entered || reduceMotion ? 1 : 0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) { entered = true }
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { bobbing = true }
        }
        .onReceive(dotTimer) { _ in
            withAnimation(.easeInOut(duration: 0.25)) { dotPhase = (dotPhase + 1) % 3 }
        }
    }
}
