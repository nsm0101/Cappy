//
//  Date+ISO.swift
//  Cappy
//
//  ISO-8601 serialization used when writing timestamps to Supabase.
//

import Foundation

extension Date {
    /// ISO-8601 string with fractional seconds (matches JS `toISOString()`).
    var iso: String { Date.isoFormatter.string(from: self) }

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    /// "YYYY-MM-DD" in UTC (for date-of-birth style fields).
    var yyyyMMdd: String { Date.dayFormatter.string(from: self) }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()
}
