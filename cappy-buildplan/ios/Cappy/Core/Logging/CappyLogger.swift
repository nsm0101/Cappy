import Foundation
import OSLog

struct CappyLogger {
    private let logger: Logger

    init(subsystem: String, category: String) {
        self.logger = Logger(subsystem: subsystem, category: category)
    }

    func info(_ event: SafeLogEvent) {
        logger.info("\(event.name, privacy: .public) \(event.safeMetadataDescription, privacy: .public)")
    }

    func error(_ event: SafeLogEvent) {
        logger.error("\(event.name, privacy: .public) \(event.safeMetadataDescription, privacy: .public)")
    }
}

struct SafeLogEvent {
    let name: String
    let metadata: [String: String]

    init(name: String, metadata: [String: String] = [:]) {
        self.name = name
        self.metadata = metadata.filter { Self.allowedMetadataKeys.contains($0.key) }
    }

    var safeMetadataDescription: String {
        guard metadata.isEmpty == false else { return "{}" }
        return metadata
            .sorted { $0.key < $1.key }
            .map { "\($0.key)=\($0.value)" }
            .joined(separator: " ")
    }

    private static let allowedMetadataKeys: Set<String> = [
        "duration_ms",
        "environment",
        "event_id",
        "request_id",
        "screen",
        "status"
    ]
}
