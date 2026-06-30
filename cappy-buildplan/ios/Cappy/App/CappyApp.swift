import SwiftUI

@main
struct CappyApp: App {
    private let environment = AppEnvironment.preview

    var body: some Scene {
        WindowGroup {
            RootView(environment: environment)
        }
    }
}

struct RootView: View {
    let environment: AppEnvironment

    var body: some View {
        HomeDashboardView(environment: environment)
            .preferredColorScheme(nil)
    }
}
