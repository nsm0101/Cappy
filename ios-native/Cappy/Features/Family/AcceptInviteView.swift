//
//  AcceptInviteView.swift
//  Cappy
//
//  Join a family with a 6-digit code (also reached via a Universal Link
//  join/:code). Port of app/src/screens/AcceptInviteScreen.tsx.
//

import SwiftUI

struct AcceptInviteView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss

    let prefillCode: String?
    @State private var code = ""
    @State private var joining = false
    @State private var joined = false
    @State private var alert: CappyAlert?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                Text("Join a family")
                    .font(CappyFont.display(FontSizeToken.xxl))
                    .foregroundStyle(theme.tokens.fg1)
                Text("Enter the 6-digit code an admin shared with you.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg2)

                CappyTextField(label: "Invite code", placeholder: "123456", text: $code, keyboard: .numberPad)

                CappyButton(label: joined ? "Joined!" : "Join family", variant: .blue, size: .lg,
                            block: true, loading: joining) {
                    Task { await join() }
                }
                .disabled(joining || code.trimmingCharacters(in: .whitespaces).count != 6)
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationTitle("Join")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        .cappyAlert($alert)
        .onAppear {
            if let prefillCode, code.isEmpty {
                code = prefillCode
                Task { await join() }
            }
        }
    }

    private func join() async {
        let trimmed = code.trimmingCharacters(in: .whitespaces)
        guard trimmed.range(of: "^[0-9]{6}$", options: .regularExpression) != nil else {
            alert = CappyAlert(title: "Invalid code", message: "Enter the 6-digit code exactly."); return
        }
        joining = true; defer { joining = false }
        do {
            _ = try await FamiliesRepository.acceptInvite(code: trimmed)
            joined = true
            await model.refreshFamilies()
            Haptics.success()
            try? await Task.sleep(nanoseconds: 500_000_000)
            dismiss()
        } catch {
            alert = CappyAlert(title: "Couldn't join", message: error.localizedDescription)
        }
    }
}
