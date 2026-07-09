//
//  DoseSheetViewModel.swift
//  Cappy
//
//  Orchestrates the core "log a dose" interaction: weight/age dosing for
//  children, manual entry for caregivers, server-authoritative safety timing,
//  two-caregiver race re-check (SAFE-3), and the success + reminder flow.
//  Port of app/src/screens/DoseSheetScreen.tsx.
//

import Foundation
import Combine

@MainActor
final class DoseSheetViewModel: ObservableObject {
    let resolved: ResolvedTag
    let med: Medication
    let kind: MedicationKind

    let recipients: [DoseRecipient]

    @Published var selected: DoseRecipient?
    @Published var manualAmount = ""
    @Published var givenAgoMin = 0

    // Loaded child-specific data.
    @Published var weightGrams: Int?
    @Published var weightRecordedAt: String?
    @Published var allergens: [String] = []
    @Published var brandKey: String?
    @Published var loadingChildData = false

    // Flow state.
    @Published var logging = false
    @Published var alert: CappyAlert?
    @Published var showSuccess = false
    @Published var successSubtitle: String?
    @Published var reminderEnabled = false

    private var reminderContext: (childId: String, name: String, nextSafeAt: String)?
    /// The dose row just inserted — target for an optional symptom note.
    @Published private(set) var lastLoggedDoseId: String?

    static let staleWeightDays = 90.0

    init(resolved: ResolvedTag, preselectRecipientId: String? = nil) {
        self.resolved = resolved
        self.med = resolved.medication
        self.kind = Dosing.kind(forGeneric: resolved.medication.genericName)
        var list: [DoseRecipient] = resolved.children.map { .child($0) }
        list += resolved.caregivers.map { .caregiver($0) }
        self.recipients = list
        if let preselectRecipientId, let match = list.first(where: { $0.id == preselectRecipientId }) {
            self.selected = match
        } else {
            self.selected = list.count == 1 ? list.first : nil
        }
        self.reminderEnabled = ReminderService.isEnabled
    }

    // MARK: Multi-child dosing
    //
    // One scan → several sick kids. Selection is multi; every child still
    // gets an individual weight-based dose and an individual safety check,
    // and ineligible children (allergy, too young, interval not met, 24h
    // max) are excluded with a visible reason rather than silently dosed.

    struct MultiChildState {
        var weightKg: Double?
        var allergens: [String] = []
        var loaded = false
    }

    @Published var multiMode = false
    @Published var multiSelectedIds: Set<String> = []
    @Published var multiStates: [String: MultiChildState] = [:]
    @Published var multiLoading = false

    var multiEligibleChildren: [ResolvedTag.ResolvedChild] {
        resolved.children.filter { multiSelectedIds.contains($0.id) }
    }

    func enterMultiMode() {
        // Carry an already-selected child into the multi selection.
        if case .child(let c)? = selected { multiSelectedIds.insert(c.id) }
        multiMode = true
        selected = nil
        Task { await loadMultiData() }
    }

    func exitMultiMode() {
        multiMode = false
        multiSelectedIds = []
    }

    func toggleMulti(_ child: ResolvedTag.ResolvedChild) {
        if multiSelectedIds.contains(child.id) { multiSelectedIds.remove(child.id) }
        else { multiSelectedIds.insert(child.id) }
        Task { await loadMultiData() }
    }

    func loadMultiData() async {
        multiLoading = true
        defer { multiLoading = false }
        await withTaskGroup(of: (String, MultiChildState).self) { group in
            for child in multiEligibleChildren where !(multiStates[child.id]?.loaded ?? false) {
                group.addTask {
                    var state = MultiChildState()
                    if let rec = try? await ChildrenRepository.getLatestWeightRecord(childId: child.id) {
                        state.weightKg = Double(rec.valueGrams) / 1000
                    }
                    if let rows = try? await AllergiesRepository.listChildAllergies(childId: child.id) {
                        state.allergens = rows.map(\.allergen)
                    }
                    state.loaded = true
                    return (child.id, state)
                }
            }
            for await (id, state) in group { multiStates[id] = state }
        }
    }

