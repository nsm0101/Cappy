//
//  MainTabView.swift
//  Cappy
//
//  The five-tab shell (Home / Scan / Timeline / Schedule / Settings) plus
//  deep-link routing for NFC tag taps and invite links. Mirrors
//  app/src/navigation/AppNavigator.tsx.
//

import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme

    @StateObject private var router = TabRouter()
    @State private var scanTagUID: String?
    @State private var showInvite = false

    var body: some View {
        TabView(selection: $router.selection) {
            NavigationStack { HomeView() }
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(AppTab.home)

            NavigationStack { ScanView(incomingTagUID: $scanTagUID) }
                .tabItem { Label("Scan", systemImage: "wave.3.right") }
                .tag(AppTab.scan)

            NavigationStack { TimelineView() }
                .tabItem { Label("Timeline", systemImage: "clock.fill") }
                .tag(AppTab.timeline)

            NavigationStack { ScheduleView() }
                .tabItem { Label("Schedule", systemImage: "calendar") }
                .tag(AppTab.schedule)

            NavigationStack { SettingsView() }
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
                .tag(AppTab.settings)
        }
        .tint(theme.tokens.brand)
        .environmentObject(router)
        .onChange(of: model.pendingTagUID) { _, uid in
            guard let uid else { return }
            router.selection = .scan
            scanTagUID = uid
            model.pendingTagUID = nil
        }
        .onChange(of: model.pendingInviteCode) { _, code in
            if code != nil { showInvite = true }
        }
        // onChange only fires on a transition — if a cold launch (tapped
        // notification / Universal Link while the app was killed) already
        // set pendingTagUID/pendingInviteCode before this view first
        // appeared, there's no "change" to observe. Check once on appear too.
        .onAppear {
            if let uid = model.pendingTagUID {
                router.selection = .scan
                scanTagUID = uid
                model.pendingTagUID = nil
            }
            if model.pendingInviteCode != nil { showInvite = true }
        }
        .sheet(isPresented: $showInvite, onDismiss: { model.pendingInviteCode = nil }) {
            NavigationStack {
                AcceptInviteView(prefillCode: model.pendingInviteCode)
            }
        }
    }
}
