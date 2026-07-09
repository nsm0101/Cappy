//
//  TimelineView.swift
//  Cappy
//
//  Family-wide dose history grouped by day, with live updates. Port of
//  app/src/screens/TimelineScreen.tsx.
//

import SwiftUI

struct TimelineView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme

    @State private var doses: [DoseEventWithDetails] = []
    @State private var loading = true
    @State private var errorText = ""
    @State private var subscription: RealtimeSubscription?

    private var grouped: [(day: String, items: [DoseEventWithDetails])] {
        var order: [String] = []
        var map: [String: [DoseEventWithDetails]] = [:]
        for dose in doses {
            let day = CappyTime.dayHeading(dose.givenAt)
            if map[day] == nil { order.append(day); map[day] = [] }
            map[day]?.append(dose)
        }
        return order.map { ($0, map[$0] ?? []) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                Text("Timeline")
                    .font(CappyFont.display(FontSizeToken.xxxl))
                    .foregroundStyle(theme.tokens.fg1)

                if loading {
                    ProgressView().tint(theme.tokens.brand).frame(maxWidth: .infinity).padding(.top, Space.xl)
                } else if !errorText.isEmpty {
                    Card { Text(errorText).foregroundStyle(theme.tokens.error) }
                } else if doses.isEmpty {
                    Card {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("No doses yet").font(CappyFont.displaySemibold(FontSizeToken.lg))
                                .foregroundStyle(theme.tokens.fg1)
                            Text("Logged doses for everyone in this family will appear here.")
                                .font(CappyFont.sans(FontSizeToken.sm)).foregroundStyle(theme.tokens.fg2)
                        }
                    }
                } else {
                    ForEach(grouped, id: \.day) { section in
                        VStack(alignment: .leading, spacing: Space.sm) {
                            Text(section.day)
                                .font(CappyFont.sansSemibold(FontSizeToken.sm))
                                .foregroundStyle(theme.tokens.fg3)
                                .padding(.top, Space.sm)
                            ForEach(section.items) { dose in DoseRow(dose: dose) }
                        }
                    }
                }
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .refreshable { await load() }
        .task(id: model.activeFamily?.id) { await loadAndSubscribe() }
    }

    private func load() async {
        guard let familyId = model.activeFamily?.id else { doses = []; loading = false; return }
        do {
            errorText = ""
            doses = try await DosesRepository.listDosesWithDetails(forFamily: familyId)
        } catch {
            errorText = error.localizedDescription
        }
        loading = false
    }

    private func loadAndSubscribe() async {
        await load()
        guard let familyId = model.activeFamily?.id else { return }
        subscription?.cancel()
        subscription = SupabaseClient.shared.realtime.subscribeFamilyDoses(familyId: familyId) {
            Task { await load() }
        }
    }
}

private struct DoseRow: View {
    @Environment(\.theme) private var theme
    let dose: DoseEventWithDetails

    private var recipientName: String {
        dose.child?.displayName ?? dose.caregiverRecipient?.displayName ?? "Caregiver"
    }
    private var medVisual: Brands.MedVisual {
        Brands.visual(forGeneric: dose.medication?.genericName ?? "acetaminophen")
    }
    private var amount: String {
        CappyFormat.doseAmount(formulation: dose.medication?.formulation ?? .liquidSuspension,
                               amountMg: dose.amountMg, amountVolumeMl: dose.amountVolumeMl,
                               unitCount: dose.unitCount).primary
    }
    private var giver: String { dose.loggedByProfile?.displayName ?? "Someone" }

    var body: some View {
        HStack(spacing: Space.md) {
            ZStack {
                Circle().fill(medVisual.color.opacity(0.14)).frame(width: 40, height: 40)
                Text(medVisual.letter).font(CappyFont.sansBold(FontSizeToken.base)).foregroundStyle(medVisual.color)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("\(recipientName) · \(amount)")
                    .font(CappyFont.sansSemibold(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg1)
                Text("\(dose.medication?.brandName ?? dose.medication?.genericName ?? "Medication") · logged by \(giver)")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg3)
                    .lineLimit(1)
                if let note = dose.note, !note.isEmpty {
                    Label(note, systemImage: "text.bubble")
                        .font(CappyFont.sans(FontSizeToken.xs))
                        .foregroundStyle(theme.tokens.fg2)
                        .lineLimit(2)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(CappyTime.clock(dose.givenAt)).font(CappyFont.mono(FontSizeToken.sm)).foregroundStyle(theme.tokens.fg2)
                Text(CappyTime.relative(dose.givenAt)).font(CappyFont.sans(FontSizeToken.xs)).foregroundStyle(theme.tokens.fgMuted)
            }
        }
        .padding(Space.base)
        .background(theme.tokens.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: Radius.base))
        .overlay(RoundedRectangle(cornerRadius: Radius.base).stroke(theme.tokens.border, lineWidth: 1))
    }
}