    /// Why a selected child can't be dosed right now, or nil if they can.
    func multiBlockReason(_ child: ResolvedTag.ResolvedChild) -> String? {
        let state = multiStates[child.id]
        let ageMonths = Dosing.ageMonthsFromDob(child.dateOfBirth)
        if Dosing.resolveAgeGate(ageMonths: ageMonths) == .emergency { return "Under 2 months — see a doctor" }
        if kind == .ibuprofen && Dosing.resolveAgeGate(ageMonths: ageMonths) == .infant { return "Ibuprofen not for under 6 months" }
        if let allergens = state?.allergens, Allergens.isAllergic(kind: kind, allergenKeys: allergens) { return "Allergy on file" }
        if child.status == .maxReached { return "24-hour max reached" }
        if child.status == .early || child.status == .recent {
            return child.nextSafeAt.map { "Too early — safe at \(CappyTime.clock($0))" } ?? "Too early"
        }
        if state?.weightKg == nil { return "No weight on file" }
        if multiDose(for: child) == nil { return "No dose available" }
        return nil
    }

    func multiDose(for child: ResolvedTag.ResolvedChild) -> MedDose? {
        guard let kg = multiStates[child.id]?.weightKg else { return nil }
        let ageMonths = Dosing.ageMonthsFromDob(child.dateOfBirth)
        return Dosing.dose(Dosing.computeDosing(weightKg: kg, ageMonths: ageMonths), for: kind)
    }

    func multiVolumeMl(for dose: MedDose) -> Double? {
        guard med.concentrationMgPerMl > 0 else { return nil }
        return (dose.recommendedMg / med.concentrationMgPerMl * 10).rounded() / 10
    }

    var multiLoggableChildren: [ResolvedTag.ResolvedChild] {
        multiEligibleChildren.filter { multiBlockReason($0) == nil }
    }

    /// Log one dose per eligible selected child, each with a fresh SAFE-3
    /// race re-check immediately before insert.
    func doLogMulti() async {
        let targets = multiLoggableChildren
        guard !targets.isEmpty else { return }
        logging = true
        defer { logging = false }
        var loggedCount = 0
        var skipped: [String] = []
        for child in targets {
            guard let dose = multiDose(for: child) else { skipped.append(child.displayName); continue }
            if let fresh = try? await DosesRepository.getDoseStatus(childId: child.id, medicationId: med.id),
               fresh.status == .early || fresh.status == .recent || fresh.status == .maxReached {
                skipped.append(child.displayName)
                continue
            }
            do {
                let event = try await DosesRepository.logDose(.init(
                    childId: child.id, familyId: resolved.family.id, medicationId: med.id,
                    givenAt: givenAt, amountMg: dose.recommendedMg,
                    amountVolumeMl: multiVolumeMl(for: dose)))
                lastLoggedDoseId = event.id
                loggedCount += 1
                if reminderEnabled,
                   let nextSafeAt = try? await DosesRepository.getDoseStatus(childId: child.id, medicationId: med.id).nextSafeAt {
                    _ = await ReminderService.scheduleNextDose(
                        childId: child.id, medicationId: med.id, recipientName: child.displayName,
                        medName: medDisplayName, nextSafeAt: nextSafeAt, tagUid: Tags.slug(forGeneric: kind))
                }
            } catch {
                skipped.append(child.displayName)
            }
        }
        guard loggedCount > 0 else {
            alert = CappyAlert(title: "No doses logged",
                               message: skipped.isEmpty ? "Nothing to log." : "Couldn't log for \(skipped.joined(separator: ", ")).")
            return
        }
        Haptics.success()
        var subtitle = "\(loggedCount) dose\(loggedCount == 1 ? "" : "s") logged"
        if !skipped.isEmpty { subtitle += " · skipped \(skipped.joined(separator: ", "))" }
        successSubtitle = subtitle
        reminderContext = nil
        showSuccess = true
    }

    // MARK: Selection

    var selectedChild: ResolvedTag.ResolvedChild? {
        if case .child(let c)? = selected { return c }
        return nil
    }
    var selectedCaregiver: ResolvedTag.ResolvedCaregiver? {
        if case .caregiver(let c)? = selected { return c }
        return nil
    }

    func select(_ recipient: DoseRecipient) {
        selected = recipient
    }

    func loadBrand() async {
        if let prefs = try? await BrandsRepository.getFamilyBrandPrefs(familyId: resolved.family.id) {
            brandKey = prefs[med.genericName]
        }
    }

