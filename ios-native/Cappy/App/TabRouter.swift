//
//  TabRouter.swift
//  Cappy
//
//  Shared tab selection so any screen can switch tabs (e.g. Home's
//  onboarding "Log a dose" step jumps to the Scan tab).
//

import SwiftUI

enum AppTab: Hashable { case home, scan, timeline, schedule, settings }

@MainActor
final class TabRouter: ObservableObject {
    @Published var selection: AppTab = .home
}
