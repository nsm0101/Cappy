//
//  HomeView.swift
//  Cappy
//
//  Family dashboard: children with dose-safety status, onboarding checklist,
//  family switcher, and empty states. Port of app/src/screens/HomeScreen.tsx.
//

import SwiftUI
import WidgetKit

struct ChildRoute: Identifiable, Hashable { let id: String }

struct HomeView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var router: TabRouter
    @Environment(\.theme) private var theme
    @StateObject private var vm = HomeViewModel()

    @State private var selectedChild: ChildRoute?
    @State private var showCreateFamily = false
    @State private var showAddChild = false
    @State private var showAcceptInvite = false
    @State private var showFamilySwitcher = false

    private var welcome: String {
        let who = vm.displayName ?? model.session?.user.email?.components(separatedBy: "@").first
        return who.map { "Welcome back, \($0)." } ?? "Welcome back."
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                // Brand header: a larger, centered wordmark gives the main
                // page a proper masthead instead of a small corner logo.
                VStack(spacing: Space.xs) {
                    Wordmark(size: 40)
                        .frame(maxWidth: .infinity, alignment: .center)
                    Text(welcome)
                        .font(CappyFont.sans(FontSizeToken.sm))
                        .foregroundStyle(theme.tokens.fg2)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .padding(.top, Space.sm)
                .padding(.bottom, Space.xs)

                if model.families.isEmpty {
                    startFamilyCard
                } else {
                    if vm.showOnboarding { onboarding }
                    familyHeader
                    childrenSection
                }
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .refreshable { await reload() }
        .task { await vm.loadDisplayName() }
        .task(id: model.activeFamily?.id) { await reloadAndSubscribe() }
        .onChange(of: model.dataStamp) { _, _ in
            if let id = model.activeFamily?.id { Task { await vm.load(familyId: id) } }
        }
        .navigationDestination(item: $selectedChild) { route in
            ChildDetailView(childId: route.id)
        }
        .sheet(isPresented: $showCreateFamily) {
            NavigationStack { CreateFamilyView() }
        }
        .sheet(isPresented: $showAddChild) {
            if let familyId = model.activeFamily?.id {
                NavigationStack { AddChildView(familyId: familyId) }
            }
        }
        .sheet(isPresented: $showAcceptInvite) {
            NavigationStack { AcceptInviteView(prefillCode: nil) }
        }
        .confirmationDialog("Switch family", isPresented: $showFamilySwitcher, titleVisibility: .visible) {
            ForEach(model.families) { fam in
                Button(fam.name + (fam.id == model.activeFamily?.id ? " ✓" : "")) {
                    model.setActiveFamily(fam)
                }
            }
        }
    }

    // MARK: Sections

    private var onboarding: some View {
        OnboardingSteps(steps: [
            OnboardingStep(title: "Create your family", done: !model.families.isEmpty,
                           actionLabel: "Create") { showCreateFamily = true },
            OnboardingStep(title: "Add a child", done: !vm.children.isEmpty,
                           actionLabel: "Add") { showAddChild = true },
            OnboardingStep(title: "Record a weight", done: vm.children.contains { $0.weightGrams != nil },
                           actionLabel: "Add") {
                if let first = vm.children.first(where: { $0.weightGrams == nil }) {
                    selectedChild = ChildRoute(id: first.id)
                }
            },
            OnboardingStep(title: "Log a dose", done: vm.children.contains { $0.lastDoseAt != nil },
                           actionLabel: "Log") { router.selection = .scan }
        ])
    }

    private var familyHeader: some View {
        Group {
            if let active = model.activeFamily {
                if model.families.count > 1 {
                    Button { showFamilySwitcher = true } label: {
                        HStack(spacing: Space.base) {
                            Text(active.name).font(CappyFont.display(FontSizeToken.xxl))
                                .foregroundStyle(theme.tokens.fg1)
                            Image(systemName: "chevron.down").foregroundStyle(theme.tokens.fg1)
                        }
                    }.buttonStyle(.plain)
                } else {
                    Text(active.name).font(CappyFont.display(FontSizeToken.xxl))
                        .foregroundStyle(theme.tokens.fg1)
                }
            }
        }
    }

    @ViewBuilder private var childrenSection: some View {
        if vm.loading {
            ProgressView().tint(theme.tokens.brand).frame(maxWidth: .infinity).padding(.top, Space.xl)
        } else if vm.children.isEmpty {
            Card {
                VStack(alignment: .leading, spacing: Space.md) {
                    Text("No children added yet.").foregroundStyle(theme.tokens.fg2)
                        .font(CappyFont.sans(FontSizeToken.base))
                    CappyButton(label: "Add a child", block: true) { showAddChild = true }
                }
            }
        } else {
            VStack(spacing: Space.md) {
                ForEach(vm.children) { item in
                    RowItem(
                        title: item.child.displayName,
                        subtitle: "\(CappyFormat.weight(fromGrams: item.weightGrams)) · " +
                            (item.lastDoseAt != nil ? "last dose \(CappyTime.relative(item.lastDoseAt))" : "no doses logged"),
                        showChevron: false,
                        action: { selectedChild = ChildRoute(id: item.child.id) },
                        left: {
                            MemberAvatar(avatarPath: item.child.avatarUrl,
                                         initials: CappyFormat.initials(from: item.child.displayName))
                        },
                        right: {
                            DosePill(label: item.status.homeLabel, status: item.status)
                        })
                }
                CappyButton(label: "Add a child", variant: .secondary, block: true) { showAddChild = true }
            }
        }
    }

    private var startFamilyCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.sm) {
                Text("Start a family")
                    .font(CappyFont.displaySemibold(FontSizeToken.xl))
                    .foregroundStyle(theme.tokens.fg1)
                Text("Create your first family to start tracking doses. You can invite other caregivers afterwards with a 6-digit code.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg2)
                Spacer().frame(height: Space.sm)
                CappyButton(label: "Create a family", block: true) { showCreateFamily = true }
                CappyButton(label: "Join with code", variant: .secondary, block: true) { showAcceptInvite = true }
            }
        }
    }

    // MARK: Actions

    private func reload() async {
        await model.refreshFamilies()
        if let id = model.activeFamily?.id { await vm.load(familyId: id) }
    }

    private func reloadAndSubscribe() async {
        guard let id = model.activeFamily?.id else { vm.loading = false; return }
        await vm.load(familyId: id)
        publishWidget()
        vm.subscribe(familyId: id) {
            Task { await vm.load(familyId: id); publishWidget() }
        }
    }

    private func publishWidget() {
        vm.writeWidgetSnapshot(familyName: model.activeFamily?.name ?? "Family")
        WidgetCenter.shared.reloadAllTimelines()
    }
}
