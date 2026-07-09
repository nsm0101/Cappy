//
//  NextDoseWidget.swift
//  CappyWidget
//
//  Home Screen widget showing the soonest next-safe-dose status across the
//  active family, read from the shared App Group snapshot the app writes.
//

import WidgetKit
import SwiftUI

struct NextDoseEntry: TimelineEntry {
    let date: Date
    let snapshot: SharedDoseSnapshot?
}

struct NextDoseProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextDoseEntry {
        NextDoseEntry(date: Date(), snapshot: SharedDoseSnapshot(
            familyName: "Your family",
            children: [.init(id: "1", name: "Ava", statusRaw: "due", nextSafeAt: nil)],
            updatedAt: Date()))
    }

    func getSnapshot(in context: Context, completion: @escaping (NextDoseEntry) -> Void) {
        completion(NextDoseEntry(date: Date(), snapshot: SharedDoseSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextDoseEntry>) -> Void) {
        let entry = NextDoseEntry(date: Date(), snapshot: SharedDoseSnapshot.load())
        // Refresh again in 15 minutes so relative times stay current.
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct NextDoseWidgetView: View {
    let entry: NextDoseEntry
    @Environment(\.widgetFamily) private var family

    private let brand = Color(red: 0.094, green: 0.655, blue: 0.553)

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "cross.case.fill").foregroundStyle(brand)
                Text("Cappy").font(.system(.subheadline, design: .rounded).weight(.semibold))
                Spacer()
            }
            if let snapshot = entry.snapshot, !snapshot.children.isEmpty {
                ForEach(snapshot.children.prefix(family == .systemSmall ? 2 : 4)) { child in
                    HStack {
                        Text(child.name).font(.system(.footnote).weight(.semibold)).lineLimit(1)
                        Spacer()
                        Text(statusText(child)).font(.system(.caption2))
                            .foregroundStyle(color(for: child.statusRaw))
                    }
                }
            } else {
                Text("Open Cappy to see dose status.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
    }

    private func statusText(_ child: SharedDoseSnapshot.Child) -> String {
        switch child.statusRaw {
        case "due": return "Due now"
        case "overdue": return "Overdue"
        case "max_reached": return "24h max"
        case "early", "recent":
            if let next = child.nextSafeAt, let date = Self.parseISO(next) {
                return relative(date)
            }
            return "Recent"
        default: return "—"
        }
    }

    /// Tolerant ISO parse (with or without fractional seconds).
    static func parseISO(_ s: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: s) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: s)
    }

    private func relative(_ date: Date) -> String {
        let mins = Int(date.timeIntervalSinceNow / 60)
        if mins <= 0 { return "Safe now" }
        if mins < 60 { return "in \(mins)m" }
        return "in \(mins / 60)h \(mins % 60)m"
    }

    private func color(for raw: String) -> Color {
        switch raw {
        case "due": return brand
        case "overdue", "max_reached": return Color(red: 0.85, green: 0.29, blue: 0.29)
        case "early", "recent": return Color(red: 0.85, green: 0.48, blue: 0.05)
        default: return .secondary
        }
    }
}

struct NextDoseWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextDoseWidget", provider: NextDoseProvider()) { entry in
            NextDoseWidgetView(entry: entry)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("Next dose")
        .description("See when the next dose is safe for each child.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
