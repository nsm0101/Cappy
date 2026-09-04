//
//  Models.swift
//  Cappy
//
//  Codable ports of the Supabase tables (app/src/api/database.types.ts).
//  Decoded with `.convertFromSnakeCase`, so JSON `date_of_birth` maps to
//  `dateOfBirth`, etc. All timestamps / dates are kept as ISO strings
//  (matching the source app) and parsed by the Domain time helpers.
//

import Foundation

// MARK: - Family

struct Family: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var createdBy: String?
    var createdAt: String?
    var updatedAt: String?
    var deletedAt: String?
}

/// A family plus the signed-in caregiver's role in it.
struct FamilyWithRole: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var createdBy: String?
    var createdAt: String?
    var myRole: CaregiverRole

    var family: Family {
        Family(id: id, name: name, createdBy: createdBy, createdAt: createdAt,
               updatedAt: nil, deletedAt: nil)
    }
}

struct FamilyCaregiver: Codable, Identifiable, Hashable {
    let id: String
    var familyId: String
    var userId: String
    var role: CaregiverRole
    var status: CaregiverStatus
    var joinedAt: String?
    var revokedAt: String?
    var expiresAt: String?
    var createdAt: String?
}

/// A caregiver membership joined with the person's profile (FamilyDashboard).
struct CaregiverWithProfile: Codable, Identifiable, Hashable {
    let id: String
    var familyId: String
    var userId: String
    var role: CaregiverRole
    var status: CaregiverStatus
    var joinedAt: String?
    var expiresAt: String?
    var displayName: String?
    var avatarUrl: String?
    var dateOfBirth: String?
}

// MARK: - Child

struct Child: Codable, Identifiable, Hashable {
    let id: String
    var familyId: String
    var displayName: String
    var dateOfBirth: String
    var avatarUrl: String?
    var createdAt: String?
    var updatedAt: String?
    var deletedAt: String?
}

struct WeightRecord: Codable, Identifiable, Hashable {
    let id: String
    var childId: String
    var valueGrams: Int
    var recordedAt: String
    var recordedBy: String?
    var createdAt: String?
}

struct ChildAllergy: Codable, Identifiable, Hashable {
    let id: String
    var childId: String
    var allergen: String
    var label: String
    var createdBy: String?
    var createdAt: String?
}

// MARK: - Medication

struct Medication: Codable, Identifiable, Hashable {
    let id: String
    var genericName: String
    var brandName: String?
    var concentrationLabel: String
    var concentrationMgPerMl: Double
    var formulation: MedicationFormulation
    var rxStatus: MedicationRxStatus
    var minAgeMonths: Int
    var minIntervalHours: Int
    var maxDosesPer24h: Int
    var createdAt: String?
}

// MARK: - Doses

struct DoseEvent: Codable, Identifiable, Hashable {
    let id: String
    var familyId: String
    var childId: String?
    var caregiverUserId: String?
    var medicationId: String
    var loggedBy: String
    var givenAt: String
    var loggedAt: String?
    var amountMg: Double
    var amountVolumeMl: Double?
    var unitCount: Int?
    var note: String?
}

/// Result of the compute_dose_status RPC. Decoded with `.convertFromSnakeCase`
/// (last_dose_at → lastDoseAt, …), so no explicit CodingKeys are needed.
struct DoseStatusResult: Codable, Hashable {
    var status: DoseStatus
    var lastDoseAt: String?
    var nextSafeAt: String?
    var dosesInLast24h: Int

    static let due = DoseStatusResult(status: .due, lastDoseAt: nil, nextSafeAt: nil, dosesInLast24h: 0)
}

/// One entry that was merged away into a canonical administration, kept so the
/// timeline can show where a reconciled dose came from. ¶[0058]: "an audit
/// representation can preserve the original local event records without
/// presenting duplicate administrations as independent doses."
struct ReconciliationSource: Codable, Hashable, Identifiable {
    /// The time that entry asserted, exactly as its device recorded it.
    var mergedGivenAt: String
    var mergedDeviceId: String?
    var separationSeconds: Double?
    var mergedLogger: NameOnly?

    var id: String { mergedGivenAt + (mergedDeviceId ?? "") }
    var loggerName: String { mergedLogger?.displayName ?? "Another caregiver" }
}

/// A dose row joined with medication + attribution + recipient (Timeline).
struct DoseEventWithDetails: Codable, Identifiable, Hashable {
    let id: String
    var familyId: String
    var childId: String?
    var caregiverUserId: String?
    var medicationId: String
    var loggedBy: String
    var givenAt: String
    var amountMg: Double
    var amountVolumeMl: Double?
    var unitCount: Int?
    var note: String?

    // ── Reconciliation (¶[0056]-[0058]) ───────────────────────────────
    /// The instant the interlocks use. For a reconciled administration this is
    /// the later of the colliding entries — the common administration time.
    var effectiveAt: String?
    var reconciliationStatus: ReconciliationState?
    var canonicalEventId: String?
    var deviceId: String?
    /// Entries merged into this one. Empty unless this row is canonical.
    var reconciliationSources: [ReconciliationSource]?

    /// True when this row absorbed at least one other device's entry for the
    /// same administration.
    var isReconciled: Bool {
        reconciliationStatus == .canonical && !(reconciliationSources ?? []).isEmpty
    }

    /// ¶[0058]: the interface marks a reconciled entry "while continuing to
    /// display the administration time used for safety calculations". For an
    /// ordinary dose that is simply when it was given.
    var displayTime: String { isReconciled ? (effectiveAt ?? givenAt) : givenAt }

    /// Every device's account of when this administration happened, earliest
    /// first, including this row's own.
    var allAssertedTimes: [(name: String, at: String, device: String?)] {
        var rows: [(String, String, String?)] = [
            (loggedByProfile?.displayName ?? "Someone", givenAt, deviceId)
        ]
        for source in reconciliationSources ?? [] {
            rows.append((source.loggerName, source.mergedGivenAt, source.mergedDeviceId))
        }
        return rows.sorted { $0.1 < $1.1 }.map { (name: $0.0, at: $0.1, device: $0.2) }
    }

    // Embedded relations. The PostgREST select in DosesRepository aliases
    // each embed to a snake_case key that `.convertFromSnakeCase` maps to
    // these property names (e.g. logged_by_profile → loggedByProfile).
    var medication: Medication?
    var loggedByProfile: NameOnly?
    var caregiverRecipient: NameAndAvatar?
    var child: NameAndAvatar?
}

struct NameOnly: Codable, Hashable {
    var displayName: String?
}

struct NameAndAvatar: Codable, Hashable {
    var displayName: String?
    var avatarUrl: String?
}

// MARK: - Profile

struct CaregiverProfile: Codable, Hashable {
    var displayName: String?
    var firstName: String?
    var lastName: String?
    var dateOfBirth: String?
    var avatarUrl: String?
    var consentVersion: String?
    var consentAcceptedAt: String?

    /// True when first-run setup is complete for the current consent version.
    func isComplete(currentConsentVersion: String) -> Bool {
        guard let name = displayName?.trimmingCharacters(in: .whitespaces), !name.isEmpty,
              dateOfBirth != nil,
              consentAcceptedAt != nil,
              consentVersion == currentConsentVersion
        else { return false }
        return true
    }
}