    func loadChildData() async {
        guard let child = selectedChild else {
            weightGrams = nil; weightRecordedAt = nil; allergens = []
            return
        }
        loadingChildData = true
        defer { loadingChildData = false }
        if let rec = try? await ChildrenRepository.getLatestWeightRecord(childId: child.id) {
            weightGrams = rec.valueGrams
            weightRecordedAt = rec.recordedAt
        } else {
            weightGrams = nil
            weightRecordedAt = nil
        }
        if let rows = try? await AllergiesRepository.listChildAllergies(childId: child.id) {
            allergens = rows.map(\.allergen)
        } else {
            allergens = []
        }
    }

    // MARK: Derived

    var brand: Brand { Brands.brand(forGeneric: med.genericName, brandKey: brandKey) }
    var medDisplayName: String {
        brand.key != "generic" ? brand.name : (med.brandName ?? med.genericName)
    }

    var ageMonths: Int { selectedChild.map { Dosing.ageMonthsFromDob($0.dateOfBirth) } ?? 0 }
    var ageGate: AgeGate? { selectedChild != nil ? Dosing.resolveAgeGate(ageMonths: ageMonths) : nil }
    var weightKg: Double? { weightGrams.map { Double($0) / 1000 } }
    var allergic: Bool { Allergens.isAllergic(kind: kind, allergenKeys: allergens) }

    var weightStale: Bool {
        guard let recordedAt = weightRecordedAt, let date = CappyTime.date(from: recordedAt) else { return false }
        return Date().timeIntervalSince(date) > Self.staleWeightDays * 86400
    }

    var dosing: DosingResult? {
        guard let kg = weightKg else { return nil }
        return Dosing.computeDosing(weightKg: kg, ageMonths: ageMonths)
    }
    var medDose: MedDose? { dosing.flatMap { Dosing.dose($0, for: kind) } }

    var volumeMl: Double? {
        guard let dose = medDose, med.concentrationMgPerMl > 0 else { return nil }
        return (dose.recommendedMg / med.concentrationMgPerMl * 10).rounded() / 10
    }

    var childSafe: Bool {
        guard let c = selectedChild else { return false }
        return c.status == .due || c.status == .overdue
    }
    var maxReached: Bool { selectedChild?.status == .maxReached }

    var manualAmountValid: Bool {
        guard let value = Double(manualAmount) else { return false }
        return value > 0
    }

    private var givenAt: Date { Date().addingTimeInterval(-Double(givenAgoMin) * 60) }

    // MARK: Log flow

    func handleLog() {
        guard let selected else { return }
        switch selected {
        case .child(let child):
            if !childSafe, let nextSafe = child.nextSafeAt {
                alert = CappyAlert(
                    title: "Given recently",
                    message: "The minimum \(medDose?.intervalHours ?? 6)-hour interval hasn't elapsed. The next dose is safe \(CappyTime.timeUntil(nextSafe)) (at \(CappyTime.clock(nextSafe))). Log anyway?",
                    primary: CappyAlertAction(label: "Log anyway", role: .destructive) {
                        Task { await self.doLog(force: true) }
                    })
                return
            }
            Task { await doLog(force: false) }
        case .caregiver(let caregiver):
            guard manualAmountValid else { return }
            if caregiver.status == .early || caregiver.status == .recent || caregiver.status == .maxReached {
                let base = "\(caregiver.displayName ?? "This person") logged a dose recently."
                let tail = caregiver.nextSafeAt.map { " The next dose is safe \(CappyTime.timeUntil($0)) (at \(CappyTime.clock($0)))." } ?? ""
                alert = CappyAlert(
                    title: "Given recently", message: base + tail + " Log anyway?",
                    primary: CappyAlertAction(label: "Log anyway", role: .destructive) {
                        Task { await self.doLog(force: true) }
                    })
                return
            }
            Task { await doLog(force: false) }
        }
    }

    /// Confirm exceeding the 24-hour maximum (from the max-reached card).
    func confirmLogOverMax() {
        alert = CappyAlert(
            title: "Exceed the 24-hour maximum?",
            message: "Only log this if the dose was actually given. This exceeds the labeled daily limit.",
            primary: CappyAlertAction(label: "Log anyway", role: .destructive) {
                Task { await self.doLog(force: true) }
            })
    }

