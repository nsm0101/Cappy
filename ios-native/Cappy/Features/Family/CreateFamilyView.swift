//
//  CreateFamilyView.swift
//  Cappy
//
//  Create a new family. Port of app/src/screens/CreateFamilyScreen.tsx.
//

import SwiftUI

struct CreateFamilyView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var saving = false
    @State private var alert: CappyAlert?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                Text("Create a family")
                    .font(CappyFont.display(FontSizeToken.xxl))
                    .foregroundStyle(theme.tokens.fg1)
                Text("A family is a small group who share responsibility for one or more children's medication. You'll be the admin.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg2)

                CappyTextField(label: "Family name", placeholder: "e.g. The Rivera family", text: $name,
                               autocapitalization: .words)

                CappyButton(label: "Create family", variant: .blue, size: .lg, block: true, loading: saving) {
                    Task { await save() }
                }
                .disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationTitle("New family")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        .cappyAlert($alert)
    }

    private func save() async {
        saving = true; defer { saving = false }
        do {
            let family = try await FamiliesRepository.createFamily(name: name)
            await model.refreshFamilies()
            if let match = model.families.first(where: { $0.id == family.id }) {
                model.setActiveFamily(match)
            }
            Haptics.success()
            dismiss()
        } catch {
            alert = CappyAlert(title: "Couldn't create family", message: error.localizedDescription)
        }
    }
}
