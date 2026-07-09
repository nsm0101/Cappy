//
//  TrackerViewModel.swift
//  Cappy
//
//  Data for the per-patient Medication Tracker: the last 28 days of dose
//  events for one child, grouped per medication, with per-medication
//  visibility toggles that let views stack multiple interval timelines.
//

import Foundation
import SwiftUI
import Combine

@MainActor
final class TrackerViewModel: ObservableObject {

    struct TrackedMed: Identifiable, Hashable {
        let id: String            // medication id
        let generic: String
        let label: String
        let color: Color
        let intervalHours: Int
        let maxDosesPer24h: Int
    }

    struct TrackedDose: Identifiable, Hashable {
        let id: String
        let medicationId: String
        let givenAt: Date
        let amountLabel: String
        let note: String?
    }

    @Published var children: [Child] = []
    @Published var selectedChildId: String?
    @Published var meds: [TrackedMed] = []
    @Published var doses: [TrackedDose] = []
    @Published var hiddenMedIds: Set<String> = []
    @Published var loading = true

    private var subscription: RealtimeSubscription?

    var selectedChild: Child? { children.first { $0.id == selectedChildId } }

    var visibleMeds: [TrackedMed] { meds.filter { !hiddenMedIds.contains($0.id) } }

    func toggle(_ med: TrackedMed) {
        if hiddenMedIds.contains(med.id) { hiddenMedIds.remove(med.id) }
        else if visibleMeds.count > 1 { hiddenMedIds.insert(med.id) } // keep at least one visible
    }

    func doses(for medId: String) -> [TrackedDose] {
        doses.filter { $0.medicationId == medId }.sorted { $0.givenAt < $1.givenAt }
    }

    /// Doses for a med given on a specific calendar day.
    func doses(for medId: String, on day: Date, calendar: Calendar = .current) -> [TrackedDose] {
        doses(for: medId).filter { calendar.isDate($0.givenAt, inSameDayAs: day) }
    }

    /// The most recent dose for a med (drives the interval band on the 24h view).
    func lastDose(for medId: String) -> TrackedDose? {
        doses(for: medId).last
    }

    // MARK: Loading

    func bootstrap(familyId: String?) async {
        guard let familyId else { children = []; doses = []; loading = false; return }
        loading = true
        defer { loading = false }
        children = (try? await ChildrenRepository.listChildren(inFamily: familyId)) ?? []
        if selectedChildId == nil || !children.contains(where: { $0.id == selectedChildId }) {
            selectedChildId = children.first?.id
        }
        await loadDoses()
        subscription?.cancel()
        subscription = SupabaseClient.shared.realtime.subscribeFamilyDoses(familyId: familyId) { [weak self] in
            Task { await self?.loadDoses() }
        }
    }

    func loadDoses() async {
        guard let childId = selectedChildId else { doses = []; meds = []; return }
        let rows = (try? await DosesRepository.listDosesWithDetails(forChild: childId, limit: 300)) ?? []
        let cutoff = Calendar.current.date(byAdding: .day, value: -28, to: Date()) ?? Date.distantPast

        var medMap: [String: TrackedMed] = [:]
        var result: [TrackedDose] = []
        for row in rows {
            guard let date = CappyTime.date(from: row.givenAt), date >= cutoff else { continue }
            if let med = row.medication, medMap[med.id] == nil {
                let visual = Brands.visual(forGeneric: med.genericName)
                medMap[med.id] = TrackedMed(
                    id: med.id, generic: med.genericName, label: visual.label,
                    color: visual.color, intervalHours: med.minIntervalHours,
                    maxDosesPer24h: med.maxDosesPer24h)
            }
            let amount = CappyFormat.doseAmount(
                formulation: row.medication?.formulation ?? .liquidSuspension,
                amountMg: row.amountMg, amountVolumeMl: row.amountVolumeMl,
                unitCount: row.unitCount).primary
            result.append(TrackedDose(id: row.id, medicationId: row.medicationId,
                                      givenAt: date, amountLabel: amount, note: row.note))
        }
        doses = result
        meds = medMap.values.sorted { $0.generic < $1.generic }
        hiddenMedIds.formIntersection(Set(meds.map(\.id)))
    }
}
