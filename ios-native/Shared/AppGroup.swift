//
//  AppGroup.swift
//  Cappy (shared: app + widget)
//
//  Shared App Group storage so the Home Screen widget can read a lightweight
//  snapshot of dose status written by the app.
//

import Foundation

enum AppGroup {
    static let identifier = "group.com.closedose.cappy"
    static var defaults: UserDefaults? { UserDefaults(suiteName: identifier) }
}

/// A lightweight snapshot of the active family's next-dose status, written by
/// the app and read by the widget.
struct SharedDoseSnapshot: Codable {
    struct Child: Codable, Identifiable {
        let id: String
        let name: String
        /// Raw dose-status string ("due", "early", "recent", "overdue",
        /// "max_reached", "unknown"). Kept as a String so this snapshot has no
        /// dependency on the app-only DoseStatus enum (the widget shares this
        /// file but not the app's models).
        let statusRaw: String
        let nextSafeAt: String?
    }
    var familyName: String
    var children: [Child]
    var updatedAt: Date

    static let storeKey = "cappy.doseSnapshot"

    static func load() -> SharedDoseSnapshot? {
        guard let data = AppGroup.defaults?.data(forKey: storeKey) else { return nil }
        return try? JSONDecoder().decode(SharedDoseSnapshot.self, from: data)
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        AppGroup.defaults?.set(data, forKey: Self.storeKey)
    }
}
