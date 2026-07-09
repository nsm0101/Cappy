//
//  SettingsView.swift
//  Cappy
//
//  Profile, appearance, reminders, family management, and sign-out. Port of
//  app/src/screens/SettingsScreen.tsx.
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var themeManager: ThemeManager
    @Environment(\.theme) private var theme

    @State private var displayName = ""
    @State private var editingName = false
    @State private var remindersOn = ReminderService.isEnabled
    @State private var savingName = false
    @State private var alert: CappyAlert?

    @State private var manualPasscode = ""
    @State private var savingPasscode = false
    @State private var manualPasscodeSet = false

    private let themeOptions: [SegmentedOption<ThemeMode>] = ThemeMode.allCases.map {
        SegmentedOption(value: $0, label: $0.label)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                Wordmark(size: 24)

                // Profile
                Card {
                    VStack(alignment: .leading, spacing: Space.md) {
                        SectionLabel(text: "Your profile")
                        HStack(spacing: Space.md) {
                            AvatarPicker(avatarPath: model.profile?.avatarUrl,
                                         initials: CappyFormat.initials(from: model.profile?.displayName ?? "?"),
                                         tint: theme.tokens.brand, size: .lg) { jpeg in
                                await uploadMyAvatar(jpeg)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(model.profile?.displayName ?? "—")
                                    .font(CappyFont.sansSemibold(FontSizeToken.base))
                                    .foregroundStyle(theme.tokens.fg1)
                                if let email = model.session?.user.email {
                                    Text(email).font(CappyFont.sans(FontSizeToken.sm)).foregroundStyle(theme.tokens.fg3)
                                }
                            }
                            Spacer()
                            Button("Edit") { displayName = model.profile?.displayName ?? ""; editingName = true }
                                .font(CappyFont.sansSemibold(FontSizeToken.sm))
                                .foregroundStyle(theme.tokens.brand)
                        }
                        if editingName {
                            CappyTextField(placeholder: "Your name", text: $displayName, autocapitalization: .words)
                            HStack {
                                CappyButton(label: "Save", loading: savingName) { Task { await saveName() } }
                                CappyButton(label: "Cancel", variant: .ghost) { editingName = false }
                            }
                        }
                    }
                }

                // Appearance
                Card {
                    VStack(alignment: .leading, spacing: Space.md) {
                        SectionLabel(text: "Appearance")
                        if themeManager.style == .classic {
                            SegmentedControl(options: themeOptions, selection: $themeManager.mode)
                        } else if let scheme = themeManager.style.forcedScheme {
                            Text("\(themeManager.style.label) is a \(scheme == .dark ? "dark" : "light") theme.")
                                .font(CappyFont.sans(FontSizeToken.sm))
                                .foregroundStyle(theme.tokens.fg3)
                        }
                        SectionLabel(text: "Theme")
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: Space.sm)], spacing: Space.sm) {
                            ForEach(ThemeStyle.allCases) { style in
                                themeCard(style)
                            }
                        }
                    }
                }

                // Reminders
                Card {
                    Toggle(isOn: $remindersOn) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Next-dose reminders")
                                .font(CappyFont.sansSemibold(FontSizeToken.base))
                                .foregroundStyle(theme.tokens.fg1)
                            Text("A local nudge when the next dose window opens.")
                                .font(CappyFont.sans(FontSizeToken.sm))
                                .foregroundStyle(theme.tokens.fg3)
                        }
                    }
                    .tint(theme.tokens.brand)
                    .onChange(of: remindersOn) { _, value in ReminderService.isEnabled = value }
                }

                // Manual dose log passcode (admins only)
                if model.activeFamily?.myRole == .admin {
                    Card {
                        VStack(alignment: .leading, spacing: Space.md) {
                            SectionLabel(text: "Manual dose log")
                            Text("Caregivers must enter this passcode on the Scan screen before logging a dose without scanning a tag or QR code.")
                                .font(CappyFont.sans(FontSizeToken.sm))
                                .foregroundStyle(theme.tokens.fg3)
                            CappyTextField(placeholder: manualPasscodeSet ? "Change passcode" : "Set a passcode",
                                           text: $manualPasscode, secure: true)
                            HStack {
                                CappyButton(label: "Save", loading: savingPasscode) { saveManualPasscode() }
                                    .disabled(manualPasscode.trimmingCharacters(in: .whitespaces).count < 4)
                                if manualPasscodeSet {
                                    CappyButton(label: "Clear", variant: .ghost) {
                                        Task { await clearManualPasscode() }
                                    }
                                }
                            }
                        }
                    }
                }

                // Family
                Card {
                    VStack(alignment: .leading, spacing: Space.sm) {
                        SectionLabel(text: "Family")
                        NavigationLink { FamilyDashboardView() } label: {
                            HStack {
                                Text(model.activeFamily?.name ?? "Manage family")
                                    .font(CappyFont.sansSemibold(FontSizeToken.base))
                                    .foregroundStyle(theme.tokens.fg1)
                                Spacer()
                                Image(systemName: "chevron.right").foregroundStyle(theme.tokens.fgMuted)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }

                CappyButton(label: "Sign out", variant: .secondary, block: true) {
                    Task { await model.signOut() }
                }

                Text("Cappy is a coordination tool, not medical advice. Always follow the medication label and consult a pediatrician for dosing decisions.")
                    .font(CappyFont.sans(FontSizeToken.xs))
                    .foregroundStyle(theme.tokens.fg3)
                    .multilineTextAlignment(.center)
                    .padding(.top, Space.sm)
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .cappyAlert($alert)
        .task(id: model.activeFamily?.id) {
            guard let familyId = model.activeFamily?.id else { manualPasscodeSet = false; return }
            manualPasscodeSet = ((try? await FamilySettingsRepository.manualDosePasscodeHash(familyId: familyId)) ?? nil) != nil
                || KeychainStore.get(KeychainStore.manualDoseLogPasscodeKey) != nil
        }
    }

    /// A tappable theme preview: three swatches + name, ringed when active.
    private func themeCard(_ style: ThemeStyle) -> some View {
        let active = themeManager.style == style
        return Button {
            Haptics.impact()
            withAnimation(.easeInOut(duration: Motion.fast)) { themeManager.style = style }
        } label: {
            VStack(spacing: 6) {
                HStack(spacing: 4) {
                    ForEach(Array(style.swatches.enumerated()), id: \.offset) { _, color in
                        Circle()
                            .fill(color)
                            .frame(width: 18, height: 18)
                            .overlay(Circle().stroke(theme.tokens.border, lineWidth: 1))
                    }
                }
                Text(style.label)
                    .font(active ? CappyFont.sansSemibold(FontSizeToken.xs) : CappyFont.sans(FontSizeToken.xs))
                    .foregroundStyle(active ? theme.tokens.fg1 : theme.tokens.fg2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Space.sm)
            .background(RoundedRectangle(cornerRadius: Radius.md).fill(theme.tokens.bgInset))
            .overlay(RoundedRectangle(cornerRadius: Radius.md)
                .stroke(active ? theme.tokens.brand : .clear, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(style.label) theme, \(style.subtitle)\(active ? ", selected" : "")")
    }

    private func uploadMyAvatar(_ jpeg: Data) async {
        guard let familyId = model.activeFamily?.id else { return }
        do {
            try await AvatarsRepository.uploadMyAvatar(familyId: familyId, jpeg: jpeg)
            await model.refreshProfile()
        } catch {
            alert = CappyAlert(title: "Couldn't update photo", message: error.localizedDescription)
        }
    }

    /// Saves the passcode server-side (hashed) so every caregiver's device in
    /// the family can verify it, keeping a local Keychain copy as an offline
    /// fallback on this device.
    private func saveManualPasscode() {
        let trimmed = manualPasscode.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 4, let familyId = model.activeFamily?.id else { return }
        savingPasscode = true
        Task {
            defer { savingPasscode = false }
            do {
                try await FamilySettingsRepository.setManualDosePasscode(familyId: familyId, passcode: trimmed)
                KeychainStore.set(trimmed, for: KeychainStore.manualDoseLogPasscodeKey)
                manualPasscode = ""
                manualPasscodeSet = true
                alert = CappyAlert(title: "Passcode saved",
                                   message: "Caregivers in \(model.activeFamily?.name ?? "your family") can now use it on the Scan screen.")
            } catch {
                alert = CappyAlert(title: "Couldn't save passcode", message: error.localizedDescription)
            }
        }
    }

    private func clearManualPasscode() async {
        guard let familyId = model.activeFamily?.id else { return }
        do {
            try await FamilySettingsRepository.setManualDosePasscode(familyId: familyId, passcode: nil)
            KeychainStore.remove(KeychainStore.manualDoseLogPasscodeKey)
            manualPasscode = ""
            manualPasscodeSet = false
        } catch {
            alert = CappyAlert(title: "Couldn't clear passcode", message: error.localizedDescription)
        }
    }

    private func saveName() async {
        let trimmed = displayName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        savingName = true; defer { savingName = false }
        do {
            try await ProfilesRepository.updateMyDisplayName(trimmed)
            await model.refreshProfile()
            editingName = false
        } catch {
            alert = CappyAlert(title: "Couldn't save", message: error.localizedDescription)
        }
    }
}
