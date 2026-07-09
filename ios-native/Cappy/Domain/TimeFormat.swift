//
//  TimeFormat.swift
//  Cappy
//
//  Human-friendly time formatting, ported from app/src/lib/time.ts, plus
//  ISO-8601 parsing that tolerates fractional seconds and timezone offsets
//  (Postgres timestamptz).
//

import Foundation

enum CappyTime {

    /// Parse an ISO timestamp string from Supabase (with or without
    /// fractional seconds / "Z").
    static func date(from iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        if let d = isoWithFraction.date(from: iso) { return d }
        if let d = isoPlain.date(from: iso) { return d }
        // Bare date "YYYY-MM-DD"
        if iso.count == 10, let d = dateOnly.date(from: iso) { return d }
        return nil
    }

    private static let isoWithFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let dateOnly: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    /// "just now" / "5 min ago" / "4h 10m ago" / "yesterday" / "Jun 15".
    static func relative(_ value: String?, now: Date = Date()) -> String {
        guard let date = date(from: value) else { return "—" }
        let diff = now.timeIntervalSince(date)
        if diff < 0 { return "in the future" }
        let seconds = Int(diff)
        if seconds < 60 { return "just now" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes) min ago" }
        let hours = minutes / 60
        let remMin = minutes - hours * 60
        if hours < 24 { return remMin > 0 ? "\(hours)h \(remMin)m ago" : "\(hours)h ago" }
        let days = hours / 24
        if days == 1 { return "yesterday" }
        if days < 7 { return "\(days) days ago" }
        return shortDate.string(from: date)
    }

    /// "in 30 min" / "in 2h 0m" / "now".
    static func timeUntil(_ value: String?, now: Date = Date()) -> String {
        guard let date = date(from: value) else { return "—" }
        let diff = date.timeIntervalSince(now)
        if diff <= 0 { return "now" }
        let minutes = Int(diff) / 60
        if minutes < 60 { return "in \(minutes) min" }
        let hours = minutes / 60
        let remMin = minutes - hours * 60
        return "in \(hours)h \(remMin)m"
    }

    /// Localized clock time, e.g. "9:47 PM".
    static func clock(_ value: String?) -> String {
        guard let date = date(from: value) else { return "—" }
        return clockFormatter.string(from: date)
    }

    static func clock(_ date: Date) -> String { clockFormatter.string(from: date) }

    /// 'Today' / 'Yesterday' / 'Mon, Jun 29' for timeline day grouping.
    static func dayHeading(_ value: String?, now: Date = Date()) -> String {
        guard let date = date(from: value) else { return "—" }
        let cal = Calendar.current
        let todayMid = cal.startOfDay(for: now)
        let dateMid = cal.startOfDay(for: date)
        let days = cal.dateComponents([.day], from: dateMid, to: todayMid).day ?? 0
        if days == 0 { return "Today" }
        if days == 1 { return "Yesterday" }
        return dayHeadingFormatter.string(from: date)
    }

    private static let shortDate: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "MMM d"; return f
    }()
    private static let clockFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; return f
    }()
    private static let dayHeadingFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEE, MMM d"; return f
    }()
}
