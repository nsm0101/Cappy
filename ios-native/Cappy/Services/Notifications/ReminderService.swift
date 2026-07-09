//
//  ReminderService.swift
//  Cappy
//
//  Local "next dose is safe" reminders. One scheduled notification per
//  (child, medication) pair, fired at the server-computed next_safe_at.
//  Mirrors app/src/lib/reminders.ts.
//
//  The reminder is a nudge, not a dose instruction — copy tells the caregiver
//  to confirm in Cappy first (the dose sheet re-checks safety at log time).
//

import Foundation
import UserNotifications

enum ReminderService {
    private static let prefKey = "cappy.reminders.enabled"

    static var isEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: prefKey) }
        set { UserDefaults.standard.set(newValue, forKey: prefKey) }
    }

    private static func identifier(childId: String, medicationId: String) -> String {
        "dose-reminder:\(childId):\(medicationId)"
    }

    /// Cancel the pending reminder for a (child, medication) pair, if any.
    static func cancel(childId: String, medicationId: String) {
        let id = identifier(childId: childId, medicationId: medicationId)
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }

    /// Schedule (or replace) the reminder for a (child, medication) pair at
    /// `nextSafeAt`. Returns false when the time is already past or permission
    /// was denied — never throws.
    @discardableResult
    static func scheduleNextDose(childId: String, medicationId: String,
                                 recipientName: String, medName: String,
                                 nextSafeAt: String, tagUid: String? = nil) async -> Bool {
        guard let fireDate = CappyTime.date(from: nextSafeAt), fireDate > Date() else { return false }

        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        guard granted else { return false }

        cancel(childId: childId, medicationId: medicationId)

        let content = UNMutableNotificationContent()
        content.title = "Next dose window is open"
        content.body = "\(recipientName)'s next \(medName) dose can be given now if still needed. Open Cappy to confirm before giving."
        // Carries the medication's well-known tag slug (when it has one) so
        // NotificationRouter can route a tap straight back through the same
        // resolve pipeline an NFC/QR scan uses, landing on the family member
        // selection screen for this medication instead of just foregrounding.
        if let tagUid, !tagUid.isEmpty {
            content.userInfo = ["tagUid": tagUid]
        }

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(
            identifier: identifier(childId: childId, medicationId: medicationId),
            content: content, trigger: trigger)

        do { try await center.add(request); return true } catch { return false }
    }
}
