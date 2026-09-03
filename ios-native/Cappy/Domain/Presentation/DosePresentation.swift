//
//  DosePresentation.swift
//  Cappy
//
//  Whether a dose quantity may be shown at all.
//
//  Patent ¶[0006], which is the centre of the whole application:
//
//      "treating the presentation of a dose quantity as a state that is
//       suppressed by default and released only upon affirmative satisfaction
//       of each of a plurality of independent preconditions ... Failure of any
//       precondition returns the presentation state to suppression rather than
//       to a value that has been computed and then concealed, so that no
//       numerical dose volume exists in the presentation path unless every
//       precondition has cleared."
//
//  The old shape computed a dose and then decided whether to render it. That
//  is compute-then-conceal: the number exists, and a view modifier is the only
//  thing between it and the screen. One `if` written the wrong way round, one
//  preview, one accessibility label reading a property it shouldn't, and the
//  number is out.
//
//  Here the quantity lives inside the `.released` case of an enum. In the
//  `.suppressed` case there is no quantity — not hidden, not zero, not
//  optional-and-nil. Absent. A view cannot render what it was never handed,
//  so the guarantee is carried by the type rather than by the discipline of
//  whoever writes the next screen.
//
//  Every field a suppressed state legitimately needs — when the last dose was,
//  when the next is permissible, how stale the weight is — lives in `DoseFacts`
//  and is available in both cases. Suppression withholds the dose, not the
//  explanation.
//

import Foundation

// MARK: - Why a dose is being withheld

/// The preconditions of ¶[0006], each of which independently returns the
/// presentation to suppression. Raw values match the codes returned by
/// `evaluate_dose_presentation`.
enum DoseSuppressionReason: String, Codable, Hashable, CaseIterable {
    /// ¶[0006] first precondition: the identifier did not resolve to a
    /// medication this build knows how to dose.
    case medicationUnresolved      = "medication_unresolved"
    case recipientUnknown          = "recipient_unknown"
    /// ¶[0007]: weakly bound identification awaiting a person's confirmation.
    case identificationUnconfirmed = "identification_unconfirmed"
    case noRuleForAge              = "no_rule_for_age"
    case ageRefused                = "age_refused"
    case allergyOnFile             = "allergy_on_file"
    /// ¶[0049] body-mass gate.
    case weightMissing             = "weight_missing"
    case weightStale               = "weight_stale"
    /// ¶[0051] interlocks.
    case sameMedicationInterval    = "same_medication_interval"
    case crossMedicationInterval   = "cross_medication_interval"
    case rollingWindowDoses        = "rolling_window_doses"
    case rollingWindowMass         = "rolling_window_mass"
    /// ¶[0052]: the record has a known gap the caregiver has not closed.
    case historyIncomplete         = "history_incomplete"
    /// Status could not be established — offline with no cached rule, or the
    /// server refused. Fails closed, per ¶[0006].
    case statusUnavailable         = "status_unavailable"

    /// Ordering for display. A caregiver holding a bottle wants the one thing
    /// standing in the way, and wants the most serious one first: an allergy
    /// outranks an interval, and an interval outranks a missing weight.
    var severity: Int {
        switch self {
        case .allergyOnFile:             return 0
        case .ageRefused:                return 1
        case .crossMedicationInterval:   return 2
        case .rollingWindowMass,
             .rollingWindowDoses:        return 3
        case .sameMedicationInterval:    return 4
        case .historyIncomplete:         return 5
        case .identificationUnconfirmed: return 6
        case .weightMissing,
             .weightStale:               return 7
        case .medicationUnresolved,
             .noRuleForAge,
             .recipientUnknown,
             .statusUnavailable:         return 8
        }
    }

    /// Whether the caregiver can clear this here and now. Drives whether the
    /// card offers an action or only an explanation — a stale weight has a
    /// fix, a 24-hour maximum does not.
    var isActionable: Bool {
        switch self {
        case .weightMissing, .weightStale,
             .identificationUnconfirmed, .historyIncomplete:
            return true
        default:
            return false
        }
    }

    /// True where a caregiver may deliberately proceed past the block after an
    /// explicit warning — because the clinical judgement is theirs and the app
    /// is a coordination aid, not a lock. An allergy on file and a refused age
    /// band are not among them.
    var isOverridable: Bool {
        switch self {
        case .sameMedicationInterval, .rollingWindowDoses,
             .rollingWindowMass, .crossMedicationInterval:
            return true
        default:
            return false
        }
    }
}

// MARK: - The two states

