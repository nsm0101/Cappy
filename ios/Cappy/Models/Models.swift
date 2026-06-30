import Foundation
import SwiftUI

// MARK: - Child Model
struct Child: Identifiable, Codable {
    let id: UUID
    var name: String
    var initials: String {
        let components = name.components(separatedBy: " ")
        if components.count > 1, let first = components.first?.first, let last = components.last?.first {
            return "\(first)\(last)"
        }
        return String(name.prefix(2))
    }
    var weightValue: Double // in kg or lbs depending on preference
    var weightUnit: String // "kg" or "lbs"
    var avatarColorHex: String // stable visual accent color
    
    var themeColor: Color {
        Color(hex: avatarColorHex)
    }
    
    var weightInKg: Double {
        if weightUnit.lowercased() == "lbs" {
            return weightValue / 2.20462
        }
        return weightValue
    }
}

// MARK: - Medication Model
struct Medication: Identifiable, Codable {
    let id: UUID
    var name: String // e.g. "Acetaminophen"
    var brandName: String? // e.g. "Tylenol"
    var variant: String // e.g. "Children's Suspension" or "Infant Drops"
    var concentrationMgPerMl: Double // e.g. 32.0 mg/mL (160mg/5mL) or 80.0 mg/mL
    var maxDoseMg: Double // standard ceiling limit
    var defaultIntervalHours: Int // e.g. 4 or 6
    var colorHex: String // visual identity color for timelines
    
    var displayName: String {
        if let brand = brandName {
            return "\(brand) (\(name))"
        }
        return name
    }
}

// MARK: - DoseEvent Model
struct DoseEvent: Identifiable, Codable {
    let id: UUID
    let childId: UUID
    let medicationId: UUID
    var amountMl: Double
    var amountMg: Double {
        amountMl * concentration // convenience lookup
    }
    var concentration: Double // snapshot of concentrationMgPerMl
    var timestamp: Date
    var loggedBy: String // Caregiver name
    var isCorrected: Bool
    var correctedEventId: UUID?
    
    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: timestamp)
    }
}

// MARK: - NFCTag Model
struct NFCTag: Identifiable, Codable {
    let id: String // Tag UID from hardware
    let medicationId: UUID
    let familyId: UUID
    var registeredAt: Date
    var registeredBy: UUID
}
