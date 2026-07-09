//
//  HomeViewModel.swift
//  Cappy
//
//  Loads each child in the active family with its dose-safety status, weight,
//  and last dose — plus live updates. Port of the data logic in
//  app/src/screens/HomeScreen.tsx.
//

import Foundation
import Combine

struct ChildWithStatus: Identifiable, Hashable {
    let child: Child
    var status: DoseStatus
    var lastDoseAt: String?
    var nextSafeAt: String?
    var weightGrams: Int?
    var id: String { child.id }
}

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var children: [ChildWithStatus] = []
    @Published var loading = true
    @Published var displayName: String?

    private var subscription: RealtimeSubscription?
    private var subscribedFamilyId: String?

    func loadDisplayName() async {
        displayName = try? await ProfilesRepository.getMyDisplayName()
    }

    func load(familyId: String) async {
        do {
            let kids = try await ChildrenRepository.listChildren(inFamily: familyId)
            var enriched: [ChildWithStatus] = []
            for child in kids {
                let recent = try? await DosesRepository.listDosesForChild(child.id, limit: 1)
                let last = recent?.first
                let weight = try? await ChildrenRepository.getLatestWeight(childId: child.id)
                var status: DoseStatus = .due
                var nextSafeAt: String?
                if let last {
                    if let result = try? await DosesRepository.getDoseStatus(
                        childId: child.id, medicationId: last.medicationId) {
                        status = result.status
                        nextSafeAt = result.nextSafeAt
                    } else {
                        status = .unknown
                    }
                }
                enriched.append(ChildWithStatus(child: child, status: status, lastDoseAt: last?.givenAt,
                                                nextSafeAt: nextSafeAt, weightGrams: weight ?? nil))
            }
            children = enriched
        } catch {
            // Keep existing state on transient failure.
        }
        loading = false
    }

    /// Publish a lightweight snapshot for the Home Screen widget.
    func writeWidgetSnapshot(familyName: String) {
        let snapshotChildren = children.map {
            SharedDoseSnapshot.Child(id: $0.child.id, name: $0.child.displayName,
                                     statusRaw: $0.status.rawValue, nextSafeAt: $0.nextSafeAt)
        }
        SharedDoseSnapshot(familyName: familyName, children: snapshotChildren, updatedAt: Date()).save()
    }

    /// Home shows the onboarding checklist while any step is incomplete.
    var showOnboarding: Bool {
        if children.isEmpty { return true }
        if !children.contains(where: { $0.weightGrams != nil }) { return true }
        if !children.contains(where: { $0.lastDoseAt != nil }) { return true }
        return false
    }

    func subscribe(familyId: String, reload: @escaping () -> Void) {
        guard subscribedFamilyId != familyId else { return }
        subscription?.cancel()
        subscribedFamilyId = familyId
        subscription = SupabaseClient.shared.realtime.subscribeFamilyDoses(familyId: familyId, onInsert: reload)
    }

    func unsubscribe() {
        subscription?.cancel()
        subscription = nil
        subscribedFamilyId = nil
    }
}
