//
//  PushService.swift
//  Cappy
//
//  APNs registration, so a dose logged on one parent's phone can reach the
//  other's.
//
//  ¶[0053]: the administration event "is propagated to a second handheld
//  computing device through the shared record". Everything before this was a
//  local notification, which by construction cannot do that: nothing Mom's
//  phone schedules can fire on Dad's. Realtime only helped while the app was
//  already open, which is the case where the caregiver can already see it.
//
//  What this file does is narrow on purpose: obtain the device token, keep the
//  registry row fresh, and hand off. Who gets notified about what is decided
//  in the database by `notification_enabled`, not here — a client bug should
//  not be able to send a notification a caregiver turned off, and a client
//  should not be able to suppress a safety event by not asking for it.
//

import Foundation
import UIKit

@MainActor
final class PushService: ObservableObject {
    static let shared = PushService()

    @Published private(set) var isRegistered = false
    @Published private(set) var lastError: String?

    private var lastUploadedToken: String?
    private init() {}

    /// Ask iOS for a device token. Safe to call repeatedly — the OS returns
    /// the existing token when there is one, and the upload below is an upsert.
    func register() async {
        guard await NotificationPermissions.ensureAuthorized() else {
            isRegistered = false
            return
        }
        UIApplication.shared.registerForRemoteNotifications()
    }

    /// Called from the app delegate with the raw token.
    func didRegister(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        guard token != lastUploadedToken else { return }
        lastUploadedToken = token
        isRegistered = true
        Task { await upload(token: token) }
    }

    func didFailToRegister(error: Error) {
        isRegistered = false
        lastError = error.localizedDescription
    }

    /// The token belongs to one install of one build. `environment` has to
    /// match how the app was signed: a token minted by a development build is
    /// rejected by the production APNs host and vice versa, and the resulting
    /// "BadDeviceToken" is otherwise a genuinely baffling thing to debug.
    private func upload(token: String) async {
        guard let userId = SupabaseClient.shared.auth.currentUser?.id else { return }
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String

        do {
            _ = try await SupabaseClient.shared.db
                .from("device_push_tokens")
                .upsert([
                    "user_id": userId,
                    "token": token,
                    "platform": "ios",
                    "environment": Self.apnsEnvironment,
                    "device_id": ClockSync.deviceId,
                    "app_version": version,
                    "last_seen_at": Date().iso,
                    // A token Apple retired and then reissued to this install
                    // must come back to life rather than sit disabled forever.
                    "disabled_at": nil,
                    "disabled_reason": nil
                ], onConflict: "token")
                .run()
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Debug builds are signed with the development entitlement, so their
    /// tokens are sandbox tokens.
    static var apnsEnvironment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    /// On sign-out, stop this device receiving another family's notifications.
    func unregisterCurrentDevice() async {
        guard let token = lastUploadedToken else { return }
        _ = try? await SupabaseClient.shared.db
            .from("device_push_tokens")
            .update(["disabled_at": Date().iso, "disabled_reason": "signed_out"])
            .eq("token", token)
            .run()
        lastUploadedToken = nil
        isRegistered = false
    }
}

/// Minimal app delegate. SwiftUI's `App` lifecycle has no hook for the APNs
/// token callbacks, so the adaptor exists solely to forward those two.
final class CappyAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in PushService.shared.didRegister(deviceToken: deviceToken) }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in PushService.shared.didFailToRegister(error: error) }
    }
}
