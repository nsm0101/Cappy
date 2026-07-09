//
//  DoseLiveActivity.swift
//  CappyWidget
//
//  Live Activity + Dynamic Island rendering for the next-dose countdown.
//

import SwiftUI
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.2, *)
struct DoseLiveActivity: Widget {
    private let brand = Color(red: 0.094, green: 0.655, blue: 0.553)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DoseActivityAttributes.self) { context in
            // Lock screen / banner.
            HStack(spacing: 12) {
                Image(systemName: "cross.case.fill").font(.title2).foregroundStyle(brand)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(context.attributes.childName) · \(context.attributes.medName)")
                        .font(.footnote.weight(.semibold))
                    Text("Next dose safe")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                countdown(context.state)
                    .font(.system(.title3, design: .rounded).weight(.bold))
                    .foregroundStyle(brand)
            }
            .padding()
            .activityBackgroundTint(nil)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.attributes.childName, systemImage: "cross.case.fill")
                        .foregroundStyle(brand)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    countdown(context.state).font(.system(.title3, design: .rounded).weight(.bold))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Next \(context.attributes.medName) dose window").font(.caption)
                }
            } compactLeading: {
                Image(systemName: "cross.case.fill").foregroundStyle(brand)
            } compactTrailing: {
                countdown(context.state).monospacedDigit()
            } minimal: {
                Image(systemName: "cross.case.fill").foregroundStyle(brand)
            }
        }
    }

    @ViewBuilder private func countdown(_ state: DoseActivityAttributes.ContentState) -> some View {
        if let date = ISO8601DateFormatter.cappy.date(from: state.nextSafeAtISO), date > Date() {
            Text(timerInterval: Date()...date, countsDown: true)
        } else {
            Text("Safe now")
        }
    }
}

extension ISO8601DateFormatter {
    static let cappy: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
#endif
