//
//  Dosing.swift
//  Cappy
//
//  Faithful Swift port of the Cappy antipyretic dosing engine
//  (app/src/lib/dosing.ts), itself a port of the closedose.com calculator.
//
//  SAFETY: single source of truth for dose *amount* math. The server owns
//  the *clock* (interval + 24h cap via compute_dose_status). This is a
//  coordination aid, not medical advice — callers must surface the
//  not-medical-advice disclaimer and never auto-administer.
//
//  Age gates (by exact age):
//    < 2 months          → emergency  (no dose; seek care)
//    2 to < 6 months      → infant     (acetaminophen only, q4h)
//    6 months to < 12 yr  → pediatric  (acetaminophen + ibuprofen, q6h)
//    >= 12 years          → adolescent (higher single-dose caps, q6h)
//

import Foundation

enum AgeGate: String {
    case emergency, infant, pediatric, adolescent
}

enum MedicationKind: String {
    case acetaminophen, ibuprofen
}

enum Dosing {
    static let lbsPerKg = 2.20462
    static func kgFromLbs(_ lbs: Double) -> Double { lbs / lbsPerKg }
    static func lbsFromKg(_ kg: Double) -> Double { kg * lbsPerKg }

    private static let monthsIn12Years = 144

    /// Map an exact age in months to a dosing pathway.
    static func resolveAgeGate(ageMonths: Int) -> AgeGate {
        if ageMonths < 2 { return .emergency }
        if ageMonths < 6 { return .infant }
        if ageMonths < monthsIn12Years { return .pediatric }
        return .adolescent
    }

    /// Whole-month age from an ISO date-of-birth string (YYYY-MM-DD).
    static func ageMonthsFromDob(_ dobISO: String, now: Date = Date()) -> Int {
        guard let dob = Self.dobFormatter.date(from: String(dobISO.prefix(10)))
            ?? ISO8601DateFormatter().date(from: dobISO)
        else { return 0 }
        let cal = Calendar(identifier: .gregorian)
        let comps = cal.dateComponents([.month, .day], from: dob, to: now)
        let years = cal.dateComponents([.year], from: dob, to: now).year ?? 0
        var months = years * 12 + (comps.month ?? 0)
        // The date-of-birth day-of-month adjustment is already handled by
        // Calendar's component diff, but guard against negatives.
        if months < 0 { months = 0 }
        return months
    }

    private static let dobFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    // Product concentrations (mg per mL).
    private static let acetaminophen160per5 = 160.0 / 5.0  // 32 mg/mL
    private static let ibuprofenChild100per5 = 100.0 / 5.0 // 20 mg/mL
    private static let ibuprofenInfant50per125 = 50.0 / 1.25 // 40 mg/mL

    static let freqQ4 = "Every 4 hours as needed for fever or pain"
    static let freqQ6 = "Every 6 hours as needed for fever or pain"
    static let ibuprofenUnder6Months =
        "Ibuprofen is not recommended for infants under six months. Consult your pediatrician."

    private static func round0(_ n: Double) -> Int { Int((n).rounded()) }
    private static func round1(_ n: Double) -> Double { (n * 10).rounded() / 10 }

    private static func acetaminophenDose(
        weightKg: Double, mgPerKg: Double, capMg: Double,
        intervalHours: Int, frequencyLabel: String
    ) -> MedDose {
        let calculated = mgPerKg * weightKg
        let mg = min(calculated, capMg)
        let ml = (mg / 160) * 5
        return MedDose(
            medication: .acetaminophen,
            recommendedMg: mg,
            displayMg: round0(mg),
            capped: calculated > capMg,
            capMg: capMg,
            intervalHours: intervalHours,
            frequencyLabel: frequencyLabel,
            volumes: [
                DoseVolumeOption(
                    label: "Acetaminophen 160 mg / 5 mL",
                    concentrationMgPerMl: acetaminophen160per5,
                    ml: ml, displayMl: round1(ml))
            ])
    }

    private static func ibuprofenDose(weightKg: Double, capMg: Double) -> MedDose {
        let calculated = 10 * weightKg
        let mg = min(calculated, capMg)
        let ml100 = (mg / 100) * 5
        let ml50 = (mg / 50) * 1.25
        return MedDose(
            medication: .ibuprofen,
            recommendedMg: mg,
            displayMg: round0(mg),
            capped: calculated > capMg,
            capMg: capMg,
            intervalHours: 6,
            frequencyLabel: freqQ6,
            volumes: [
                DoseVolumeOption(label: "Children's ibuprofen 100 mg / 5 mL",
                                 concentrationMgPerMl: ibuprofenChild100per5,
                                 ml: ml100, displayMl: round1(ml100)),
                DoseVolumeOption(label: "Infant's ibuprofen 50 mg / 1.25 mL",
                                 concentrationMgPerMl: ibuprofenInfant50per125,
                                 ml: ml50, displayMl: round1(ml50))
            ])
    }

