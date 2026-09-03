//
//  Acquisition.swift
//  Cappy
//
//  How a medication identifier was obtained, and how much that identification
//  is worth.
//
//  Two separate questions, and the patent is emphatic that they are separate
//  (¶[0007]): "reliability of the radio link and reliability of the
//  association are accordingly evaluated separately, and a faultless read of a
//  weakly bound identifier does not by itself satisfy the first precondition."
//
//  The channel says how the bytes arrived. The binding says whether the
//  article those bytes came from is one that stays with its medication on its
//  own — and that is a property of where the article lives, not of how well
//  the radio worked.
//

import Foundation

/// The ordered acquisition sequence of ¶[0006]: near-field, then optical, then
/// confirmed-manual, "so that failure of one channel does not defeat
/// identification and so that the channel actually used is itself recorded."
///
/// `order` is the fallback sequence. Nothing skips ahead: the manual channel is
/// reachable only after the two machine-readable ones have been tried or
/// declined, which is what keeps it a fallback rather than the default path.
enum AcquisitionChannel: String, Codable, CaseIterable, Hashable {
    case nfc
    case optical
    case manualConfirmed = "manual_confirmed"

    var order: Int {
        switch self {
        case .nfc: return 0
        case .optical: return 1
        case .manualConfirmed: return 2
        }
    }

    var next: AcquisitionChannel? {
        switch self {
        case .nfc: return .optical
        case .optical: return .manualConfirmed
        case .manualConfirmed: return nil
        }
    }

    /// Shown on the dose record so a caregiver reading history later can see
    /// how the medication was identified, not just which one it was.
    var label: String {
        switch self {
        case .nfc: return "Tapped"
        case .optical: return "Scanned"
        case .manualConfirmed: return "Chosen by hand"
        }
    }

    var detail: String {
        switch self {
        case .nfc: return "Identified by tapping the Cappy token."
        case .optical: return "Identified by scanning the code on the package."
        case .manualConfirmed: return "Identified by picking the medication from a list and confirming it."
        }
    }
}

/// ¶[0007]: "the confidence that attaches to an identification is a property
/// of the physical article carrying the identifier and not of the identifier
/// itself."
///
/// A token seated in the cup's recess is *strong*: the cup is stored with its
/// bottle, so the geometry maintains the association and no caregiver act is
/// needed to keep it true. A carrier a user shrank onto a syringe barrel is
/// *weak*: that syringe is stored in a drawer with every other syringe, and
/// nothing keeps it with the medication it was commissioned against.
///
/// A weak identification is a candidate. It is confirmed by a person before
/// any dose is released — see `DoseSuppressionReason.identificationUnconfirmed`.
enum BindingStrength: String, Codable, Hashable {
    case strong
    case weak

    /// True when a person must affirm the medication before the dose is
    /// released. Not a UI preference — the first precondition of ¶[0006] is
    /// not satisfied without it.
    var requiresAffirmativeConfirmation: Bool { self == .weak }

    var label: String {
        switch self {
        case .strong: return "Held with the medication"
        case .weak: return "Applied to a syringe"
        }
    }

    var confirmationPrompt: String {
        "This label was applied by hand, so Cappy can't be sure the syringe is still with the same bottle. Check the bottle and confirm the medication before dosing."
    }
}
