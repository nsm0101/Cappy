//
//  NotificationSettingsView.swift
//  Cappy
//
//  Which notifications this caregiver wants, and when they are allowed to make
//  a sound.
//
//  The screen has an opinion, and it is worth stating: two of these rows do not
//  have a switch. An interaction warning and a 24-hour maximum are not news
//  about somebody else's activity — they are the interlocks of ¶[0051]
//  reaching a caregiver who is about to act on information they don't have.
//  A household where one parent has turned those off is a household where the
//  interlock quietly stops working for half the people it protects.
//
//  Rather than render a switch that refuses to move, those rows show a lock
//  and say why. A disabled switch reads as a bug; a lock with a sentence reads
//  as a decision, and the caregiver can disagree with it out loud instead of
//  tapping at something broken.
//
//  Everything else is genuinely theirs, including "next dose window opens",
//  which is off unless asked for: it is the one event that prompts someone to
//  medicate rather than telling them what already happened.
//

import SwiftUI

@MainActor
final class NotificationSettingsViewModel: ObservableObject {
    @Published var catalog: [NotificationEventInfo] = []
    @Published var enabled: [NotificationEvent: Bool] = [:]
    @Published var quietStart: Date?
    @Published var quietEnd: Date?
    @Published var loading = true
    @Published var alert: CappyAlert?

    private var familyId: String?

    func load(familyId: String) async {
        self.familyId = familyId
        loading = true
        defer { loading = false }
        do {
            catalog = try await NotificationPrefsRepository.catalog()
            let prefs = try await NotificationPrefsRepository.prefs(familyId: familyId)
            // Family-wide rows only; per-medication overrides are a later
            // disclosure and would make this screen a grid nobody reads.
            var map: [NotificationEvent: Bool] = [:]
            for info in catalog { map[info.eventType] = info.defaultEnabled }
            for pref in prefs where pref.medicationId == nil {
                map[pref.eventType] = pref.enabled
            }
            enabled = map

            let quiet = try await NotificationPrefsRepository.quietHours()
            quietStart = Self.time(from: quiet.start)
            quietEnd = Self.time(from: quiet.end)
        } catch {
            alert = CappyAlert(title: "Couldn't load notification settings",
                               message: error.localizedDescription)
        }
    }

    func set(_ event: NotificationEvent, _ value: Bool) {
        enabled[event] = value
        guard let familyId else { return }
        Task {
            do {
                try await NotificationPrefsRepository.set(familyId: familyId, event: event, enabled: value)
            } catch {
                // Put the switch back rather than leaving the UI asserting
                // something the server does not believe.
                enabled[event] = !value
                alert = CappyAlert(title: "Couldn't save", message: error.localizedDescription)
            }
        }
    }

    var quietHoursOn: Bool { quietStart != nil && quietEnd != nil }

    func setQuietHours(on: Bool) {
        if on {
            quietStart = quietStart ?? Self.time(from: "22:00:00")
            quietEnd = quietEnd ?? Self.time(from: "07:00:00")
        } else {
            quietStart = nil
            quietEnd = nil
        }
        saveQuietHours()
    }

    func saveQuietHours() {
        Task {
            try? await NotificationPrefsRepository.setQuietHours(
                start: Self.string(from: quietStart),
                end: Self.string(from: quietEnd))
        }
    }

    private static func time(from value: String?) -> Date? {
        guard let value else { return nil }
        let parts = value.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2 else { return nil }
        return Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: Date())
    }

    private static func string(from date: Date?) -> String? {
        guard let date else { return nil }
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d:00", c.hour ?? 0, c.minute ?? 0)
    }
}

struct NotificationSettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme
    @StateObject private var vm = NotificationSettingsViewModel()
    @ObservedObject private var push = PushService.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                if vm.loading {
                    ProgressView().tint(theme.tokens.brand).frame(maxWidth: .infinity)
                } else {
                    permissionCard
                    eventsCard
                    quietHoursCard
                }
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .cappyAlert($vm.alert)
        .task(id: model.activeFamily?.id) {
            guard let familyId = model.activeFamily?.id else { return }
            await vm.load(familyId: familyId)
        }
    }

    private var permissionCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.sm) {
                Text(push.isRegistered ? "This phone is set up" : "Turn on notifications")
                    .font(CappyFont.displaySemibold(FontSizeToken.lg))
                    .foregroundStyle(theme.tokens.fg1)
                Text(push.isRegistered
                     ? "Cappy can let you know when another caregiver logs a dose."
                     : "Cappy needs permission to tell you when another caregiver logs a dose for one of your children.")
                    .font(CappyFont.sans(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg2)
                if !push.isRegistered {
                    CappyButton(label: "Allow notifications", variant: .blue, block: true) {
                        Task { await PushService.shared.register() }
                    }
                }
            }
        }
    }

    private var eventsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionLabel(text: "Tell me about")
                ForEach(vm.catalog) { info in
                    row(info)
                    if info.eventType != vm.catalog.last?.eventType { Divider() }
                }
            }
        }
    }

    private func row(_ info: NotificationEventInfo) -> some View {
        HStack(alignment: .top, spacing: Space.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(info.title)
                    .font(CappyFont.sansSemibold(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg1)
                Text(info.explanation)
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg3)
                if !info.isSuppressible {
                    Text("Always on — this one is a safety check, not an update.")
                        .font(CappyFont.sans(FontSizeToken.xs))
                        .foregroundStyle(theme.tokens.fg3)
                }
            }
            Spacer(minLength: Space.sm)
            if info.isSuppressible {
                Toggle("", isOn: Binding(
                    get: { vm.enabled[info.eventType] ?? info.defaultEnabled },
                    set: { vm.set(info.eventType, $0) }))
                    .labelsHidden()
                    .tint(theme.tokens.brand)
                    .accessibilityLabel(info.title)
            } else {
                // A lock with a reason, not a switch that refuses to move.
                Image(systemName: "lock.fill")
                    .foregroundStyle(theme.tokens.fgMuted)
                    .accessibilityLabel("\(info.title): always on")
            }
        }
        .padding(.vertical, 2)
    }

    private var quietHoursCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        SectionLabel(text: "Quiet hours")
                        Text("Notifications still arrive, but silently.")
                            .font(CappyFont.sans(FontSizeToken.sm))
                            .foregroundStyle(theme.tokens.fg3)
                    }
                    Spacer()
                    Toggle("", isOn: Binding(get: { vm.quietHoursOn },
                                             set: { vm.setQuietHours(on: $0) }))
                        .labelsHidden()
                        .tint(theme.tokens.brand)
                        .accessibilityLabel("Quiet hours")
                }
                if vm.quietHoursOn {
                    DatePicker("From", selection: Binding(
                        get: { vm.quietStart ?? Date() },
                        set: { vm.quietStart = $0; vm.saveQuietHours() }),
                               displayedComponents: .hourAndMinute)
                    DatePicker("Until", selection: Binding(
                        get: { vm.quietEnd ?? Date() },
                        set: { vm.quietEnd = $0; vm.saveQuietHours() }),
                               displayedComponents: .hourAndMinute)
                    Text("Safety alerts — interactions and the 24-hour maximum — ignore quiet hours. Everything else waits.")
                        .font(CappyFont.sans(FontSizeToken.xs))
                        .foregroundStyle(theme.tokens.fg3)
                }
            }
        }
    }
}
