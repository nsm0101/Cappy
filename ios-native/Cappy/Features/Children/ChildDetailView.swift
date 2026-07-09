//
//  ChildDetailView.swift
//  Cappy
//
//  Child profile: weight (manual entry), allergies, edit, and
//  recent dose history. Port of app/src/screens/ChildDetailScreen.tsx.
//

import SwiftUI

struct ChildDetailView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm: ChildDetailViewModel

    @State private var showAddWeight = false
    @State private var showAddAllergy = false
    @State private var weightInput = ""

    init(childId: String) {
        _vm = StateObject(wrappedValue: ChildDetailViewModel(childId: childId))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                if let child = vm.child { header(child) }
                weightCard
                allergiesCard
                historyCard
                if model.activeFamily?.myRole == .admin {
                    CappyButton(label: "Remove child", variant: .ghost, block: true) {
                        vm.delete { dismiss() }
                    }
                }
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationTitle(vm.child?.displayName ?? "Child")
        .navigationBarTitleDisplayMode(.inline)
        .cappyAlert($vm.alert)
        .task { await vm.load() }
        .sheet(isPresented: $showAddWeight) { addWeightSheet }
        .sheet(isPresented: $showAddAllergy) { addAllergySheet }
    }

    private func header(_ child: Child) -> some View {
        HStack(spacing: Space.base) {
            AvatarPicker(avatarPath: child.avatarUrl, initials: CappyFormat.initials(from: child.displayName), size: .lg) { jpeg in
                guard let familyId = model.activeFamily?.id else { return }
                await vm.uploadAvatar(familyId: familyId, jpeg: jpeg)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(child.displayName).font(CappyFont.display(FontSizeToken.xl)).foregroundStyle(theme.tokens.fg1)
                Text(vm.ageDescription).font(CappyFont.sans(FontSizeToken.sm)).foregroundStyle(theme.tokens.fg3)
            }
            Spacer()
        }
    }

    private var weightCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionLabel(text: "Weight")
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(CappyFormat.weight(fromGrams: vm.weightGrams))
                        .font(CappyFont.display(FontSizeToken.xxl)).foregroundStyle(theme.tokens.fg1)
                    if let recordedAt = vm.weightRecordedAt {
                        Text("updated \(CappyTime.relative(recordedAt))")
                            .font(CappyFont.sans(FontSizeToken.sm)).foregroundStyle(theme.tokens.fg3)
                    }
                }
                CappyButton(label: "Add weight", variant: .secondary) { weightInput = ""; showAddWeight = true }
            }
        }
    }

    private var allergiesCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                HStack {
                    SectionLabel(text: "Allergies")
                    Spacer()
                    Button("Add") { showAddAllergy = true }
                        .font(CappyFont.sansSemibold(FontSizeToken.sm)).foregroundStyle(theme.tokens.brand)
                }
                if vm.allergies.isEmpty {
                    Text("No allergies recorded.").font(CappyFont.sans(FontSizeToken.sm)).foregroundStyle(theme.tokens.fg3)
                } else {
                    FlowChips(items: vm.allergies.map { ($0.id, $0.label) }) { id in
                        Task { await vm.removeAllergy(id) }
                    }
                }
            }
        }
    }

    private var historyCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionLabel(text: "Recent doses")
                if vm.doses.isEmpty {
                    Text("No doses logged yet.").font(CappyFont.sans(FontSizeToken.sm)).foregroundStyle(theme.tokens.fg3)
                } else {
                    ForEach(vm.doses.prefix(12)) { dose in
                        HStack {
                            let visual = Brands.visual(forGeneric: dose.medication?.genericName ?? "acetaminophen")
                            Circle().fill(visual.color).frame(width: 8, height: 8)
                            Text(CappyFormat.doseAmount(formulation: dose.medication?.formulation ?? .liquidSuspension,
                                                        amountMg: dose.amountMg, amountVolumeMl: dose.amountVolumeMl,
                                                        unitCount: dose.unitCount).primary)
                                .font(CappyFont.sans(FontSizeToken.sm)).foregroundStyle(theme.tokens.fg1)
                            Spacer()
                            Text(CappyTime.relative(dose.givenAt))
                                .font(CappyFont.sans(FontSizeToken.sm)).foregroundStyle(theme.tokens.fg3)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
    }

    // MARK: Sheets

    private var addWeightSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Space.lg) {
                CappyTextField(label: "Weight (lb)", placeholder: "e.g. 38", text: $weightInput, keyboard: .decimalPad)
                Text("Enter your child's current weight — dosing is weight-based, so keep it up to date.")
                    .font(CappyFont.sans(FontSizeToken.xs)).foregroundStyle(theme.tokens.fg3)
                CappyButton(label: "Save weight", variant: .blue, size: .lg, block: true) {
                    if let lb = Double(weightInput) { Task { await vm.addWeight(lb: lb); showAddWeight = false } }
                }
                Spacer()
            }
            .padding(Space.lg)
            .background(theme.tokens.bg.ignoresSafeArea())
            .navigationTitle("Add weight")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showAddWeight = false } } }
        }
    }

    private var addAllergySheet: some View {
        NavigationStack {
            List(Allergens.catalog) { allergen in
                Button {
                    Task { await vm.addAllergy(allergen); showAddAllergy = false }
                } label: {
                    HStack {
                        Text(allergen.label).foregroundStyle(theme.tokens.fg1)
                        Spacer()
                        if vm.allergies.contains(where: { $0.allergen == allergen.key }) {
                            Image(systemName: "checkmark").foregroundStyle(theme.tokens.brand)
                        }
                    }
                }
            }
            .navigationTitle("Add allergy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { showAddAllergy = false } } }
        }
    }
}

/// Simple wrapping chip row with tap-to-remove.
struct FlowChips: View {
    @Environment(\.theme) private var theme
    let items: [(String, String)]
    let onRemove: (String) -> Void

    var body: some View {
        FlowLayout(spacing: Space.sm) {
            ForEach(items, id: \.0) { item in
                Button { onRemove(item.0) } label: {
                    HStack(spacing: 6) {
                        Text(item.1).font(CappyFont.sansMedium(FontSizeToken.sm))
                        Image(systemName: "xmark").font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(theme.tokens.fg1)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(theme.tokens.bgInset)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }
}
