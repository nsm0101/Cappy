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

struct SplashView: View {
    @Environment(\.theme) private var theme
    var body: some View {
        VStack(spacing: Space.xl) {
            Wordmark(size: 34)
            ProgressView().tint(theme.tokens.brand)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.tokens.bg)
    }
}
