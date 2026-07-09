//
//  FamilyDashboardViewModel.swift
//  Cappy
//
//  Caregivers, invites, brand preferences, and tag registration for the
//  active family. Port of the data logic in
//  app/src/screens/FamilyDashboardScreen.tsx.
//

import Foundation
import Combine

@MainActor
final class FamilyDashboardViewModel: ObservableObject {
    @Published var caregivers: [CaregiverWithProfile] = []
    @Published var brandPrefs: [String: String] = [:]
    @Published var medications: [Medication] = []
    @Published var loading = true
    @Published var inviteCode: String?
    @Published var alert: CappyAlert?

    /// Distinct generics available (for the brand picker).
    var generics: [String] {
        var seen = Set<String>()
        var out: [String] = []
        for med in medications where !seen.contains(med.genericName) {
            seen.insert(med.genericName); out.append(med.genericName)
        }
        return out
    }

    func load(familyId: String) async {
        loading = true
        defer { loading = false }
        caregivers = (try? await FamiliesRepository.listFamilyCaregivers(familyId: familyId)) ?? []
        brandPrefs = (try? await BrandsRepository.getFamilyBrandPrefs(familyId: familyId)) ?? [:]
        medications = (try? await NfcRepository.listMedications()) ?? []
    }

    func createInvite(familyId: String, role: CaregiverRole) async {
        do {
            let result = try await FamiliesRepository.createInvite(familyId: familyId, role: role, guestExpiresHours: nil)
            inviteCode = result.code
        } catch {
            alert = CappyAlert(title: "Couldn't create invite", message: error.localizedDescription)
        }
    }

    func revoke(_ caregiverId: String, familyId: String) {
        alert = CappyAlert(title: "Remove this member?",
                           message: "They lose access immediately. Doses they logged are preserved.",
                           primary: CappyAlertAction(label: "Remove", role: .destructive) {
            Task {
                do { try await FamiliesRepository.revokeCaregiver(caregiverId: caregiverId); await self.load(familyId: familyId) }
                catch { self.alert = CappyAlert(title: "Couldn't remove", message: error.localizedDescription) }
            }
        })
    }

    func setBrand(familyId: String, generic: String, brandKey: String) async {
        do {
            try await BrandsRepository.setFamilyBrand(familyId: familyId, generic: generic, brandKey: brandKey)
            brandPrefs[generic] = brandKey
        } catch {
            alert = CappyAlert(title: "Couldn't save brand", message: error.localizedDescription)
        }
    }
}
