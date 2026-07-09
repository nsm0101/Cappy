//
//  Format.swift
//  Cappy
//
//  Value formatting ported from app/src/lib/format.ts — dose amounts,
//  initials, and weight display.
//

import Foundation

enum CappyFormat {

    struct DoseAmount { let primary: String; let secondary: String? }

    /// Format a dose amount, picking the most natural unit for the formulation.
    static func doseAmount(formulation: MedicationFormulation,
                           amountMg: Double?,
                           amountVolumeMl: Double?,
                           unitCount: Int?) -> DoseAmount {
        switch formulation {
        case .liquidSuspension, .infantDrops:
            if let ml = amountVolumeMl {
                return DoseAmount(primary: "\(trim(ml)) mL",
                                  secondary: amountMg.map { "\(trim($0)) mg" })
            }
        case .chewable, .oralDisintegrating:
            if let count = unitCount {
                let noun = formulation == .chewable ? "chewable" : "tablet"
                let label = count == 1 ? noun : noun + "s"
                return DoseAmount(primary: "\(count) \(label)",
                                  secondary: amountMg.map { "\(trim($0)) mg" })
            }
        }
        if let mg = amountMg { return DoseAmount(primary: "\(trim(mg)) mg", secondary: nil) }
        return DoseAmount(primary: "—", secondary: nil)
    }

    /// "32.000" → "32"; "5.5" → "5.5".
    static func trim(_ n: Double) -> String {
        var s = String(format: "%.3f", n)
        while s.contains(".") && (s.hasSuffix("0") || s.hasSuffix(".")) {
            s.removeLast()
        }
        return s
    }

    /// Compute up-to-2-char initials from a display name. "Ava M." → "AM".
    static func initials(from name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return "?" }
        let parts = trimmed.split(whereSeparator: { $0.isWhitespace })
        if parts.count == 1 {
            return String(parts[0].prefix(2)).uppercased()
        }
        let first = parts.first?.first.map(String.init) ?? ""
        let last = parts.last?.first.map(String.init) ?? ""
        return (first + last).uppercased()
    }

    /// Weight display. US design partners default to pounds.
    static func weight(fromGrams grams: Int?, unit: WeightUnit = .lb) -> String {
        guard let grams else { return "—" }
        switch unit {
        case .kg:
            return String(format: "%.1f kg", Double(grams) / 1000)
        case .lb:
            let lb = Double(grams) / 453.592
            return "\(Int(lb.rounded())) lb"
        }
    }

    enum WeightUnit { case lb, kg }
}
