//
//  DoseSheetViewModel.swift
//  Cappy
//
//  The "log a dose" interaction, rebuilt around the dose-presentation state
//  machine of ¶[0006].
//
//  What changed and why it matters: the previous version computed
//  `medDose` / `volumeMl` as derived properties that were always available,
//  and the view decided in a chain of `else if`s whether to render them. That
//  is compute-then-conceal — the number existed on the model whatever the
//  safety state, and only a view branch stood between it and the screen.
//
//  Now the model exposes one `presentation`. When it is `.suppressed` there is
//  no quantity anywhere in it: not hidden, not nil-and-optional, absent from
//  the enum case. A future screen, a SwiftUI preview or an accessibility
//  label physically cannot read a dose the state machine did not release.
//
//  The evaluation itself is server-authoritative (only the server sees every
//  caregiver's doses) with a local fallback that fails closed.
//

import Foundation
import Combine

/// How this medication came to be identified, carried from the scan screen so
/// it can be recorded on the event (¶[0006]) and so a weakly bound
/// identification can be made to ask for confirmation (¶[0007]).
struct DoseAcquisition: Hashable {
    var channel: AcquisitionChannel = .manualConfirmed
    var binding: BindingStrength = .strong
    var identifier: String?
    var tagAssociationId: String?
    var medicationClass: String?

    static let manual = DoseAcquisition(channel: .manualConfirmed, binding: .strong)
    static func nfc(_ uid: String) -> DoseAcquisition {
        DoseAcquisition(channel: .nfc, binding: .strong, identifier: uid)
    }
    static func optical(_ uid: String) -> DoseAcquisition {
        DoseAcquisition(channel: .optical, binding: .strong, identifier: uid)
    }
}

@MainActor
final class DoseSheetViewModel: ObservableObject {
    let resolved: ResolvedTag
    let med: Medication
    /// nil when this build has no dosing rule for the medication. Fails
    /// closed — see `Dosing.kind(forGeneric:)`.
    let kind: MedicationKind?
    let acquisition: DoseAcquisition

    let recipients: [DoseRecipient]

    @Published var selected: DoseRecipient?
    @Published var manualAmount = ""
    @Published var givenAgoMin = 0

    /// The one thing the view renders a dose from.
    @Published private(set) var presentation: DosePresentation = .unavailable()
    @Published private(set) var evaluating = false

    /// ¶[0007]: a weakly bound identification is a candidate until a person
    /// affirms it. Strongly bound ones start confirmed, because the storage
    /// geometry already did the affirming.
    @Published private(set) var identificationConfirmed: Bool
    /// ¶[0052]: the caregiver's answer to "is anything missing from the log?"
    @Published private(set) var historyAttested = false

    // Loaded child-specific data, kept because the offline evaluator needs it.
    @Published var weightGrams: Int?
    @Published var weightRecordedAt: String?
    @Published var allergens: [String] = []
    @Published var brandKey: String?
    @Published var loadingChildData = false

    @Published var logging = false
    @Published var alert: CappyAlert?
    @Published var showSuccess = false
    @Published var successSubtitle: String?
    @Published var reminderEnabled = false

    private var reminderContext: (childId: String, name: String, nextSafeAt: String)?
    @Published private(set) var lastLoggedDoseId: String?
    private var openIntentId: String?

