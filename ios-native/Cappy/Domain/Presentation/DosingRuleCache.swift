//
//  DosingRuleCache.swift
//  Cappy
//
//  The clinical rule set, cached on the device.
//
//  Patent ¶[0048]: the medication record holds the coefficient, the per-dose
//  bounds, the same-medication interval, the cross-medication interval and the
//  rolling-window limit, and "these values may originate from a clinician,
//  manufacturer, pharmacy, authoritative formulary, or configuration under
//  appropriate oversight. The system need not independently establish a
//  clinical rule."
//
//  Two things follow, and both matter more than they look.
//
//  A coefficient compiled into the binary cannot be corrected without an App
//  Store review. If a per-dose ceiling turns out to be wrong, "ship a new
//  build and wait a week" is not an acceptable remediation for a dosing app.
//  So the rules are data, fetched from the server.
//
//  But an app that can only dose while it has signal is useless at 2 AM in a
//  house with bad reception, and ¶[0053] explicitly contemplates operating
//  offline. So the rules are also cached, and the cache is treated as the
//  clinical record it is: it is written atomically, it is versioned, and when
//  it is absent or unreadable the evaluator returns `.statusUnavailable`
//  rather than falling back on a guess.
//

import Foundation

// MARK: - Wire types

struct MedicationDoseRule: Codable, Hashable {
    let genericName: String
    let minAgeMonths: Double
    let maxAgeMonths: Double
    let doseCoefficientMgPerKg: Double?
    let fixedDoseMg: Double?
    let singleDoseMaxMg: Double?
    let minIntervalHours: Double
    let rollingWindowHours: Double
    let rollingWindowMaxMgPerKg: Double?
    let rollingWindowMaxMg: Double?
    let rollingWindowMaxDoses: Int?
    let refuseReason: String?
    let source: String
}

struct MedicationInteraction: Codable, Hashable {
    let genericA: String
    let genericB: String
    let bAfterAHours: Double
    let aAfterBHours: Double
    let severity: String
    let rationale: String

    /// Hours that must pass before `generic` may be given, when `prior` was
    /// the last dose. Asymmetric by design: a 24-hour agent followed by a
    /// 6-hour one is not the same problem as the reverse.
    func requiredHours(giving generic: String, after prior: String) -> Double? {
        let g = generic.lowercased(), p = prior.lowercased()
        if g == genericA.lowercased() && p == genericB.lowercased() { return aAfterBHours }
        if g == genericB.lowercased() && p == genericA.lowercased() { return bAfterAHours }
        return nil
    }

    func other(than generic: String) -> String? {
        let g = generic.lowercased()
        if g == genericA.lowercased() { return genericB }
        if g == genericB.lowercased() { return genericA }
        return nil
    }
}

struct MedicationContraindication: Codable, Hashable {
    let genericName: String
    let allergenKey: String
}

/// Everything the offline evaluator needs, in one atomically-written blob.
struct DosingRuleSet: Codable, Hashable {
    var fetchedAt: Date
    var rules: [MedicationDoseRule]
    var interactions: [MedicationInteraction]
    var contraindications: [MedicationContraindication]
    var growthBands: [GrowthBand]
    var policy: [String: Double]
}

// MARK: - Cache

final class DosingRuleCache {
    static let shared = DosingRuleCache()

    private let queue = DispatchQueue(label: "cappy.rulecache", attributes: .concurrent)
    private var _set: DosingRuleSet?

    private var fileURL: URL {
        let dir = (try? FileManager.default.url(for: .applicationSupportDirectory,
                                                in: .userDomainMask,
                                                appropriateFor: nil, create: true))
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        return dir.appendingPathComponent("cappy-dosing-rules.json")
    }

    private init() { _set = readFromDisk() }

    var current: DosingRuleSet? { queue.sync { _set } }

    var growthBands: [GrowthBand]? { current?.growthBands.isEmpty == false ? current?.growthBands : nil }
    var doseDriftTolerance: Double? { current?.policy["dose_drift_tolerance"] }
    func policy(_ key: String, default fallback: Double) -> Double {
        current?.policy[key] ?? fallback
    }

    /// True when the device holds a rule set it may evaluate against. An
    /// evaluator that finds this false must suppress, not improvise.
    var isUsable: Bool { (current?.rules.isEmpty == false) }

    /// The rule in force for a generic at an age. Mirrors `dose_rule_for`.
    func rule(forGeneric generic: String, ageMonths: Double) -> MedicationDoseRule? {
        let g = generic.lowercased()
        return current?.rules
            .filter { $0.genericName.lowercased() == g
                        && ageMonths >= $0.minAgeMonths && ageMonths < $0.maxAgeMonths }
            .max(by: { $0.minAgeMonths < $1.minAgeMonths })
    }

    func interactions(involving generic: String) -> [MedicationInteraction] {
        let g = generic.lowercased()
        return current?.interactions.filter {
            $0.severity == "block" &&
            ($0.genericA.lowercased() == g || $0.genericB.lowercased() == g)
        } ?? []
    }

    func contraindicated(generic: String, allergenKeys: [String]) -> Bool {
        let g = generic.lowercased()
        let blockers = Set((current?.contraindications ?? [])
            .filter { $0.genericName.lowercased() == g }
            .map(\.allergenKey))
        return allergenKeys.contains(where: blockers.contains)
    }

    // MARK: Persistence

    func store(_ set: DosingRuleSet) {
        queue.async(flags: .barrier) { self._set = set }
        guard let data = try? JSONEncoder.cappy.encode(set) else { return }
        // Atomic: a rule set half-written by a backgrounded app is a rule set
        // that must never be read.
        try? data.write(to: fileURL, options: [.atomic])
    }

    private func readFromDisk() -> DosingRuleSet? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder.cappy.decode(DosingRuleSet.self, from: data)
    }

    /// Age of the cache. Surfaced rather than enforced: refusing to dose
    /// because the rules are a fortnight old would fail in the wrong
    /// direction for a family with no signal, and OTC dosing rules do not
    /// change weekly.
    var age: TimeInterval? { current.map { Date().timeIntervalSince($0.fetchedAt) } }
}

// MARK: - Shared coders

extension JSONEncoder {
    static let cappy: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}

extension JSONDecoder {
    static let cappy: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}