    private static func spacingReminder(acet: MedDose?, ibu: MedDose?) -> String {
        let acetCapped = acet?.capped ?? false
        let ibuCapped = ibu?.capped ?? false
        if acetCapped || ibuCapped, let acetCap = acet?.capMg, let ibuCap = ibu?.capMg {
            return "Never exceed \(Int(acetCap)) mg of acetaminophen or \(Int(ibuCap)) mg of ibuprofen in a single dose, and allow at least 6 hours between doses."
        }
        return "Allow at least 6 hours between doses of acetaminophen or ibuprofen. Follow the product instructions for maximum amounts."
    }

    /// Compute the full antipyretic dosing result for a patient.
    static func computeDosing(weightKg: Double, ageMonths: Int) -> DosingResult {
        let ageGate = resolveAgeGate(ageMonths: ageMonths)

        guard weightKg.isFinite, weightKg > 0 else {
            return DosingResult(ageGate: ageGate, ageMonths: ageMonths, weightKg: weightKg,
                                emergency: ageGate == .emergency, acetaminophen: nil, ibuprofen: nil,
                                ibuprofenSuppressedReason: nil, spacingReminder: "")
        }

        if ageGate == .emergency {
            return DosingResult(ageGate: ageGate, ageMonths: ageMonths, weightKg: weightKg,
                                emergency: true, acetaminophen: nil, ibuprofen: nil,
                                ibuprofenSuppressedReason: nil, spacingReminder: "")
        }

        if ageGate == .infant {
            let acet = acetaminophenDose(weightKg: weightKg, mgPerKg: 12.5, capMg: 160,
                                         intervalHours: 4, frequencyLabel: freqQ4)
            return DosingResult(ageGate: ageGate, ageMonths: ageMonths, weightKg: weightKg,
                                emergency: false, acetaminophen: acet, ibuprofen: nil,
                                ibuprofenSuppressedReason: ibuprofenUnder6Months,
                                spacingReminder: "Allow at least 4 hours between doses of acetaminophen. Follow the product instructions for maximum amounts.")
        }

        // pediatric or adolescent
        let acetCap: Double = ageGate == .pediatric ? 480 : 1000
        let ibuCap: Double = ageGate == .pediatric ? 400 : 600
        let acet = acetaminophenDose(weightKg: weightKg, mgPerKg: 15, capMg: acetCap,
                                     intervalHours: 6, frequencyLabel: freqQ6)
        let ibu = ibuprofenDose(weightKg: weightKg, capMg: ibuCap)

        return DosingResult(ageGate: ageGate, ageMonths: ageMonths, weightKg: weightKg,
                            emergency: false, acetaminophen: acet, ibuprofen: ibu,
                            ibuprofenSuppressedReason: nil,
                            spacingReminder: spacingReminder(acet: acet, ibu: ibu))
    }

    /// Pick the dose for a specific medication kind.
    static func dose(_ result: DosingResult, for kind: MedicationKind) -> MedDose? {
        kind == .acetaminophen ? result.acetaminophen : result.ibuprofen
    }

    /// Resolve a generic medication name to a `MedicationKind`.
    static func kind(forGeneric genericName: String) -> MedicationKind {
        genericName.lowercased() == "ibuprofen" ? .ibuprofen : .acetaminophen
    }
}

struct DoseVolumeOption: Hashable {
    let label: String
    let concentrationMgPerMl: Double
    let ml: Double
    let displayMl: Double
}

struct MedDose: Hashable {
    let medication: MedicationKind
    let recommendedMg: Double
    let displayMg: Int
    let capped: Bool
    let capMg: Double
    let intervalHours: Int
    let frequencyLabel: String
    let volumes: [DoseVolumeOption]
}

struct DosingResult: Hashable {
    let ageGate: AgeGate
    let ageMonths: Int
    let weightKg: Double
    let emergency: Bool
    let acetaminophen: MedDose?
    let ibuprofen: MedDose?
    let ibuprofenSuppressedReason: String?
    let spacingReminder: String
}