    func doLog(force: Bool) async {
        guard let selected else { return }
        logging = true
        defer { logging = false }
        do {
            switch selected {
            case .child(let child):
                guard let dose = medDose else { return }
                if !force {
                    // SAFE-3: re-check status immediately before insert.
                    if let fresh = try? await DosesRepository.getDoseStatus(childId: child.id, medicationId: med.id),
                       fresh.status == .early || fresh.status == .recent || fresh.status == .maxReached {
                        logging = false
                        let msg: String
                        if fresh.status == .maxReached {
                            msg = "This child has reached the 24-hour maximum for this medication. Log anyway?"
                        } else {
                            let ago = fresh.lastDoseAt.map { "Another caregiver logged a dose \(CappyTime.relative($0))." } ?? "Another caregiver just logged a dose."
                            let next = fresh.nextSafeAt.map { " The next dose is safe \(CappyTime.timeUntil($0)) (at \(CappyTime.clock($0)))." } ?? ""
                            msg = ago + next + " Log anyway?"
                        }
                        alert = CappyAlert(title: "A dose was just logged", message: msg,
                                           primary: CappyAlertAction(label: "Log anyway", role: .destructive) {
                            Task { await self.doLog(force: true) }
                        })
                        return
                    }
                }
                let event = try await DosesRepository.logDose(.init(
                    childId: child.id, familyId: resolved.family.id, medicationId: med.id,
                    givenAt: givenAt, amountMg: dose.recommendedMg, amountVolumeMl: volumeMl))
                lastLoggedDoseId = event.id
            case .caregiver(let caregiver):
                guard let value = Double(manualAmount), value > 0 else { return }
                let event = try await DosesRepository.logDose(.init(
                    caregiverUserId: caregiver.id, familyId: resolved.family.id, medicationId: med.id,
                    givenAt: givenAt, amountMg: value))
                lastLoggedDoseId = event.id
            }

            Haptics.success()

            // Authoritative post-log next_safe_at (child recipients only).
            var nextSafeAt: String?
            if case .child(let child) = selected {
                nextSafeAt = try? await DosesRepository.getDoseStatus(childId: child.id, medicationId: med.id).nextSafeAt
                successSubtitle = nextSafeAt.map { "Next dose safe at \(CappyTime.clock($0))" }
                if let nextSafeAt {
                    reminderContext = (child.id, child.displayName, nextSafeAt)
                    if reminderEnabled {
                        _ = await ReminderService.scheduleNextDose(
                            childId: child.id, medicationId: med.id, recipientName: child.displayName,
                            medName: medDisplayName, nextSafeAt: nextSafeAt, tagUid: Tags.slug(forGeneric: kind))
                    }
                    // Start a Live Activity counting down to the next safe dose.
                    LiveActivityController.start(childName: child.displayName,
                                                 medName: medDisplayName, nextSafeAtISO: nextSafeAt)
                }
            } else {
                successSubtitle = nil
                reminderContext = nil
            }
            showSuccess = true
        } catch {
            alert = CappyAlert(title: "Couldn't log", message: error.localizedDescription)
        }
    }

    /// Optional symptom/note capture on the success overlay. Saves onto the
    /// dose row just logged (server-enforced: logger only, 1-hour window).
    var symptomConfig: SuccessSymptomConfig? {
        guard let doseId = lastLoggedDoseId else { return nil }
        return SuccessSymptomConfig { [weak self] note in
            do {
                try await DosesRepository.setNote(doseEventId: doseId, note: note)
                return true
            } catch {
                await MainActor.run {
                    self?.alert = CappyAlert(title: "Couldn't save note", message: error.localizedDescription)
                }
                return false
            }
        }
    }

    var reminderConfig: SuccessReminderConfig? {
        guard let ctx = reminderContext else { return nil }
        return SuccessReminderConfig(enabled: reminderEnabled,
                                     label: "Remind me when the next dose is safe") { [weak self] enabled in
            guard let self else { return }
            self.reminderEnabled = enabled
            ReminderService.isEnabled = enabled
            Task {
                if enabled {
                    _ = await ReminderService.scheduleNextDose(
                        childId: ctx.childId, medicationId: self.med.id, recipientName: ctx.name,
                        medName: self.medDisplayName, nextSafeAt: ctx.nextSafeAt,
                        tagUid: Tags.slug(forGeneric: self.kind))
                } else {
                    ReminderService.cancel(childId: ctx.childId, medicationId: self.med.id)
                }
            }
        }
    }
}
