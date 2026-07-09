//
//  ScheduleView.swift
//  Cappy
//
//  Per-child dose-window overview: for each medication, a clock showing time
//  until the next safe dose, driven by the same compute_dose_status the tap
//  flow uses. Inspired by app/src/screens/ScheduleScreen.tsx.
//

import SwiftUI

private struct ChildSchedule: Identifiable {
    let child: Child
    var windows: [MedWindow]
    var id: String { child.id }
}

private struct MedWindow: Identifiable {
    let medication: Medication
    let status: DoseStatusResult
    var id: String { medication.id }
}

struct ScheduleView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme

    @State private var schedules: [ChildSchedule] = []
    @State private var loading = true
    @State private var subscription: RealtimeSubscription?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                Text("Schedule")
                    .font(CappyFont.display(FontSizeToken.xxxl))
                    .foregroundStyle(theme.tokens.fg1)
                Text("When the next dose is safe for each child.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg2)

                NavigationLink { TrackerView() } label: {
                    HStack(spacing: Space.md) {
                        Image(systemName: "chart.bar.doc.horizontal")
                            .foregroundStyle(theme.tokens.accent2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Medication Tracker")
                                .font(CappyFont.sansSemibold(FontSizeToken.base))
                                .foregroundStyle(theme.tokens.fg1)
                            Text("Dose timelines by patient — 24h, 3-day, weekly, monthly")
                                .font(CappyFont.sans(FontSizeToken.xs))
                                .foregroundStyle(theme.tokens.fg3)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(theme.tokens.fgMuted)
                    }
                    .padding(Space.base)
                    .background(theme.tokens.bgCard)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.base))
                    .overlay(RoundedRectangle(cornerRadius: Radius.base).stroke(theme.tokens.border, lineWidth: 1))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if loading {
                    ProgressView().tint(theme.tokens.brand).frame(maxWidth: .infinity).padding(.top, Space.xl)
                } else if schedules.isEmpty {
                    Card {
                        Text("Add a child and log a dose to see the schedule.")
                            .font(CappyFont.sans(FontSizeToken.base)).foregroundStyle(theme.tokens.fg2)
                    }
                } else {
                    ForEach(schedules) { schedule in childCard(schedule) }
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

    private func childCard(_ schedule: ChildSchedule) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                Text(schedule.child.displayName)
                    .font(CappyFont.displaySemibold(FontSizeToken.lg))
                    .foregroundStyle(theme.tokens.fg1)
                HStack(alignment: .top, spacing: Space.lg) {
                    ForEach(schedule.windows) { window in
                        let visual = Brands.visual(forGeneric: window.medication.genericName)
                        VStack(spacing: Space.sm) {
                            DoseClock(status: window.status.status,
                                      lastDoseAt: window.status.lastDoseAt,
                                      nextSafeAt: window.status.nextSafeAt,
                                      accent: visual.color)
                            Text(visual.label)
                                .font(CappyFont.sansSemibold(FontSizeToken.sm))
                                .foregroundStyle(theme.tokens.fg2)
                            Text(subtitle(for: window.status))
                                .font(CappyFont.sans(FontSizeToken.xs))
                                .foregroundStyle(theme.tokens.fg3)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }

    private func subtitle(for status: DoseStatusResult) -> String {
        switch status.status {
        case .due: return status.lastDoseAt != nil ? "Safe now" : "No doses yet"
        case .overdue: return "Window passed"
        case .maxReached: return "24h max reached"
        case .unknown: return "Unavailable"
        case .early, .recent:
            return status.nextSafeAt.map { "Safe at \(CappyTime.clock($0))" } ?? "Recently given"
        }
    }

    // MARK: Data

    /// Pick a representative catalog row per generic (children's suspension,
    /// else any suspension, else first) — matches nfc-resolve.
    private func representativeMeds(_ meds: [Medication]) -> [Medication] {
        var chosen: [Medication] = []
        for generic in ["acetaminophen", "ibuprofen"] {
            let rows = meds.filter { $0.genericName.lowercased() == generic }
            guard !rows.isEmpty else { continue }
            let childrens = rows.first { ($0.brandName?.lowercased().contains("children") ?? false) && $0.formulation == .liquidSuspension }
            let anySuspension = rows.first { $0.formulation == .liquidSuspension }
            chosen.append(childrens ?? anySuspension ?? rows[0])
        }
        return chosen
    }

    private func load() async {
        guard let familyId = model.activeFamily?.id else { schedules = []; loading = false; return }
        do {
            let meds = representativeMeds(try await NfcRepository.listMedications())
            let kids = try await ChildrenRepository.listChildren(inFamily: familyId)
            var result: [ChildSchedule] = []
            for child in kids {
                var windows: [MedWindow] = []
                for med in meds {
                    let status = (try? await DosesRepository.getDoseStatus(childId: child.id, medicationId: med.id)) ?? .due
                    windows.append(MedWindow(medication: med, status: status))
                }
                result.append(ChildSchedule(child: child, windows: windows))
            }
            schedules = result
        } catch {
            // keep prior state
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