    init(resolved: ResolvedTag, preselectRecipientId: String? = nil,
         acquisition: DoseAcquisition = .manual) {
        self.resolved = resolved
        self.med = resolved.medication
        self.kind = Dosing.kind(forGeneric: resolved.medication.genericName)
        self.acquisition = acquisition
        self.identificationConfirmed = !acquisition.binding.requiresAffirmativeConfirmation

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

    // MARK: Identification (¶[0007])

    var needsIdentificationConfirmation: Bool {
        acquisition.binding.requiresAffirmativeConfirmation && !identificationConfirmed
    }

    func confirmIdentification() {
        identificationConfirmed = true
        Task { await evaluate() }
    }

    /// ¶[0052]: the caregiver confirms nothing is missing from the record.
    /// Recorded on the event, so a later reader can see the answer was given
    /// rather than assumed.
    func attestHistoryComplete() {
        historyAttested = true
        UnloggedDoseService.shared.dueIntents()
            .filter { $0.medicationId == med.id }
            .forEach { UnloggedDoseService.shared.dismiss($0.id) }
        Task { await evaluate() }
    }

    // MARK: Loading

    func loadBrand() async {
        if let prefs = try? await BrandsRepository.getFamilyBrandPrefs(familyId: resolved.family.id) {
            brandKey = prefs[med.genericName]
        }
    }

    func loadChildData() async {
        guard let child = selectedChild else {
            weightGrams = nil; weightRecordedAt = nil; allergens = []
            if selected != nil { await evaluate() } else { presentation = .unavailable() }
            return
        }
        loadingChildData = true
        if let rec = try? await ChildrenRepository.getLatestWeightRecord(childId: child.id) {
            weightGrams = rec.valueGrams
            weightRecordedAt = rec.recordedAt
        } else {
            weightGrams = nil
            weightRecordedAt = nil
        }
        allergens = (try? await AllergiesRepository.listChildAllergies(childId: child.id))?.map(\.allergen) ?? []
        loadingChildData = false

        await evaluate()
        // Keep the offline cache warm while there is a network to do it with.
        await DosesRepository.refreshLocalHistory(childId: child.id, caregiverUserId: nil)
    }

    // MARK: The state machine

    private func query(historyAttested: Bool? = nil) -> DosePresentationRepository.Query? {
        guard let selected else { return nil }
        var q = DosePresentationRepository.Query(
            medicationId: med.id,
            childId: selectedChild?.id,
            caregiverUserId: selectedCaregiver?.id)
        q.bindingStrength = acquisition.binding
        q.identificationConfirmed = identificationConfirmed
        q.historyAttested = historyAttested ?? self.historyAttested
        q.genericName = med.genericName
        q.concentrationMgPerMl = med.concentrationMgPerMl
        if case .child(let child) = selected {
            q.dateOfBirth = CappyTime.date(from: child.dateOfBirth)
                ?? ISO8601DateFormatter().date(from: child.dateOfBirth + "T00:00:00Z")
            q.weightGrams = weightGrams
            q.weightRecordedAt = weightRecordedAt.flatMap(CappyTime.date(from:))
            q.allergenKeys = allergens
        }
        return q
    }

    func evaluate() async {
        guard let q = query() else {
            presentation = .unavailable()
            return
        }
        // A medication this build cannot dose never reaches the server: it is
        // an unresolved identification, and that is the first precondition.
        guard kind != nil || !q.medicationId.isEmpty else {
            presentation = .suppressed([.medicationUnresolved], DoseFacts())
            return
        }
        evaluating = true
        presentation = await DosePresentationRepository.evaluate(q)
        evaluating = false

        openScanIntentIfNeeded()
    }

    /// ¶[0052]: the moment dosing information is presented for a chosen family
    /// member is the moment a caregiver has enough to draw up a dose and walk
    /// away from the phone. That is what gets recorded as an intent.
    private func openScanIntentIfNeeded() {
        guard openIntentId == nil, let selected else { return }
        // A screen showing a refusal is not an about-to-dose moment.
        let actionable = presentation.isReleased || presentation.isOverridable
        guard actionable else { return }

        let intent = UnloggedDoseService.shared.open(
            familyId: resolved.family.id,
            medicationId: med.id,
            medicationName: medDisplayName,
            // Falls back to the medication's well-known slug so the reminder
            // can re-open the right dose sheet even when the medication was
            // picked by hand rather than tapped.
            tagUid: acquisition.identifier ?? kind.flatMap(Tags.slug(forGeneric:)),
            channel: acquisition.channel,
            binding: acquisition.binding,
            childId: selectedChild?.id,
            caregiverUserId: selectedCaregiver?.id,
            recipientName: selected.name,
            doseReleased: presentation.isReleased)
        openIntentId = intent.id
    }

    // MARK: Multi-child dosing
    //
    // One scan, several sick kids. Each child is evaluated independently
    // through the same state machine — same weight gate, same interlocks, same
    // suppression — because "they're both sick" is not a reason to compute one
    // child's dose from another child's preconditions. A child who cannot be
    // dosed is listed with the reason rather than quietly dropped, so the
    // caregiver knows who was skipped and why.

    @Published var multiMode = false
    @Published var multiSelectedIds: Set<String> = []
    @Published var multiPresentations: [String: DosePresentation] = [:]
    @Published var multiLoading = false

    private var multiChildData: [String: (weightGrams: Int?, recordedAt: Date?, allergens: [String])] = [:]

    var multiEligibleChildren: [ResolvedTag.ResolvedChild] {
        resolved.children.filter { multiSelectedIds.contains($0.id) }
    }

    var multiLoggableChildren: [ResolvedTag.ResolvedChild] {
        multiEligibleChildren.filter { multiPresentations[$0.id]?.isReleased == true }
    }

    func enterMultiMode() {
        if case .child(let c)? = selected { multiSelectedIds.insert(c.id) }
        multiMode = true
        selected = nil
        openIntentId = nil
        Task { await loadMultiData() }
    }

    func exitMultiMode() {
        multiMode = false
        multiSelectedIds = []
        multiPresentations = [:]
    }

    func toggleMulti(_ child: ResolvedTag.ResolvedChild) {
        if multiSelectedIds.contains(child.id) {
            multiSelectedIds.remove(child.id)
            multiPresentations[child.id] = nil
        } else {
            multiSelectedIds.insert(child.id)
        }
        Task { await loadMultiData() }
    }

    func loadMultiData() async {
        multiLoading = true
        defer { multiLoading = false }

        await withTaskGroup(of: (String, Int?, Date?, [String]).self) { group in
            for child in multiEligibleChildren where multiChildData[child.id] == nil {
                group.addTask {
                    let record = try? await ChildrenRepository.getLatestWeightRecord(childId: child.id)
                    let allergies = (try? await AllergiesRepository.listChildAllergies(childId: child.id))?
                        .map(\.allergen) ?? []
                    return (child.id, record?.valueGrams,
                            record.flatMap { CappyTime.date(from: $0.recordedAt) }, allergies)
                }
            }
            for await (id, grams, at, allergens) in group {
                multiChildData[id] = (grams, at, allergens)
            }
        }

        for child in multiEligibleChildren {
            multiPresentations[child.id] = await evaluate(child: child)
        }
    }

    private func evaluate(child: ResolvedTag.ResolvedChild,
                          historyAttested: Bool = false) async -> DosePresentation {
        let data = multiChildData[child.id]
        var q = DosePresentationRepository.Query(medicationId: med.id, childId: child.id,
                                                 caregiverUserId: nil)
        q.bindingStrength = acquisition.binding
        q.identificationConfirmed = identificationConfirmed
        q.historyAttested = historyAttested
        q.genericName = med.genericName
        q.concentrationMgPerMl = med.concentrationMgPerMl
        q.dateOfBirth = CappyTime.date(from: child.dateOfBirth)
            ?? ISO8601DateFormatter().date(from: child.dateOfBirth + "T00:00:00Z")
        q.weightGrams = data?.weightGrams
        q.weightRecordedAt = data?.recordedAt
        q.allergenKeys = data?.allergens ?? []
        return await DosePresentationRepository.evaluate(q)
    }

    /// Why this child cannot be dosed right now, in the caregiver's words, or
    /// nil when they can.
    func multiBlockReason(_ child: ResolvedTag.ResolvedChild) -> String? {
        guard let presentation = multiPresentations[child.id] else { return "Checking…" }
        guard let reason = presentation.primaryReason else { return nil }
        return reason.shortLabel(recipient: child.displayName, facts: presentation.facts)
    }

    func multiQuantity(for child: ResolvedTag.ResolvedChild) -> DoseQuantity? {
        multiPresentations[child.id]?.quantity
    }

    /// Log one dose per releasable child, each re-checked immediately before
    /// its own write.
    func doLogMulti() async {
        let targets = multiLoggableChildren
        guard !targets.isEmpty else { return }
        logging = true
        defer { logging = false }

        var logged = 0
        var skipped: [String] = []

        for child in targets {
            let fresh = await evaluate(child: child)
            multiPresentations[child.id] = fresh
            guard let quantity = fresh.quantity else {
                skipped.append(child.displayName)
                continue
            }

            let stamp = ClockSync.stamp(givenAt: givenAt)
            let event = PendingDoseEvent(
                id: UUID().uuidString,
                familyId: resolved.family.id,
                childId: child.id,
                caregiverUserId: nil,
                medicationId: med.id,
                givenAt: stamp.givenAt,
                amountMg: quantity.mg,
                amountVolumeMl: quantity.volumeMl,
                unitCount: nil,
                note: nil,
                acquisitionChannel: acquisition.channel,
                bindingStrength: acquisition.binding,
                identifierPresented: acquisition.identifier,
                tagAssociationId: acquisition.tagAssociationId,
                identifiedClass: acquisition.medicationClass,
                unrecordedDosesAttested: nil,
                givenAtUtcOffsetMinutes: stamp.utcOffsetMinutes,
                deviceId: stamp.deviceId,
                observedClockSkewMs: stamp.observedClockSkewMs,
                timeUncertaintyMs: stamp.timeUncertaintyMs,
                createdAtDevice: stamp.createdAtDevice)

            DoseOutbox.shared.enqueue(event)
            LocalDoseHistory.shared.note(event)
            lastLoggedDoseId = event.id
            UnloggedDoseService.shared.resolve(medicationId: med.id, childId: child.id,
                                                caregiverUserId: nil)
            logged += 1

            if reminderEnabled {
                let after = await evaluate(child: child)
                if let next = after.facts.nextSafeAt {
                    _ = await ReminderService.scheduleNextDose(
                        childId: child.id, medicationId: med.id, recipientName: child.displayName,
                        medName: medDisplayName, nextSafeAt: next.iso,
                        tagUid: kind.flatMap(Tags.slug(forGeneric:)))
                }
            }
        }

        guard logged > 0 else {
            alert = CappyAlert(title: "No doses logged",
                               message: skipped.isEmpty ? "Nothing to log."
                                                        : "Couldn't log for \(skipped.joined(separator: ", ")).")
            return
        }
        Haptics.success()
        var subtitle = "\(logged) dose\(logged == 1 ? "" : "s") logged"
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
        guard selected?.id != recipient.id else { return }
        selected = recipient
        openIntentId = nil
        historyAttested = false
        presentation = .unavailable()
    }

    // MARK: Derived

    var brand: Brand { Brands.brand(forGeneric: med.genericName, brandKey: brandKey) }
    var medDisplayName: String {
        brand.key != "generic" ? brand.name : (med.brandName ?? med.genericName)
    }
    var manualAmountValid: Bool { (Double(manualAmount) ?? 0) > 0 }

    private var givenAt: Date { Date().addingTimeInterval(-Double(givenAgoMin) * 60) }

    /// Copy for the primary button, which never names an amount the state
    /// machine has not released.
    var logButtonLabel: String {
        if case .released(let quantity?, _) = presentation {
            if let ml = quantity.displayMl { return "Log \(CappyFormat.trim(ml)) mL now" }
            return "Log \(quantity.displayMg) mg now"
        }
        return "Log dose now"
    }

    // MARK: Log flow

    func handleLog() {
        switch presentation {
        case .released:
            Task { await doLog(force: false) }
        case .suppressed(let reasons, let facts):
            // Only a caregiver-overridable block offers a way through, and it
            // states plainly what is being passed.
            guard presentation.isOverridable, let primary = reasons.first else { return }
            let name = selected?.name ?? "this person"
            alert = CappyAlert(
                title: primary.title(recipient: name),
                message: primary.detail(recipient: name, facts: facts, medication: medDisplayName)
                    + "\n\nOnly log this if the dose was actually given.",
                primary: CappyAlertAction(label: "Log anyway", role: .destructive) {
                    Task { await self.doLog(force: true) }
                })
        }
    }

    func doLog(force: Bool) async {
        guard let selected else { return }
        logging = true
        defer { logging = false }

        // Re-check immediately before writing. Two caregivers can be standing
        // in the same kitchen, and the sheet may have been open for minutes.
        if !force {
            await evaluate()
            if case .suppressed(let reasons, let facts) = presentation {
                logging = false
                let name = selected.name
                let primary = reasons.first ?? .statusUnavailable
                alert = CappyAlert(
                    title: primary.title(recipient: name),
                    message: primary.detail(recipient: name, facts: facts, medication: medDisplayName),
                    primary: presentation.isOverridable
                        ? CappyAlertAction(label: "Log anyway", role: .destructive) {
                            Task { await self.doLog(force: true) }
                          }
                        : nil)
                return
            }
        }

        // The amount. For a child it comes from the released quantity and
        // nowhere else — there is no fallback that reconstructs a dose the
        // state machine withheld.
        let amountMg: Double
        let volumeMl: Double?
        switch selected {
        case .child:
            guard let quantity = presentation.quantity else {
                alert = CappyAlert(title: "No dose to log",
                                   message: "Cappy doesn't have a dose for this yet.")
                return
            }
            amountMg = quantity.mg
            volumeMl = quantity.volumeMl
        case .caregiver:
            guard let value = Double(manualAmount), value > 0 else { return }
            amountMg = value
            volumeMl = nil
        }

        let stamp = ClockSync.stamp(givenAt: givenAt)
        let event = PendingDoseEvent(
            id: UUID().uuidString,
            familyId: resolved.family.id,
            childId: selectedChild?.id,
            caregiverUserId: selectedCaregiver?.id,
            medicationId: med.id,
            givenAt: stamp.givenAt,
            amountMg: amountMg,
            amountVolumeMl: volumeMl,
            unitCount: nil,
            note: nil,
            acquisitionChannel: acquisition.channel,
            bindingStrength: acquisition.binding,
            identifierPresented: acquisition.identifier,
            tagAssociationId: acquisition.tagAssociationId,
            identifiedClass: acquisition.medicationClass,
            unrecordedDosesAttested: historyAttested ? false : nil,
            givenAtUtcOffsetMinutes: stamp.utcOffsetMinutes,
            deviceId: stamp.deviceId,
            observedClockSkewMs: stamp.observedClockSkewMs,
            timeUncertaintyMs: stamp.timeUncertaintyMs,
            createdAtDevice: stamp.createdAtDevice)

        // Local first: the dose was given whether or not there is signal.
        DoseOutbox.shared.enqueue(event)
        LocalDoseHistory.shared.note(event)
        lastLoggedDoseId = event.id
        UnloggedDoseService.shared.resolve(medicationId: med.id,
                                           childId: selectedChild?.id,
                                           caregiverUserId: selectedCaregiver?.id)
        Haptics.success()

        await afterLog(event: event)
        showSuccess = true
    }

    private func afterLog(event: PendingDoseEvent) async {
        guard let child = selectedChild else {
            successSubtitle = nil
            reminderContext = nil
            return
        }
        // Re-ask for the authoritative next-safe time now the dose is in.
        await evaluate()
        guard let next = presentation.facts.nextSafeAt else {
            successSubtitle = nil
            reminderContext = nil
            return
        }
        successSubtitle = "Next dose safe at \(CappyTime.clock(next))"
        reminderContext = (child.id, child.displayName, next.iso)
        if reminderEnabled {
            _ = await ReminderService.scheduleNextDose(
                childId: child.id, medicationId: med.id, recipientName: child.displayName,
                medName: medDisplayName, nextSafeAt: next.iso,
                tagUid: kind.flatMap(Tags.slug(forGeneric:)))
        }
        LiveActivityController.start(childName: child.displayName,
                                     medName: medDisplayName, nextSafeAtISO: next.iso)
    }

    // MARK: Success overlay extras

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
                        tagUid: self.kind.flatMap(Tags.slug(forGeneric:)))
                } else {
                    ReminderService.cancel(childId: ctx.childId, medicationId: self.med.id)
                }
            }
        }
    }
}