/// The quantity. Exists only inside `.released`.
struct DoseQuantity: Hashable {
    let mg: Double
    let volumeMl: Double?
    /// True when the per-dose ceiling bound the result rather than the
    /// weight-based calculation — worth saying, because a capped dose does not
    /// scale with the child any more.
    let capped: Bool
    let capMg: Double?

    var displayMg: Int { Int(mg.rounded()) }
    var displayMl: Double? { volumeMl.map { ($0 * 10).rounded() / 10 } }
}

/// Everything *except* the quantity. Available in both states, because
/// suppression withholds the dose and not the reasons for it.
struct DoseFacts: Hashable {
    var status: DoseStatus = .unknown
    var basis: DoseBasis = .none
    var lastDoseAt: Date?
    var nextSafeAt: Date?
    var dosesInLast24h: Int = 0

    var windowHours: Double?
    var windowMg: Double?
    var windowLimitMg: Double?
    var windowMaxDoses: Int?

    var weight: WeightFreshness.Verdict?
    var ageMonths: Double?
    var minIntervalHours: Double?

    var crossMedicationGeneric: String?
    var crossMedicationClearAt: Date?

    /// ¶[0052]: false when a tap was never answered and the recent history is
    /// therefore known to be short.
    var historyComplete: Bool = true

    /// ¶[0048]: where the rule came from. The system does not originate
    /// clinical rules and says so.
    var ruleSource: String?

    /// True when this evaluation came from the device's own cached rules
    /// rather than the server — shown so a caregiver knows the answer was
    /// computed without the shared record.
    var evaluatedOffline: Bool = false
}

enum DoseBasis: String, Codable, Hashable {
    /// Quantity derived from body mass and a coefficient.
    case weight
    /// Adult recipient: the caregiver enters the amount. There is no
    /// calculated quantity to suppress, but the interlocks still apply.
    case manual
    case none
}

/// The presentation state itself.
enum DosePresentation: Hashable {
    case released(DoseQuantity?, DoseFacts)
    case suppressed([DoseSuppressionReason], DoseFacts)

    var facts: DoseFacts {
        switch self {
        case .released(_, let f), .suppressed(_, let f): return f
        }
    }

    var isReleased: Bool {
        if case .released = self { return true }
        return false
    }

    /// The quantity, or nil. There is no accessor that manufactures one.
    var quantity: DoseQuantity? {
        if case .released(let q, _) = self { return q }
        return nil
    }

    var reasons: [DoseSuppressionReason] {
        if case .suppressed(let r, _) = self { return r.sorted { $0.severity < $1.severity } }
        return []
    }

    /// The single reason to lead with.
    var primaryReason: DoseSuppressionReason? { reasons.first }

    /// True when every remaining obstacle is one the caregiver may knowingly
    /// pass — the "log anyway" path. False when at least one is not.
    var isOverridable: Bool {
        guard case .suppressed(let r, _) = self, !r.isEmpty else { return false }
        return r.allSatisfy(\.isOverridable)
    }

    /// Fail-closed constructor for every path that could not establish state.
    static func unavailable(_ facts: DoseFacts = DoseFacts()) -> DosePresentation {
        .suppressed([.statusUnavailable], facts)
    }
}

// MARK: - Caregiver-facing copy

extension DoseSuppressionReason {
    func title(recipient: String) -> String {
        switch self {
        case .medicationUnresolved:      return "Cappy doesn't recognise this medication"
        case .recipientUnknown:          return "Cappy doesn't have this family member"
        case .identificationUnconfirmed: return "Confirm the medication first"
        case .noRuleForAge:              return "No dosing rule for \(recipient)'s age"
        case .ageRefused:                return "Not for \(recipient)'s age"
        case .allergyOnFile:             return "Allergy on file"
        case .weightMissing:             return "\(recipient)'s weight is needed"
        case .weightStale:               return "Time for a new weight"
        case .sameMedicationInterval:    return "Too early"
        case .crossMedicationInterval:   return "Too close to another medication"
        case .rollingWindowDoses:        return "24-hour maximum reached"
        case .rollingWindowMass:         return "24-hour maximum reached"
        case .historyIncomplete:         return "One thing to check first"
        case .statusUnavailable:         return "Cappy can't check this right now"
        }
    }

