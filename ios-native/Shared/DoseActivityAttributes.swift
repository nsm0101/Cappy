//
//  DoseActivityAttributes.swift
//  Cappy (shared: app + widget)
//
//  Live Activity attributes for the "next dose window" countdown. Defined in a
//  file shared by the app (which starts/updates the activity) and the widget
//  extension (which renders it).
//

import Foundation
#if canImport(ActivityKit)
import ActivityKit

struct DoseActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// The next-safe timestamp to count down to (ISO-8601).
        var nextSafeAtISO: String
        /// Whether the window is already open (safe to give now).
        var isSafeNow: Bool
    }

    /// Static info shown for the whole activity.
    var childName: String
    var medName: String
}
#endif
