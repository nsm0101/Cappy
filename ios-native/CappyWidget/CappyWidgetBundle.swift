//
//  CappyWidgetBundle.swift
//  CappyWidget
//
//  The widget extension bundle: a Home Screen "next dose" widget and the
//  dose-countdown Live Activity.
//

import WidgetKit
import SwiftUI

@main
struct CappyWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextDoseWidget()
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            DoseLiveActivity()
        }
        #endif
    }
}
