//
//  ResolvedTag.swift
//  Cappy
//
//  The payload returned by the `nfc-resolve` Edge Function: a tag UID
//  resolved into its medication + family context, with per-child and
//  per-caregiver dose-safety status. Mirrors app/src/api/nfc.ts ResolvedTag.
//

import Foundation

struct ResolvedTag: Codable, Hashable {
    let tag: TagRef
    let family: FamilyRef
    let medication: Medication
    let children: [ResolvedChild]
    let caregivers: [ResolvedCaregiver]

    struct TagRef: Codable, Hashable {
        let id: String
        let label: String?
        let status: String
    }

    struct FamilyRef: Codable, Hashable, Identifiable {
        let id: String
        let name: String
    }

    /// A child recipient with weight/age-driven dosing + dose-safety status.
    struct ResolvedChild: Codable, Hashable, Identifiable {
        let id: String
        let displayName: String
        let dateOfBirth: String
        let avatarUrl: String?
        let status: DoseStatus
        let lastDoseAt: String?
        let nextSafeAt: String?
        let dosesInLast24h: Int
    }

    /// An adult caregiver recipient (manual amount entry) + dose-safety status.
    struct ResolvedCaregiver: Codable, Hashable, Identifiable {
        let id: String
        let displayName: String?
        let avatarUrl: String?
        let status: DoseStatus
        let lastDoseAt: String?
        let nextSafeAt: String?
        let dosesInLast24h: Int
    }
}

/// A dose recipient is either a child (weight/age dosing) or an adult
/// caregiver (manual entry) — unified for the DoseSheet recipient picker.
enum DoseRecipient: Hashable, Identifiable {
    case child(ResolvedTag.ResolvedChild)
    case caregiver(ResolvedTag.ResolvedCaregiver)

    var id: String {
        switch self {
        case .child(let c): return "child:\(c.id)"
        case .caregiver(let c): return "caregiver:\(c.id)"
        }
    }

    var recipientId: String {
        switch self {
        case .child(let c): return c.id
        case .caregiver(let c): return c.id
        }
    }

    var name: String {
        switch self {
        case .child(let c): return c.displayName
        case .caregiver(let c): return c.displayName ?? "Caregiver"
        }
    }

    var avatarUrl: String? {
        switch self {
        case .child(let c): return c.avatarUrl
        case .caregiver(let c): return c.avatarUrl
        }
    }

    var status: DoseStatus {
        switch self {
        case .child(let c): return c.status
        case .caregiver(let c): return c.status
        }
    }

    var isChild: Bool {
        if case .child = self { return true }
        return false
    }
}
