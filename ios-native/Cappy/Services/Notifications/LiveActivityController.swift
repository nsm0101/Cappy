//
//  LiveActivityController.swift
//  Cappy
//
//  Starts / ends the "next dose window" Live Activity after a child dose is
//  logged. Guarded so it is a no-op where ActivityKit is unavailable.
//

import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

enum LiveActivityController {

    /// Start (or replace) a Live Activity counting down to the next safe dose.
    static func start(childName: String, medName: String, nextSafeAtISO: String) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        // End any existing dose activities first (one at a time keeps it tidy).
        Task {
            for activity in Activity<DoseActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            let attributes = DoseActivityAttributes(childName: childName, medName: medName)
            let state = DoseActivityAttributes.ContentState(nextSafeAtISO: nextSafeAtISO, isSafeNow: false)
            let staleDate = CappyTime.date(from: nextSafeAtISO)?.addingTimeInterval(3600)
            do {
                _ = try Activity.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: staleDate),
                    pushType: nil)
            } catch {
                // Non-fatal — the app still works without the Live Activity.
            }
        }
        #endif
    }

    static func endAll() {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { return }
        Task {
            for activity in Activity<DoseActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
        #endif
    }
}
