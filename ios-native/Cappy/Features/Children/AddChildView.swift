//
//  AddChildView.swift
//  Cappy
//
//  Add a child to the active family. Port of app/src/screens/AddChildScreen.tsx.
//

import SwiftUI

struct AddChildView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss

    let familyId: String
    @State private var name = ""
    @State private var dob = Calendar.current.date(byAdding: .year, value: -3, to: Date()) ?? Date()
    @State private var saving = false
    @State private var alert: CappyAlert?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                Text("Add a child")
                    .font(CappyFont.display(FontSizeToken.xxl))
                    .foregroundStyle(theme.tokens.fg1)
                Text("Cappy uses date of birth to choose the right dosing pathway, and weight for the amount.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg2)

                CappyTextField(label: "Name", placeholder: "e.g. Ava", text: $name, autocapitalization: .words)

                VStack(alignment: .leading, spacing: Space.sm) {
                    SectionLabel(text: "Date of birth")
                    DatePicker("", selection: $dob, in: ...Date(), displayedComponents: .date)
                        .datePickerStyle(.compact).labelsHidden().tint(theme.tokens.brand)
                }

                CappyButton(label: "Add child", variant: .blue, size: .lg, block: true, loading: saving) {
                    Task { await save() }
                }
                .disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationTitle("New child")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        .cappyAlert($alert)
    }

    private func save() async {
        saving = true; defer { saving = false }
        do {
            _ = try await ChildrenRepository.createChild(
                familyId: familyId, displayName: name, dateOfBirth: dob.yyyyMMdd)
            model.bumpData()
            Haptics.success()
            dismiss()
        } catch {
            alert = CappyAlert(title: "Couldn't add child", message: error.localizedDescription)
        }
    }
}
