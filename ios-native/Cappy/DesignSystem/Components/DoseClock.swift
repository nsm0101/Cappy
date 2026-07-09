//
//  DoseClock.swift
//  Cappy
//
//  Circular dose-window gauge for the Schedule screen: a ring that fills from
//  the last dose toward the next-safe time, colored by status, with a compact
//  center label. Inspired by app/src/components/DoseClock.tsx.
//

import SwiftUI

struct DoseClock: View {
    @Environment(\.theme) private var theme
    let status: DoseStatus
    let lastDoseAt: String?
    let nextSafeAt: String?
    var accent: Color
    var size: CGFloat = 96

    private var progress: Double {
        guard let last = CappyTime.date(from: lastDoseAt),
              let next = CappyTime.date(from: nextSafeAt) else {
            return status == .due ? 1 : 0
        }
        let total = next.timeIntervalSince(last)
        guard total > 0 else { return 1 }
        let elapsed = Date().timeIntervalSince(last)
        return min(max(elapsed / total, 0), 1)
    }

    private var ringColor: Color {
        switch status {
        case .due: return theme.tokens.doseDueSolid
        case .early: return theme.tokens.doseEarlySolid
        case .recent: return theme.tokens.doseRecentSolid
        case .overdue, .maxReached: return theme.tokens.doseOverdueSolid
        case .unknown: return theme.tokens.fgMuted
        }
    }

    private var centerText: String {
        switch status {
        case .due: return "Due"
        case .overdue: return "Overdue"
        case .maxReached: return "Max"
        case .unknown: return "—"
        case .early, .recent:
            return CappyTime.timeUntil(nextSafeAt).replacingOccurrences(of: "in ", with: "")
        }
    }

    var body: some View {
        ZStack {
            Circle().stroke(theme.tokens.bgInset, lineWidth: 8)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(ringColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text(centerText)
                    .font(CappyFont.displaySemibold(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg1)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
            }
            .padding(6)
        }
        .frame(width: size, height: size)
    }
}
