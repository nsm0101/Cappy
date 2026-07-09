
import Foundation
import SwiftUI
import UserNotifications

@MainActor
final class AppModel: ObservableObject {

    /// Bump when the terms/privacy policy materially changes; caregivers whose
    /// stored consent_version differs are re-prompted through setup.
    static let currentConsentVersion = "2026-07-01"

    private let auth = SupabaseClient.shared.auth

    @Published private(set) var session: AuthSession?
    @Published private(set) var isBootstrapping = true

    @Published private(set) var profile: CaregiverProfile?
    @Published private(set) var profileLoading = true

    @Published private(set) var families: [FamilyWithRole] = []
    @Published private(set) var activeFamily: FamilyWithRole?
    @Published private(set) var familiesLoading = true

    /// Pending deep-linked tag UID to resolve on the Scan screen (cold launch).
    @Published var pendingTagUID: String?
    /// Pending deep-linked invite code (Universal Link join/:code).
    @Published var pendingInviteCode: String?

    /// Bumped whenever a screen mutates shared data (child added, weight saved),
    /// so lists like Home can reload without changing the active family.
    @Published var dataStamp = UUID()
    func bumpData() { dataStamp = UUID() }

    private let activeFamilyKey = "cappy.activeFamilyId"
    private let notificationRouter = NotificationRouter()

    var isSignedIn: Bool { session != nil }

    var needsSetup: Bool {
        guard isSignedIn, !profileLoading else { return false }
        return !(profile?.isComplete(currentConsentVersion: Self.currentConsentVersion) ?? false)
    }

    var currentUserId: String? { session?.user.id }

    init() {
        auth.onSessionChange = { [weak self] newSession in
            Task { @MainActor in await self?.handleSessionChange(newSession) }
        }
        // Route a tapped "next dose" reminder through the same tag-resolution
        // pipeline NFC taps and Universal Links use (sets pendingTagUID,
        // which MainTabView already watches to open the Scan tab + dose
        // sheet) — regardless of whether the tap foregrounded, backgrounded,
        // or cold-launched the app.
        notificationRouter.onTagUID = { [weak self] uid in self?.pendingTagUID = uid }
        UNUserNotificationCenter.current().delegate = notificationRouter
    }

    // MARK: Bootstrap / session

    func bootstrap() async {
        session = auth.currentSession
        await auth.refreshIfNeeded()
        session = auth.currentSession
        if isSignedIn {
            await reloadProfileAndFamilies()
        } else {
            profileLoading = false
            familiesLoading = false
        }
        isBootstrapping = false
    }

    /// Called on app foreground to keep the token fresh.
    func refreshOnForeground() async {
        await auth.refreshIfNeeded()
        session = auth.currentSession
    }

    private func handleSessionChange(_ newSession: AuthSession?) async {
        let wasSignedIn = session != nil
        session = newSession
        if newSession == nil {
            profile = nil
            families = []
            activeFamily = nil
            profileLoading = false
            familiesLoading = false
        } else if !wasSignedIn {
            await reloadProfileAndFamilies()
        }
    }

    private func reloadProfileAndFamilies() async {
        await refreshProfile()
        await refreshFamilies()
    }

    func signOut() async {
        await auth.signOut()
    }

    // MARK: Profile

    func refreshProfile() async {
        guard isSignedIn else { profile = nil; profileLoading = false; return }
        profileLoading = true
        profile = try? await ProfilesRepository.getMyProfile()
        profileLoading = false
    }

    // MARK: Families

    func refreshFamilies() async {
        guard isSignedIn else { families = []; activeFamily = nil; familiesLoading = false; return }
        familiesLoading = true
        defer { familiesLoading = false }
        do {
            let fams = try await FamiliesRepository.listMyFamilies()
            families = fams
            let storedId = UserDefaults.standard.string(forKey: activeFamilyKey)
            if let storedId, let match = fams.first(where: { $0.id == storedId }) {
                activeFamily = match
            } else {
                activeFamily = fams.first
            }
        } catch {
            // Leave the previous state; screens surface their own errors.
        }
    }

    func setActiveFamily(_ family: FamilyWithRole) {
        activeFamily = family
        UserDefaults.standard.set(family.id, forKey: activeFamilyKey)
    }

    // MARK: Deep links

    func handle(url: URL) {
        // NFC tag:   https://cappy.closedose.com/t/{uid}   or  cappy://t/{uid}
        // Invite:    https://cappy.closedose.com/join/{code} or cappy://join/{code}
        let path = url.path
        if path.hasPrefix("/t/") {
            pendingTagUID = String(path.dropFirst(3))
        } else if path.hasPrefix("/join/") {
            pendingInviteCode = String(path.dropFirst(6))
        } else if url.scheme == "cappy", let host = url.host {
            if host == "t", url.pathComponents.count > 1 {
                pendingTagUID = url.pathComponents[1]
            } else if host == "join", url.pathComponents.count > 1 {
                pendingInviteCode = url.pathComponents[1]
            }
        }
    }
}

/// UNUserNotificationCenterDelegate that routes a tapped "next dose" local
/// notification back into the tag-resolution pipeline: extracts the
/// well-known medication slug carried in the notification's userInfo (set by
/// ReminderService) and hands it to AppModel, which feeds the exact same
/// pendingTagUID plumbing a scanned NFC tag or Universal Link does.
final class NotificationRouter: NSObject, UNUserNotificationCenterDelegate {
    var onTagUID: ((String) -> Void)?

    /// Show the banner + sound even while the app is already in the
    /// foreground (otherwise a foreground reminder fires silently).
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                 willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    /// Fires on tap from any app state — home screen, lock screen, or an
    /// in-app banner. The OS launches/foregrounds the app first, then calls
    /// this, so setting `AppModel`'s delegate in `init()` is early enough to
    /// catch a cold launch too.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                 didReceive response: UNNotificationResponse) async {
        guard let tagUid = response.notification.request.content.userInfo["tagUid"] as? String,
              !tagUid.isEmpty else { return }
        await MainActor.run { onTagUID?(tagUid) }
    }
}
