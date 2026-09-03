//
//  NotificationPrefsRepository.swift
//  Cappy
//
//  Which notifications a caregiver has opted into, per family, per event type,
//  and optionally per medication.
//
//  Two things the schema decides and this file only reflects:
//
//  * A safety event is not suppressible. An interaction warning and a 24-hour
//    maximum are not news about someone else's activity; they are the
//    interlocks of ¶[0051] reaching a caregiver who is about to act on stale
//    information. `isSuppressible` comes from the server catalog so the UI can
//    render them as locked with a reason, rather than as a switch that looks
//    broken or, worse, one that appears to work and doesn't.
//
//  * "Next dose window opens" is off by default. It is the one event that
//    prompts someone to medicate rather than telling them what happened, and
//    defaulting that on would have the app nudging families toward doses
//    nobody asked about.
//

import Foundation

/// Mirrors the `notification_event` enum.
enum NotificationEvent: String, Codable, Hashable, CaseIterable {
    case doseLoggedByOther   = "dose_logged_by_other"
    case doseWindowOpen      = "dose_window_open"
    case unloggedDoseReminder = "unlogged_dose_reminder"
    case weightUpdateNeeded  = "weight_update_needed"
    case interactionWarning  = "interaction_warning"
    case maxReached          = "max_reached"
}

struct NotificationEventInfo: Codable, Hashable, Identifiable {
    let eventType: NotificationEvent
    let title: String
    let explanation: String
    let defaultEnabled: Bool
    let isSuppressible: Bool
    let respectsQuietHours: Bool
    let sortOrder: Int

    var id: NotificationEvent { eventType }
}

struct NotificationPref: Codable, Hashable {
    let userId: String
    let familyId: String
    let medicationId: String?
    let eventType: NotificationEvent
    let enabled: Bool
}

enum NotificationPrefsRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }

    static func catalog() async throws -> [NotificationEventInfo] {
        try await db.from("notification_event_catalog").select("*")
            .order("sort_order", ascending: true)
            .execute(decoding: [NotificationEventInfo].self)
    }

    static func prefs(familyId: String) async throws -> [NotificationPref] {
        guard let userId = SupabaseClient.shared.auth.currentUser?.id else { return [] }
        return try await db.from("caregiver_notification_prefs")
            .select("user_id,family_id,medication_id,event_type,enabled")
            .eq("family_id", familyId)
            .eq("user_id", userId)
            .execute(decoding: [NotificationPref].self)
    }

    /// Set one preference. `medicationId` nil means "every medication"; a
    /// per-medication row overrides it, matching `notification_enabled`'s
    /// resolution order on the server.
    static func set(familyId: String, event: NotificationEvent,
                    medicationId: String? = nil, enabled: Bool) async throws {
        guard let userId = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        _ = try await db.from("caregiver_notification_prefs")
            .upsert([
                "user_id": userId,
                "family_id": familyId,
                "medication_id": medicationId,
                "event_type": event.rawValue,
                "enabled": enabled,
                "updated_at": Date().iso
            ], onConflict: "user_id,family_id,medication_key,event_type")
            .run()
    }

    // MARK: Quiet hours

    struct QuietHours: Codable, Hashable {
        var start: String?     // "22:00:00"
        var end: String?       // "07:00:00"
        var timeZone: String?
    }

    static func quietHours() async throws -> QuietHours {
        struct Row: Decodable {
            let quietHoursStart: String?
            let quietHoursEnd: String?
            let timeZone: String?
        }
        guard let userId = SupabaseClient.shared.auth.currentUser?.id else { return QuietHours() }
        let row = try await db.from("profiles")
            .select("quiet_hours_start,quiet_hours_end,time_zone")
            .eq("id", userId).single()
            .execute(decoding: Row.self)
        return QuietHours(start: row.quietHoursStart, end: row.quietHoursEnd, timeZone: row.timeZone)
    }

    /// Stores the caregiver's own zone alongside the window, because a
    /// household can straddle two of them and the entire point is not waking
    /// someone at 3 AM their time.
    static func setQuietHours(start: String?, end: String?) async throws {
        guard let userId = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        _ = try await db.from("profiles")
            .update([
                "quiet_hours_start": start,
                "quiet_hours_end": end,
                "time_zone": TimeZone.current.identifier
            ])
            .eq("id", userId)
            .run()
    }
}