    /// The explanation. Written to say what is true and what to do, and never
    /// to imply a number exists behind the message.
    func detail(recipient: String, facts: DoseFacts, medication: String) -> String {
        switch self {
        case .medicationUnresolved:
            return "This version of Cappy doesn't have dosing information for it. Check the package and give it the way the label says."
        case .recipientUnknown:
            return "Pick a family member to see dosing information."
        case .identificationUnconfirmed:
            return BindingStrength.weak.confirmationPrompt
        case .noRuleForAge:
            return "Cappy has no dosing rule for \(medication) at \(recipient)'s age. Ask your pediatrician."
        case .ageRefused:
            return "\(medication) isn't recommended at \(recipient)'s age. Ask your pediatrician."
        case .allergyOnFile:
            return "\(recipient) has an allergy on file that rules out \(medication)."
        case .weightMissing:
            return "Cappy works out the dose from \(recipient)'s weight, so it needs one before it can show an amount."
        case .weightStale:
            return WeightFreshness.explanation(
                for: facts.weight ?? .init(grams: nil, recordedAt: nil, ageMonthsAtRecord: nil,
                                           expectedDrift: nil, thresholdDays: nil,
                                           staleAt: nil, isStale: true),
                childName: recipient)
        case .sameMedicationInterval:
            let hours = facts.minIntervalHours.map { $0 == $0.rounded() ? String(Int($0)) : String(format: "%.1f", $0) } ?? "6"
            guard let next = facts.nextSafeAt else {
                return "The minimum \(hours)-hour gap between doses hasn't passed yet."
            }
            return "The minimum \(hours)-hour gap hasn't passed. The next dose is safe \(CappyTime.timeUntil(next)) (at \(CappyTime.clock(next)))."
        case .crossMedicationInterval:
            let other = facts.crossMedicationGeneric?.capitalized ?? "another medication"
            guard let clear = facts.crossMedicationClearAt else {
                return "\(other) was given recently and overlaps with \(medication)."
            }
            return "\(other) was given recently and does much the same thing as \(medication). Wait until \(CappyTime.clock(clear)) (\(CappyTime.timeUntil(clear)))."
        case .rollingWindowDoses:
            let max = facts.windowMaxDoses.map(String.init) ?? "the daily"
            return "\(recipient) has had \(facts.dosesInLast24h) doses of \(medication) — the \(max)-dose limit for a 24-hour period."
        case .rollingWindowMass:
            guard let used = facts.windowMg, let limit = facts.windowLimitMg else {
                return "\(recipient) has reached the 24-hour limit for \(medication)."
            }
            return "\(recipient) has had \(Int(used.rounded())) mg of \(medication) in the last 24 hours, and another full dose would pass the \(Int(limit.rounded())) mg limit."
        case .historyIncomplete:
            return "You opened a dose recently and never logged it. Cappy can only space doses using what's been recorded — tell it what happened and it'll carry on."
        case .statusUnavailable:
            return "Cappy couldn't check recent doses, and it won't show an amount it can't check. Try again in a moment."
        }
    }

    /// Label for the action that clears this, when one exists.
    func actionLabel(recipient: String) -> String? {
        switch self {
        case .weightMissing:             return "Add \(recipient)'s weight"
        case .weightStale:               return "Update weight"
        case .identificationUnconfirmed: return "Confirm medication"
        case .historyIncomplete:         return "Sort that out"
        default:                         return nil
        }
    }
}

extension DoseSuppressionReason {
    /// One line, for a dense list where each child gets a single row. Says the
    /// thing that would change the answer, not the rule that produced it.
    func shortLabel(recipient: String, facts: DoseFacts) -> String {
        switch self {
        case .medicationUnresolved:      return "Medication not recognised"
        case .recipientUnknown:          return "Not on file"
        case .identificationUnconfirmed: return "Confirm the medication first"
        case .noRuleForAge:              return "No rule for this age"
        case .ageRefused:                return "Not for this age"
        case .allergyOnFile:             return "Allergy on file"
        case .weightMissing:             return "No weight on file"
        case .weightStale:
            guard let drift = facts.weight?.expectedDrift, drift > 0 else { return "Weight needs updating" }
            return "Weight is \(Int((drift * 100).rounded()))% out of date"
        case .sameMedicationInterval:
            return facts.nextSafeAt.map { "Too early — safe at \(CappyTime.clock($0))" } ?? "Too early"
        case .crossMedicationInterval:
            let other = facts.crossMedicationGeneric?.capitalized ?? "another medication"
            return "Too close to \(other)"
        case .rollingWindowDoses, .rollingWindowMass:
            return "24-hour maximum reached"
        case .historyIncomplete:         return "Unlogged dose to sort out"
        case .statusUnavailable:         return "Couldn't check"
        }
    }
}
