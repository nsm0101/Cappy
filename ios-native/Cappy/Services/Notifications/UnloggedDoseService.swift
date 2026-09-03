//
//  UnloggedDoseService.swift
//  Cappy
//
//  "Forgot to log your dose?"
//
//  A caregiver taps the token, picks a child, reads the amount, draws it up,
//  gives it to a child who is crying at 2 AM — and never comes back to the
//  phone. The dose was given. The record says it wasn't.
//
//  That gap is not cosmetic. Every interval rule in the app is computed from
//  what was recorded, and ¶[0052] says so plainly: "the interlocks operate
//  upon the administration history that has been recorded, and an
//  administration that was never recorded is not visible to them. This is a
//  limit of the arrangement and is treated as one."
//
//  Treating it as one means three things here:
//
//  1. A tap plus a selected recipient is recorded as an *intent* — evidence
//     that a dose was about to be given, kept separately from evidence that
//     one was.
//  2. If no dose follows within the grace window, the caregiver is asked.
//     Asked, not told: they may have checked and found it was too early, or
//     been interrupted. An unanswered intent NEVER becomes an administration
//     event, because inventing a dose corrupts the very history the interlocks
//     depend on.
//  3. Until it is answered, the recent history is known to be incomplete, and
//     the dose-presentation state machine suppresses on `historyIncomplete`
//     rather than handing over a number computed from a record it knows is
//     short.
//
//  The reminder is a local notification so it fires with no signal, and the
//  intent is also written to the server so that a dose logged on the *other*
//  parent's phone silences it here.
//

import Foundation
import UserNotifications

@MainActor
final class UnloggedDoseService: ObservableObject {
    static let shared = UnloggedDoseService()

    /// A tap that has not yet been answered, held locally so the gate works
    /// offline.
    struct Intent: Codable, Hashable, Identifiable {
        let id: String
        var familyId: String
        var medicationId: String
        var medicationName: String
        var tagUid: String?
        var acquisitionChannel: AcquisitionChannel
        var bindingStrength: BindingStrength?
        var childId: String?
        var caregiverUserId: String?
        var recipientName: String
        var openedAt: Date
        var remindAt: Date
        var doseReleased: Bool
        var resolvedAt: Date?
        var dismissedAt: Date?
        var syncedAt: Date?

        var isOpen: Bool { resolvedAt == nil && dismissedAt == nil }
    }

    @Published private(set) var intents: [Intent] = []
    /// Set when the caregiver taps the reminder, so the app opens on the
    /// question instead of wherever it happened to be.
    @Published var focusedIntentId: String?

    func focus(_ id: String) { focusedIntentId = id }

    /// Long enough to actually give a dose and settle a child; short enough
    /// that the caregiver still remembers what happened.
    static var graceMinutes: Double {
        DosingRuleCache.shared.policy("unlogged_dose_grace_minutes", default: 20)
    }

    /// Past this, the intent is abandoned rather than asked about. A caregiver
    /// cannot reliably recall at breakfast whether a 1 AM tap ended in a dose,
    /// and a guess poisons the interval history more than the gap does.
    static var expiryHours: Double {
        DosingRuleCache.shared.policy("unlogged_dose_expiry_hours", default: 6)
    }

    private var fileURL: URL {
        let dir = (try? FileManager.default.url(for: .applicationSupportDirectory,
                                                in: .userDomainMask,
                                                appropriateFor: nil, create: true))
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        return dir.appendingPathComponent("cappy-scan-intents.json")
    }

    private init() {
        if let data = try? Data(contentsOf: fileURL),
           let rows = try? JSONDecoder.cappy.decode([Intent].self, from: data) {
            intents = rows
        }
        purgeExpired()
    }

    // MARK: Opening an intent

    /// Called the moment dosing information is presented for a chosen family
    /// member — which is the point at which the caregiver has enough to draw
    /// up a dose and walk away.
    @discardableResult
    func open(familyId: String, medicationId: String, medicationName: String,
              tagUid: String?, channel: AcquisitionChannel, binding: BindingStrength?,
              childId: String?, caregiverUserId: String?, recipientName: String,
              doseReleased: Bool) -> Intent {

        // One open intent per (recipient, medication). Re-opening the same
        // dose sheet twice is one intention, not two, and two banners for one
        // forgotten dose is how a useful prompt becomes one people swipe away
        // without reading.
        if let existing = intents.first(where: {
            $0.isOpen && $0.medicationId == medicationId
                && $0.childId == childId && $0.caregiverUserId == caregiverUserId
        }) {
            return existing
        }

        let now = Date()
        let intent = Intent(
            id: UUID().uuidString, familyId: familyId,
            medicationId: medicationId, medicationName: medicationName,
            tagUid: tagUid, acquisitionChannel: channel, bindingStrength: binding,
            childId: childId, caregiverUserId: caregiverUserId, recipientName: recipientName,
            openedAt: now,
            remindAt: now.addingTimeInterval(Self.graceMinutes * 60),
            doseReleased: doseReleased, resolvedAt: nil, dismissedAt: nil, syncedAt: nil)

        intents.append(intent)
        persist()
        Task { await scheduleReminder(intent) }
        Task { await sync(intent) }
        return intent
    }

    // MARK: Closing one

    /// A dose was logged. The question is answered.
    func resolve(medicationId: String, childId: String?, caregiverUserId: String?) {
        for index in intents.indices where
            intents[index].isOpen
            && intents[index].medicationId == medicationId
            && intents[index].childId == childId
            && intents[index].caregiverUserId == caregiverUserId {
            intents[index].resolvedAt = Date()
            cancelReminder(intents[index].id)
            Task { await markResolvedRemotely(intents[index].id) }
        }
        persist()
    }

