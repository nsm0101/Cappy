//
//  Color+Hex.swift
//  Cappy
//
//  SwiftUI Color helpers for the design system. Supports "#RRGGBB",
//  "#RRGGBBAA" and "rgba(r,g,b,a)" strings so the ported design tokens can
//  be written exactly as they appear in the source `tokens.ts`.
//

import SwiftUI

extension Color {
    /// Create a color from a hex string ("#18A78D" / "18A78D" / "#RRGGBBAA")
    /// or an `rgba(r, g, b, a)` / `rgb(r, g, b)` CSS string.
    init(cappy string: String) {
        let s = string.trimmingCharacters(in: .whitespacesAndNewlines)

        if s.lowercased().hasPrefix("rgba(") || s.lowercased().hasPrefix("rgb(") {
            let inner = s
                .replacingOccurrences(of: "rgba(", with: "", options: .caseInsensitive)
                .replacingOccurrences(of: "rgb(", with: "", options: .caseInsensitive)
                .replacingOccurrences(of: ")", with: "")
            let parts = inner.split(separator: ",").map {
                $0.trimmingCharacters(in: .whitespaces)
            }
            let r = Double(parts.count > 0 ? parts[0] : "0") ?? 0
            let g = Double(parts.count > 1 ? parts[1] : "0") ?? 0
            let b = Double(parts.count > 2 ? parts[2] : "0") ?? 0
            let a = Double(parts.count > 3 ? parts[3] : "1") ?? 1
            self = Color(.sRGB, red: r / 255, green: g / 255, blue: b / 255, opacity: a)
            return
        }

        var hex = s.hasPrefix("#") ? String(s.dropFirst()) : s
        if hex.count == 3 {
            hex = hex.map { "\($0)\($0)" }.joined()
        }
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)

        let r, g, b, a: Double
        switch hex.count {
        case 8: // RRGGBBAA
            r = Double((value & 0xFF00_0000) >> 24) / 255
            g = Double((value & 0x00FF_0000) >> 16) / 255
            b = Double((value & 0x0000_FF00) >> 8) / 255
            a = Double(value & 0x0000_00FF) / 255
        default: // RRGGBB
            r = Double((value & 0xFF0000) >> 16) / 255
            g = Double((value & 0x00FF00) >> 8) / 255
            b = Double(value & 0x0000FF) / 255
            a = 1
        }
        self = Color(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}
