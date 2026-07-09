//
//  DoseSheetView.swift
//  Cappy
//
//  The quick-action dose screen. Port of app/src/screens/DoseSheetScreen.tsx.
//

import SwiftUI

struct DoseSheetView: View {
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm: DoseSheetViewModel

    private let givenOptions: [SegmentedOption<Int>] = [
        .init(value: 0, label: "Now"), .init(value: 30, label: "30m ago"),
        .init(value: 60, label: "1h ago"), .init(value: 120, label: "2h ago")
    ]

    init(resolved: ResolvedTag, preselectRecipientId: String? = nil) {
        _vm = StateObject(wrappedValue: DoseSheetViewModel(resolved: resolved,
                                                           preselectRecipientId: preselectRecipientId))
    }

    var body: some View {
        ZStack {
            theme.tokens.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Space.lg) {
                    header
                    if vm.recipients.count > 1 { recipientPicker }
                    if vm.multiMode {
                        multiBody
                    } else {
                        body(for: vm.selected)
                    }
                }
                .padding(Space.lg)
            }
            if vm.showSuccess {
                SuccessOverlay(isPresented: $vm.showSuccess, subtitle: vm.successSubtitle,
                               reminder: vm.reminderConfig, symptoms: vm.symptomConfig) { dismiss() }
            }
        }
        .cappyAlert($vm.alert)
        .task { await vm.loadBrand() }
        .task(id: vm.selected?.id) { await vm.loadChildData() }
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Log a dose")
                    .font(CappyFont.display(FontSizeToken.xxl))
                    .foregroundStyle(theme.tokens.fg1)
                Text("\(vm.medDisplayName) · \(vm.med.concentrationLabel)")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg2)
            }
            Spacer()
            Button("Close") { dismiss() }
                .font(CappyFont.sansSemibold(FontSizeToken.base))
                .foregroundStyle(theme.tokens.fg2)
        }
    }

    // MARK: Recipient picker

    private var recipientPicker: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack {
                SectionLabel(text: vm.multiMode ? "Who's getting doses?" : "Who's getting a dose?")
                Spacer()
                // One scan, several sick kids: switch the picker to multi-select.
                if vm.resolved.children.count > 1 {
                    Button(vm.multiMode ? "Single" : "Select multiple") {
                        withAnimation(.easeInOut(duration: Motion.fast)) {
                            vm.multiMode ? vm.exitMultiMode() : vm.enterMultiMode()
                        }
                    }
                    .font(CappyFont.sansSemibold(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.link)
                }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Space.md) {
                    if vm.multiMode {
                        ForEach(vm.resolved.children, id: \.id) { child in
                            let active = vm.multiSelectedIds.contains(child.id)
                            Button { vm.toggleMulti(child) } label: {
                                VStack(spacing: 4) {
                                    MemberAvatar(avatarPath: child.avatarUrl,
                                                 initials: CappyFormat.initials(from: child.displayName),
                                                 size: .lg)
                                        .padding(2)
                                        .overlay(Circle().stroke(active ? theme.tokens.brand : .clear, lineWidth: 3))
                                        .overlay(alignment: .bottomTrailing) {
                                            if active {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .foregroundStyle(theme.tokens.brand)
                                                    .background(Circle().fill(theme.tokens.bgCard))
                                            }
                                        }
                                    Text(child.displayName)
                                        .font(active ? CappyFont.sansSemibold(FontSizeToken.xs) : CappyFont.sans(FontSizeToken.xs))
                                        .foregroundStyle(active ? theme.tokens.fg1 : theme.tokens.fg2)
                                        .lineLimit(1)
                                }
                                .frame(width: 76)
                            }
                            .buttonStyle(.plain)
                        }
                    } else {
                        ForEach(vm.recipients) { recipient in
                            let active = vm.selected?.id == recipient.id
                            Button { vm.select(recipient) } label: {
                                VStack(spacing: 4) {
                                    MemberAvatar(avatarPath: recipient.avatarUrl,
                                                 initials: CappyFormat.initials(from: recipient.name),
                                                 size: .lg)
                                        .padding(2)
                                        .overlay(Circle().stroke(active ? theme.tokens.brand : .clear, lineWidth: 3))
                                    Text(recipient.name)
                                        .font(active ? CappyFont.sansSemibold(FontSizeToken.xs) : CappyFont.sans(FontSizeToken.xs))
                                        .foregroundStyle(active ? theme.tokens.fg1 : theme.tokens.fg2)
                                        .lineLimit(1)
                                }
                                .frame(width: 76)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    // MARK: Multi-child dosing

    @ViewBuilder private var multiBody: some View {
        if vm.multiSelectedIds.isEmpty {
            Card(inset: true) {
                Text("Tap each child who's getting \(vm.medDisplayName).")
                    .font(CappyFont.sans(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg2)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
        } else {
            VStack(alignment: .leading, spacing: Space.lg) {
                Card(inset: true, topAccent: vm.brand.accent) {
                    VStack(alignment: .leading, spacing: Space.md) {
                        SectionLabel(text: "Doses to log")
                        if vm.multiLoading { ProgressView().tint(theme.tokens.brand) }
                        ForEach(vm.multiEligibleChildren, id: \.id) { child in
                            multiRow(child)
                        }
                    }
                }
                whenGiven(label: "When were they given?")
                CappyButton(label: multiButtonLabel, variant: .blue, size: .lg, block: true, loading: vm.logging) {
                    Task { await vm.doLogMulti() }
                }
                .disabled(vm.logging || vm.multiLoggableChildren.isEmpty)
                CappyButton(label: "Cancel", variant: .ghost, block: true) { dismiss() }
            }
        }
    }

    private var multiButtonLabel: String {
        let count = vm.multiLoggableChildren.count
        return count == 0 ? "No doses to log" : "Log \(count) dose\(count == 1 ? "" : "s") now"
    }

    private func multiRow(_ child: ResolvedTag.ResolvedChild) -> some View {
        HStack(spacing: Space.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(child.displayName)
                    .font(CappyFont.sansSemibold(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg1)
                if let reason = vm.multiBlockReason(child) {
                    Text(reason)
                        .font(CappyFont.sans(FontSizeToken.xs))
                        .foregroundStyle(theme.tokens.warn)
                } else if let dose = vm.multiDose(for: child) {
                    Text(vm.multiVolumeMl(for: dose).map { "\(CappyFormat.trim($0)) mL · \(dose.displayMg) mg" } ?? "\(dose.displayMg) mg")
                        .font(CappyFont.sans(FontSizeToken.xs))
                        .foregroundStyle(theme.tokens.fg3)
                }
            }
            Spacer()
            if vm.multiBlockReason(child) == nil {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(theme.tokens.success)
            } else {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(theme.tokens.warn)
            }
        }
    }

    // MARK: Body per recipient

    @ViewBuilder private func body(for recipient: DoseRecipient?) -> some View {
        if let recipient {
            switch recipient {
            case .caregiver(let caregiver): caregiverBody(caregiver)
            case .child(let child): childBody(child)
            }
        } else {
            Card(inset: true) {
                VStack(spacing: 8) {
                    Image(systemName: "person.2").font(.system(size: 32)).foregroundStyle(theme.tokens.fgMuted)
                    Text("Select a family member above to see their dose.")
                        .font(CappyFont.sans(FontSizeToken.base))
                        .foregroundStyle(theme.tokens.fg2)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
        }
    }

    // MARK: Caregiver

    private func caregiverBody(_ caregiver: ResolvedTag.ResolvedCaregiver) -> some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            Card(inset: true, topAccent: vm.brand.accent) {
                VStack(spacing: Space.sm) {
                    SectionLabel(text: "Current status")
                    DosePill(label: caregiver.status.caregiverLabel, status: caregiver.status)
                    DoseSafetyText(text: (caregiver.lastDoseAt != nil
                        ? "Last dose \(CappyTime.relative(caregiver.lastDoseAt))."
                        : "No prior dose logged.") + " Cappy doesn't calculate an adult dose — enter the amount from the product label.",
                        alignment: .center)
                }
                .frame(maxWidth: .infinity)
            }
            CappyTextField(label: "Amount taken (mg)", placeholder: "e.g. 500", text: $vm.manualAmount,
                           hint: "\(vm.med.brandName ?? vm.med.genericName) — check the product label for the correct adult dose.",
                           keyboard: .decimalPad)
            whenGiven(label: "When was it taken?")
            CappyButton(label: "Log dose now", variant: .blue, size: .lg, block: true, loading: vm.logging) {
                vm.handleLog()
            }
            .disabled(vm.logging || !vm.manualAmountValid)
            CappyButton(label: "Cancel", variant: .ghost, block: true) { dismiss() }
        }
    }

    // MARK: Child

    @ViewBuilder private func childBody(_ child: ResolvedTag.ResolvedChild) -> some View {
        if vm.loadingChildData {
            Card(inset: true) {
                Text("Loading…").foregroundStyle(theme.tokens.fg2).frame(maxWidth: .infinity).padding(.vertical, 12)
            }
        } else if vm.ageGate == .emergency {
            warningCard(title: "Too young for self-dosing", titleColor: theme.tokens.error,
                        body: "For infants under 2 months, do not give medication at home. Contact your pediatrician or seek care for fever in this age group.")
        } else if vm.allergic {
            warningCard(title: "Allergy on file", titleColor: theme.tokens.error,
                        body: "\(child.displayName) has a recorded allergy to \(vm.med.genericName). Cappy will not recommend this medication. Remove the allergy on the child's profile if this is incorrect.")
        } else if vm.maxReached {
            maxReachedCard(child)
        } else if vm.kind == .ibuprofen && vm.ageGate == .infant {
            warningCard(title: "Ibuprofen not recommended", titleColor: theme.tokens.fg1,
                        body: Dosing.ibuprofenUnder6Months)
        } else if vm.weightKg == nil {
            weightMissingCard(child)
        } else if let dose = vm.medDose {
            doseCard(child, dose: dose)
        }
    }

    private func doseCard(_ child: ResolvedTag.ResolvedChild, dose: MedDose) -> some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            Card(inset: true, topAccent: vm.brand.accent) {
                VStack(spacing: Space.sm) {
                    SectionLabel(text: "Recommended dose")
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(vm.volumeMl != nil ? CappyFormat.trim(vm.volumeMl!) : "\(dose.displayMg)")
                            .font(CappyFont.display(FontSizeToken.doseNumeral))
                            .foregroundStyle(vm.brand.accent)
                        Text(vm.volumeMl != nil ? "mL" : "mg")
                            .font(CappyFont.mono(FontSizeToken.lg))
                            .foregroundStyle(vm.brand.accent)
                    }
                    Text("\(dose.displayMg) mg · \(dose.frequencyLabel)")
                        .font(CappyFont.sans(FontSizeToken.sm))
                        .foregroundStyle(theme.tokens.fg3)

                    DosePill(label: pillLabel(child), status: pillStatus(child))
                    DoseSafetyText(text: safetyText(child, dose: dose), alignment: .center)
                    DoseSafetyText(text: "\(child.dosesInLast24h) of \(vm.med.maxDosesPer24h) doses in the last 24 hours.", alignment: .center)
                    if dose.capped, let reminder = vm.dosing?.spacingReminder {
                        DoseSafetyText(text: reminder, alignment: .center)
                    }
                    if vm.weightStale, let recordedAt = vm.weightRecordedAt {
                        DoseSafetyText(text: "Weight last updated \(CappyTime.relative(recordedAt)) — update it for an accurate dose.", alignment: .center)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            whenGiven(label: "When was it given?")
            CappyButton(label: "Log \(vm.volumeMl != nil ? "\(CappyFormat.trim(vm.volumeMl!)) mL" : "\(dose.displayMg) mg") now",
                        variant: .blue, size: .lg, block: true, loading: vm.logging) {
                vm.handleLog()
            }
            .disabled(vm.logging)
            CappyButton(label: "Cancel", variant: .ghost, block: true) { dismiss() }
        }
    }

    private func pillLabel(_ child: ResolvedTag.ResolvedChild) -> String {
        if vm.childSafe { return child.lastDoseAt != nil ? "OK to give now" : "No prior dose" }
        return child.status == .unknown ? "Status unavailable" : "Too early"
    }
    private func pillStatus(_ child: ResolvedTag.ResolvedChild) -> DoseStatus {
        vm.childSafe ? .due : (child.status == .unknown ? .unknown : .early)
    }
    private func safetyText(_ child: ResolvedTag.ResolvedChild, dose: MedDose) -> String {
        if vm.childSafe {
            return child.lastDoseAt != nil
                ? "Minimum \(dose.intervalHours)-hour interval met. Always confirm against the product label."
                : "No prior dose logged. Always confirm against the product label."
        }
        if let nextSafe = child.nextSafeAt {
            return "Last dose too recent. Next dose is safe \(CappyTime.timeUntil(nextSafe)) (at \(CappyTime.clock(nextSafe)))."
        }
        return child.status == .unknown
            ? "Couldn't check the last dose right now — Cappy will re-check when you log." : ""
    }

    private func maxReachedCard(_ child: ResolvedTag.ResolvedChild) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                Text("24-hour limit reached")
                    .font(CappyFont.displaySemibold(FontSizeToken.lg))
                    .foregroundStyle(theme.tokens.error)
                Text(maxReachedBody(child))
                    .font(CappyFont.sans(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg2)
                if vm.medDose != nil {
                    CappyButton(label: "Log anyway", variant: .ghost, block: true) { vm.confirmLogOverMax() }
                }
            }
        }
        .overlay(RoundedRectangle(cornerRadius: Radius.base).stroke(theme.tokens.error, lineWidth: 1))
    }
    private func maxReachedBody(_ child: ResolvedTag.ResolvedChild) -> String {
        let doses = child.dosesInLast24h
        let next = child.nextSafeAt.map { " The next dose is safe \(CappyTime.timeUntil($0)) (at \(CappyTime.clock($0)))." } ?? ""
        return "\(child.displayName) has had \(doses) dose\(doses == 1 ? "" : "s") of \(vm.med.genericName) in the last 24 hours — the maximum is \(vm.med.maxDosesPer24h).\(next) If fever or pain persists, contact your pediatrician."
    }

    private func weightMissingCard(_ child: ResolvedTag.ResolvedChild) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                Text("Add a weight for \(child.displayName)")
                    .font(CappyFont.displaySemibold(FontSizeToken.lg))
                    .foregroundStyle(theme.tokens.fg1)
                Text("Dosing is based on current weight. Add \(child.displayName)'s weight to see a recommended dose.")
                    .font(CappyFont.sans(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg2)
                Text("Open \(child.displayName)'s profile from Home to add a weight.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg3)
            }
        }
    }

    private func warningCard(title: String, titleColor: Color, body: String) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(CappyFont.displaySemibold(FontSizeToken.lg)).foregroundStyle(titleColor)
                Text(body).font(CappyFont.sans(FontSizeToken.base)).foregroundStyle(theme.tokens.fg2)
            }
        }
        .overlay(RoundedRectangle(cornerRadius: Radius.base).stroke(theme.tokens.error, lineWidth: 1))
    }

    private func whenGiven(label: String) -> some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionLabel(text: label)
            SegmentedControl(options: givenOptions, selection: $vm.givenAgoMin)
        }
    }
}
