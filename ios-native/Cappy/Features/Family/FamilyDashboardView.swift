//
//  FamilyDashboardView.swift
//  Cappy
//
//  Manage caregivers, invites, and per-medication brand preferences. Port of
//  app/src/screens/FamilyDashboardScreen.tsx.
//

import SwiftUI

struct FamilyDashboardView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme
    @StateObject private var vm = FamilyDashboardViewModel()

    @State private var showInviteRolePicker = false
    @State private var shareInvite: ShareInvite?

    /// A dose sheet opened on behalf of a specific caregiver (e.g. one parent
    /// logging the other parent's ibuprofen).
    struct CaregiverDoseTarget: Identifiable {
        let id = UUID()
        let resolved: ResolvedTag
        let recipientId: String
    }
    @State private var caregiverDoseTarget: CaregiverDoseTarget?
    @State private var resolvingDoseFor: String?

    private var isAdmin: Bool { model.activeFamily?.myRole == .admin }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                Text(model.activeFamily?.name ?? "Family")
                    .font(CappyFont.display(FontSizeToken.xxl))
                    .foregroundStyle(theme.tokens.fg1)

                caregiversCard
                if isAdmin { inviteCard }
                brandCard
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationTitle("Family")
        .navigationBarTitleDisplayMode(.inline)
        .cappyAlert($vm.alert)
        .task(id: model.activeFamily?.id) {
            if let id = model.activeFamily?.id { await vm.load(familyId: id) }
        }
        .confirmationDialog("Invite as", isPresented: $showInviteRolePicker, titleVisibility: .visible) {
            Button("Caregiver") { Task { await createInvite(.caregiver) } }
            Button("Read-only") { Task { await createInvite(.readonly) } }
            Button("Guest (temporary)") { Task { await createInvite(.guestRole) } }
        }
        .sheet(item: $shareInvite) { invite in
            NavigationStack { ShareViaTapView(code: invite.code, familyName: model.activeFamily?.name) }
        }
        .sheet(item: $caregiverDoseTarget) { target in
            DoseSheetView(resolved: target.resolved, preselectRecipientId: target.recipientId)
        }
    }

    private var caregiversCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionLabel(text: "Caregivers")
                if vm.loading {
                    ProgressView().tint(theme.tokens.brand)
                } else {
                    ForEach(vm.caregivers.filter { $0.status == .active }) { caregiver in
                        HStack(spacing: Space.md) {
                            MemberAvatar(avatarPath: caregiver.avatarUrl,
                                         initials: CappyFormat.initials(from: caregiver.displayName ?? "?"),
                                         tint: theme.tokens.brand)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(caregiver.displayName ?? "Caregiver")
                                    .font(CappyFont.sansSemibold(FontSizeToken.base))
                                    .foregroundStyle(theme.tokens.fg1)
                                Text(caregiver.role.label)
                                    .font(CappyFont.sans(FontSizeToken.sm))
                                    .foregroundStyle(theme.tokens.fg3)
                            }
                            Spacer()
                            if resolvingDoseFor == caregiver.userId {
                                ProgressView().tint(theme.tokens.brand)
                            } else {
                                Menu {
                                    Button("Acetaminophen") { logDose(for: caregiver, slug: "ace-child") }
                                    Button("Ibuprofen") { logDose(for: caregiver, slug: "ibu-child") }
                                } label: {
                                    Label("Log dose", systemImage: "pills")
                                        .font(CappyFont.sansSemibold(FontSizeToken.sm))
                                        .foregroundStyle(theme.tokens.accent2)
                                }
                            }
                            if isAdmin && caregiver.userId != model.currentUserId {
                                Button("Remove") {
                                    if let id = model.activeFamily?.id { vm.revoke(caregiver.id, familyId: id) }
                                }
                                .font(CappyFont.sansSemibold(FontSizeToken.sm))
                                .foregroundStyle(theme.tokens.error)
                            }
                        }
                    }
                }
            }
        }
    }

    private var inviteCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionLabel(text: "Invite a caregiver")
                if let code = vm.inviteCode {
                    Text(code)
                        .font(CappyFont.mono(FontSizeToken.display))
                        .tracking(6)
                        .foregroundStyle(theme.tokens.fg1)
                    Text("Share this code — it expires in 24 hours.")
                        .font(CappyFont.sans(FontSizeToken.sm))
                        .foregroundStyle(theme.tokens.fg3)
                    HStack(spacing: Space.sm) {
                        CappyButton(label: "Share via Tap", variant: .secondary) {
                            shareInvite = ShareInvite(code: code)
                        }
                        ShareLink(item: FamiliesRepository.inviteLink(code: code)) {
                            Text("Share link")
                                .font(CappyFont.sansSemibold(FontSizeToken.base))
                                .foregroundStyle(theme.tokens.brand)
                                .frame(maxWidth: .infinity, minHeight: Space.tapMin)
                                .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(theme.tokens.borderStrong, lineWidth: 1))
                        }
                    }
                } else {
                    CappyButton(label: "Create invite code", block: true) { showInviteRolePicker = true }
                }
            }
        }
    }

    private var brandCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionLabel(text: "Preferred brands")
                Text("Pick the brand you keep on hand. It only changes the label and accent color — never the dose.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg3)
                ForEach(vm.generics, id: \.self) { generic in
                    let brands = Brands.brands(forGeneric: generic)
                    let current = vm.brandPrefs[generic] ?? "generic"
                    VStack(alignment: .leading, spacing: Space.sm) {
                        Text(Brands.visual(forGeneric: generic).label)
                            .font(CappyFont.sansSemibold(FontSizeToken.base))
                            .foregroundStyle(theme.tokens.fg1)
                        SegmentedControl(
                            options: brands.map { SegmentedOption(value: $0.key, label: $0.name) },
                            selection: Binding(
                                get: { current },
                                set: { newKey in
                                    if let id = model.activeFamily?.id {
                                        Task { await vm.setBrand(familyId: id, generic: generic, brandKey: newKey) }
                                    }
                                }))
                    }
                }
            }
        }
    }

    private func createInvite(_ role: CaregiverRole) async {
        guard let id = model.activeFamily?.id else { return }
        await vm.createInvite(familyId: id, role: role)
    }

    /// Resolve the medication slug and open the dose sheet with this
    /// caregiver preselected — same pipeline a tag scan uses.
    private func logDose(for caregiver: CaregiverWithProfile, slug: String) {
        guard let familyId = model.activeFamily?.id else { return }
        resolvingDoseFor = caregiver.userId
        Task {
            defer { resolvingDoseFor = nil }
            do {
                guard let resolved = try await NfcRepository.resolveTag(tagUid: slug, activeFamilyId: familyId) else {
                    vm.alert = CappyAlert(title: "Couldn't open dose sheet",
                                          message: "This medication isn't available for your family yet.")
                    return
                }
                caregiverDoseTarget = CaregiverDoseTarget(resolved: resolved,
                                                          recipientId: "caregiver:\(caregiver.userId)")
            } catch {
                vm.alert = CappyAlert(title: "Couldn't open dose sheet", message: error.localizedDescription)
            }
        }
    }
}

struct ShareInvite: Identifiable { let id = UUID(); let code: String }
