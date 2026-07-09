//
//  Enums.swift
//  Cappy
//
//  Enum ports of the Postgres enums (app/src/api/database.types.ts) plus the
//  dose-safety status returned by the compute_dose_status RPC.
//

import Foundation

enum CaregiverRole: String, Codable, CaseIterable {
    case admin, caregiver, readonly, guestRole

    // "guest" is a Swift reserved-ish word only by convention; map explicitly.
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        switch raw {
        case "admin": self = .admin
        case "caregiver": self = .caregiver
        case "readonly": self = .readonly
        case "guest": self = .guestRole
        default: self = .caregiver
        }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(serverValue)
    }
    var serverValue: String {
        switch self {
        case .admin: return "admin"
        case .caregiver: return "caregiver"
        case .readonly: return "readonly"
        case .guestRole: return "guest"
        }
    }
    var label: String {
        switch self {
        case .admin: return "Admin"
        case .caregiver: return "Caregiver"
        case .readonly: return "Read-only"
        case .guestRole: return "Guest"
        }
    }
}

enum CaregiverStatus: String, Codable {
    case active, revoked, pending
}

enum TagStatus: String, Codable {
    case active, revoked, pending
}

enum MedicationRxStatus: String, Codable {
    case otc, rx
}

enum MedicationFormulation: String, Codable {
    case liquidSuspension = "liquid_suspension"
    case infantDrops = "infant_drops"
    case chewable
    case oralDisintegrating = "oral_disintegrating"
}

/// Dose-safety status — the signature Cappy concept. Raw values match the
/// strings returned by the `compute_dose_status` RPC / nfc-resolve function.
enum DoseStatus: String, Codable {
    case due
    case early
    case recent
    case overdue
    case maxReached = "max_reached"
    case unknown

    /// The Home-screen status label (matches HomeScreen STATUS_LABEL).
    var homeLabel: String {
        switch self {
        case .due: return "Due now"
        case .early: return "Too early"
        case .recent: return "Given recently"
        case .overdue: return "Overdue"
        case .maxReached: return "24-hour limit reached"
        case .unknown: return "Status unavailable"
        }
    }

    /// The caregiver-recipient status label (DoseSheet CAREGIVER_STATUS_LABEL).
    var caregiverLabel: String {
        switch self {
        case .due: return "OK to give now"
        case .early: return "Too early"
        case .recent: return "Given recently"
        case .overdue: return "Window passed — check before giving"
        case .maxReached: return "24-hour limit reached"
        case .unknown: return "Status unavailable"
        }
    }
}