    /// The caregiver says no dose was given. Recorded as an answer — the
    /// history is complete again — and still not an administration event.
    func dismiss(_ id: String, reason: String = "no_dose_given") {
        guard let index = intents.firstIndex(where: { $0.id == id }) else { return }
        intents[index].dismissedAt = Date()
        cancelReminder(id)
        persist()
        Task { await markDismissedRemotely(id, reason: reason) }
    }

    // MARK: Reading

    /// Intents whose grace window has passed and which are still unanswered —
    /// what the caregiver is being asked about.
    func dueIntents(now: Date = Date()) -> [Intent] {
        let expiry = now.addingTimeInterval(-Self.expiryHours * 3600)
        return intents.filter { $0.isOpen && $0.remindAt <= now && $0.openedAt > expiry }
    }

    /// Feeds `DoseSuppressionReason.historyIncomplete`. Only a *due* intent
    /// counts: a tap thirty seconds ago is a caregiver still standing in front
    /// of the phone, not a gap in the record.
    func hasOpenIntent(childId: String?, caregiverUserId: String?,
                       medicationId: String, now: Date = Date()) -> Bool {
        dueIntents(now: now).contains {
            $0.medicationId == medicationId
                && $0.childId == childId
                && $0.caregiverUserId == caregiverUserId
        }
    }

    // MARK: Local notification

    private func identifier(_ id: String) -> String { "unlogged-dose:\(id)" }

    private func cancelReminder(_ id: String) {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [identifier(id)])
    }

    private func scheduleReminder(_ intent: Intent) async {
        guard await NotificationPermissions.ensureAuthorized() else { return }

        let content = UNMutableNotificationContent()
        content.title = "Did you give that dose?"
        // Names the recipient but not the medication: this fires on a locked
        // screen, and the medication is a clinical detail that can wait until
        // the app is open.
        content.body = "You opened a dose for \(intent.recipientName) and didn't log it. Tap to finish, or tell Cappy it wasn't given."
        content.userInfo = [
            "unloggedIntentId": intent.id,
            "tagUid": intent.tagUid ?? ""
        ]
        content.interruptionLevel = .passive

        let interval = max(intent.remindAt.timeIntervalSinceNow, 1)
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let request = UNNotificationRequest(identifier: identifier(intent.id),
                                            content: content, trigger: trigger)
        try? await UNUserNotificationCenter.current().add(request)
    }

    // MARK: Server mirror
    //
    // The row lets a dose logged on another device close this prompt, and lets
    // the server-side gate see the same gap this device sees.

    private func sync(_ intent: Intent) async {
        guard let actor = SupabaseClient.shared.auth.currentUser?.id else { return }
        do {
            _ = try await SupabaseClient.shared.db.from("scan_intents").insert([
                "id": intent.id,
                "family_id": intent.familyId,
                "medication_id": intent.medicationId,
                "tag_uid": intent.tagUid,
                "acquisition_channel": intent.acquisitionChannel.rawValue,
                "binding_strength": intent.bindingStrength?.rawValue,
                "child_id": intent.childId,
                "caregiver_user_id": intent.caregiverUserId,
                "actor_user_id": actor,
                "device_id": ClockSync.deviceId,
                "opened_at": intent.openedAt.iso,
                "dose_released": intent.doseReleased,
                "remind_at": intent.remindAt.iso
            ]).run()
            if let index = intents.firstIndex(where: { $0.id == intent.id }) {
                intents[index].syncedAt = Date()
                persist()
            }
        } catch {
            // Offline is fine — the local copy is what drives the prompt, and
            // the row will be missing rather than wrong.
        }
    }

    private func markResolvedRemotely(_ id: String) async {
        _ = try? await SupabaseClient.shared.db.from("scan_intents")
            .update(["resolved_at": Date().iso]).eq("id", id).run()
    }

    private func markDismissedRemotely(_ id: String, reason: String) async {
        _ = try? await SupabaseClient.shared.db.from("scan_intents")
            .update(["dismissed_at": Date().iso, "dismissal": reason]).eq("id", id).run()
    }

    /// Pull intents opened on this caregiver's other devices, and drop local
    /// ones the server says are closed.
    func refresh(familyId: String) async {
        struct Row: Decodable {
            let id: String
            let resolvedAt: String?
            let dismissedAt: String?
        }
        guard let rows = try? await SupabaseClient.shared.db
            .rpc("open_scan_intents", params: ["p_family_id": familyId])
            .execute(decoding: [Row].self)
        else { return }

        let stillOpen = Set(rows.map(\.id))
        for index in intents.indices where intents[index].isOpen && intents[index].syncedAt != nil {
            if !stillOpen.contains(intents[index].id) {
                intents[index].resolvedAt = Date()
                cancelReminder(intents[index].id)
            }
        }
        purgeExpired()
    }

    // MARK: Housekeeping

    private func purgeExpired() {
        let expiry = Date().addingTimeInterval(-Self.expiryHours * 3600)
        for index in intents.indices where intents[index].isOpen && intents[index].openedAt <= expiry {
            intents[index].dismissedAt = Date()
            cancelReminder(intents[index].id)
        }
        // Keep a day of answered intents for the timeline, then let them go.
        let keepAfter = Date().addingTimeInterval(-24 * 3600)
        intents.removeAll { !$0.isOpen && $0.openedAt < keepAfter }
        persist()
    }

    private func persist() {
        guard let data = try? JSONEncoder.cappy.encode(intents) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}

/// Notification authorisation, asked for once and remembered.
enum NotificationPermissions {
    static func ensureAuthorized() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return true
        case .notDetermined:
            return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        default:
            return false
        }
    }
}
