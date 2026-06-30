import Foundation

struct AppEnvironment {
    let apiBaseURL: URL
    let logger: CappyLogger

    static let preview = AppEnvironment(
        apiBaseURL: URL(string: "https://staging.cappy.app")!,
        logger: CappyLogger(subsystem: "app.cappy.ios", category: "preview")
    )
}
