//
//  ChildDetailViewModel.swift
//  Cappy
//
//  Loads and mutates a child: weight (manual entry), allergies, and recent
//  dose history. Port of the data logic in
//  app/src/screens/ChildDetailScreen.tsx.
//

import Foundation
import Combine

@MainActor
final class ChildDetailViewModel: ObservableObject {
    let childId: String

    @Published var child: Child?
    @Published var weightGrams: Int?
    @Published var weightRecordedAt: String?
    @Published var allergies: [ChildAllergy] = []
    @Published var doses: [DoseEventWithDetails] = []
    @Published var loading = true
    @Published var alert: CappyAlert?

    init(childId: String) { self.childId = childId }

    var ageDescription: String {
        guard let dob = child?.dateOfBirth else { return "" }
        let months = Dosing.ageMonthsFromDob(dob)
        if months < 24 { return "\(months) month\(months == 1 ? "" : "s") old" }
        let years = months / 12
        return "\(years) year\(years == 1 ? "" : "s") old"
    }

    func load() async {
        loading = true
        defer { loading = false }
        child = try? await ChildrenRepository.getChild(childId)
        if let rec = try? await ChildrenRepository.getLatestWeightRecord(childId: childId) {
            weightGrams = rec.valueGrams
            weightRecordedAt = rec.recordedAt
        }
        allergies = (try? await AllergiesRepository.listChildAllergies(childId: childId)) ?? []
        doses = (try? await DosesRepository.listDosesWithDetails(forChild: childId, limit: 25)) ?? []
    }

    func addWeight(lb: Double) async {
        guard lb > 0 else { return }
        let grams = Int((lb * 453.592).rounded())
        do {
            try await ChildrenRepository.recordWeight(childId: childId, valueGrams: grams)
            await load()
        } catch {
            alert = CappyAlert(title: "Couldn't save weight", message: error.localizedDescription)
        }
    }

    func addAllergy(_ allergen: Allergen) async {
        do {
            _ = try await AllergiesRepository.addChildAllergy(childId: childId, allergen: allergen.key, label: allergen.label)
            await load()
        } catch {
            alert = CappyAlert(title: "Couldn't add allergy", message: error.localizedDescription)
        }
    }

    func removeAllergy(_ id: String) async {
        do { try await AllergiesRepository.removeChildAllergy(id: id); await load() }
        catch { alert = CappyAlert(title: "Couldn't remove", message: error.localizedDescription) }
    }

    func uploadAvatar(familyId: String, jpeg: Data) async {
        do {
            try await AvatarsRepository.uploadChildAvatar(familyId: familyId, childId: childId, jpeg: jpeg)
            await load()
        } catch {
            alert = CappyAlert(title: "Couldn't update photo", message: error.localizedDescription)
        }
    }

    func rename(_ name: String) async {
        do { try await ChildrenRepository.updateChildDetails(childId: childId, displayName: name, dateOfBirth: nil); await load() }
        catch { alert = CappyAlert(title: "Couldn't rename", message: error.localizedDescription) }
    }

    func updateDOB(_ date: Date) async {
        do { try await ChildrenRepository.updateChildDetails(childId: childId, displayName: nil, dateOfBirth: date.yyyyMMdd); await load() }
        catch { alert = CappyAlert(title: "Couldn't update", message: error.localizedDescription) }
    }

    func delete(onDone: @escaping () -> Void) {
        alert = CappyAlert(title: "Remove this child?",
                           message: "Their dose history is preserved but they'll no longer appear in lists.",
                           primary: CappyAlertAction(label: "Remove", role: .destructive) {
            Task {
                do { try await ChildrenRepository.softDeleteChild(self.childId); onDone() }
                catch { self.alert = CappyAlert(title: "Couldn't remove", message: error.localizedDescription) }
            }
        })
    }
}
