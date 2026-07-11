//
//  MainTabView.swift
//  Cappy
//
//  The five-tab shell (Home / Scan / Timeline / Schedule / Settings) plus
//  deep-link routing for NFC tag taps and invite links. Mirrors
//  app/src/navigation/AppNavigator.tsx.
//
//  Tag deep links (NFC banner tap, Universal Link, QR from another app,
//  notification tap) present the med-branded dose card as a GLOBAL pop-up
//  over whatever screen is active — no tab switch, no navigation. The Scan
//  tab keeps its own local presentation for scans started inside it; both
//  paths show the exact same DoseSheetView card.
//

import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme

    @StateObject private var router = TabRouter()
    @State private var showInvite = false

    // Global dose pop-up state (deep-linked tags).
    @State private var resolvedBox: ResolvedTagBox?
    @State private var resolvingTag = false
    @State private var tagAlert: CappyAlert?

    var body: some View {
        TabView(selection: $router.selection) {
            NavigationStack { HomeView() }
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(AppTab.home)

            NavigationStack { ScanView() }
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
        // Small blocking indicator while a deep-linked tag resolves, so the
        // pop-up doesn't appear to come from nowhere (or not at all).
        .overlay {
            if resolvingTag {
                ZStack {
                    Color.black.opacity(0.25).ignoresSafeArea()
                    HStack(spacing: Space.sm) {
                        ProgressView().tint(.white)
                        Text("Reading tag…")
                            .font(CappyFont.sansSemibold(FontSizeToken.base))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, Space.lg)
                    .padding(.vertical, Space.md)
                    .background(Capsule().fill(.black.opacity(0.7)))
                }
                .transition(.opacity)
            }
        }
        .onChange(of: model.pendingTagUID) { _, uid in
            guard let uid else { return }
            model.pendingTagUID = nil
            Task { await presentTag(uid) }
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
                model.pendingTagUID = nil
                Task { await presentTag(uid) }
            }
            if model.pendingInviteCode != nil { showInvite = true }
        }
        .sheet(item: $resolvedBox) { box in
            DoseSheetView(resolved: box.tag)
        }
        .cappyAlert($tagAlert)
        .sheet(isPresented: $showInvite, onDismiss: { model.pendingInviteCode = nil }) {
            NavigationStack {
                AcceptInviteView(prefillCode: model.pendingInviteCode)
            }
        }
    }

    /// Resolve a deep-linked tag UID and pop the med-branded dose card over
    /// the current screen. Mirrors ScanView's resolution (same repository,
    /// same error copy) so every entry path behaves identically.
    private func presentTag(_ uid: String) async {
        // A card already up (e.g. two taps in a row): replace it.
        resolvedBox = nil
        withAnimation(.easeInOut(duration: Motion.fast)) { resolvingTag = true }
        defer { withAnimation(.easeInOut(duration: Motion.fast)) { resolvingTag = false } }
        do {
            let resolved = try await NfcRepository.resolveTag(tagUid: uid,
                                                              activeFamilyId: model.activeFamily?.id)
            guard let resolved else {
                tagAlert = CappyAlert(
                    title: "Couldn't open dose card",
                    message: (Tags.isWellKnownSlug(uid) && model.activeFamily == nil)
                        ? "Create or join a family first, then tap the sticker again to log a dose."
                        : "This tag isn't registered to a family you have access to. Ask the family admin to register it.")
                return
            }
            Haptics.success()
            resolvedBox = ResolvedTagBox(tag: resolved)
        } catch {
            tagAlert = CappyAlert(title: "Couldn't read tag", message: error.localizedDescription)
        }
    }
}
