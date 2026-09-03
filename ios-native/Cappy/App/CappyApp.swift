//
//  CappyApp.swift
//  Cappy
//
//  App entry point. Injects the app model + theme, resolves the active
//  color scheme, and wires deep links (NFC Universal Links, invite links)
//  and foreground token refresh.
//

import SwiftUI

@main
struct CappyApp: App {
    // SwiftUI's App lifecycle has no hook for the APNs token callbacks, so a
    // minimal delegate forwards those two and nothing else.
    @UIApplicationDelegateAdaptor(CappyAppDelegate.self) private var appDelegate

    @StateObject private var themeManager = ThemeManager()
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Dragging down on any scrolling screen collapses the keyboard
        // (applies to every SwiftUI ScrollView/List, which are UIScrollView-backed).
        UIScrollView.appearance().keyboardDismissMode = .interactive
    }

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environmentObject(model)
                .environmentObject(themeManager)
                .task { await model.bootstrap() }
                .onOpenURL { model.handle(url: $0) }
                // NFC background tag reads (and Universal Links opened by the
                // system) arrive as an NSUserActivity, NOT through onOpenURL —
                // without this handler the app foregrounds but never routes to
                // the dose sheet. Extract the webpageURL and feed the same
                // deep-link pipeline.
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL { model.handle(url: url) }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task {
                            await model.refreshOnForeground()
                            // A dose logged offline must not sit in the outbox
                            // until the caregiver happens to open the dose
                            // sheet again — the other parent is relying on it
                            // reaching the shared record.
                            await DoseOutbox.shared.flush()
                        }
                    }
                }
        }
    }
}

/// Resolves the color scheme (manager override or OS) and injects the theme.
struct AppRootView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @Environment(\.colorScheme) private var systemScheme

    var body: some View {
        let resolvedScheme = themeManager.schemeOverride ?? systemScheme
        let theme = themeManager.resolvedTheme(for: resolvedScheme)
        RootView()
            .environment(\.theme, theme)
            .tint(theme.tokens.brand)
            .preferredColorScheme(themeManager.schemeOverride)
            // The keyboard is always collapsable: every keyboard gets a
            // trailing "Done" accessory, and drag-down dismisses it inside
            // scroll views (see `scrollDismissesKeyboard` at each ScrollView).
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { UIApplication.dismissKeyboard() }
                }
            }
    }
}

extension UIApplication {
    /// Resigns whatever field is first responder — collapses the keyboard.
    static func dismissKeyboard() {
        shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}
