//
//  Haptics.swift
//  Cappy
//
//  Thin wrapper over UIKit feedback generators (matches the Expo app's use of
//  expo-haptics on dose-log and success moments). Calls are safe from any
//  context — work is dispatched to the main thread.
//

import UIKit

enum Haptics {
    static func success() {
        DispatchQueue.main.async { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    }
    static func warning() {
        DispatchQueue.main.async { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
    }
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        DispatchQueue.main.async { UIImpactFeedbackGenerator(style: style).impactOccurred() }
    }
}
