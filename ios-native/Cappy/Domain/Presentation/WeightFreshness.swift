//
//  WeightFreshness.swift
//  Cappy
//
//  When a stored body mass stops being usable, and why the answer is not a
//  single number of days.
//
//  Patent ¶[0010] and ¶[0049]: a body-mass value is admitted only where its
//  age does not exceed a configured threshold, and where it does, the
//  numerical dose volume is *suppressed*.
//
//  The threshold is derived rather than picked. Dose mass is linear in body
//  mass — mg = coefficient × kg — so a fractional error in the stored weight
//  is exactly the same fractional error in the dose. A weight is therefore
//  stale at the moment the child's expected growth since it was recorded
//  would move the computed dose by more than one tolerance figure, and that
//  single figure (10%) sets every interval in the app.
//
//  The consequence is a schedule with the right shape rather than a
//  compromise. A newborn is re-weighed about every two weeks, because two
//  weeks of newborn growth really is a 10% dose change. A six-year-old is
//  asked roughly twice a year, because a school-age child would need most of a
//  year to drift that far. The 90-day constant this replaces was
//  simultaneously far too lax for infants — a 90-day-old weight on a
//  three-month-old understates the dose by nearly a third — and needlessly
//  obtrusive for everybody over two.
//
//  This is a mirror of the server functions in
//  20260903100000_weight_staleness_policy.sql, kept so the gate still holds
//  when the app is offline. The server is authoritative; these tables are
//  refreshed from it by `DosingRuleCache` and fall back to the values below,
//  which are the same ones the migration seeds.
//

import Foundation

/// Expected mass gain as a fraction of current mass, per month, for an age
/// band. Taken at the fast end of normal: erring fast means prompting sooner,
/// and the cost of a premature prompt is annoyance while the cost of a late
/// one is a dose computed from a weight the child has outgrown.
struct GrowthBand: Codable, Hashable {
    let minAgeMonths: Double
    let maxAgeMonths: Double
    let fractionalGainPerMonth: Double
    let label: String
}

enum WeightFreshness {

    /// Mirrors `weight_growth_velocity`. See the migration for the derivation
    /// of each rate.
    static let defaultBands: [GrowthBand] = [
        GrowthBand(minAgeMonths: 0,   maxAgeMonths: 3,    fractionalGainPerMonth: 0.250, label: "Newborn"),
        GrowthBand(minAgeMonths: 3,   maxAgeMonths: 6,    fractionalGainPerMonth: 0.100, label: "Young infant"),
        GrowthBand(minAgeMonths: 6,   maxAgeMonths: 12,   fractionalGainPerMonth: 0.045, label: "Older infant"),
        GrowthBand(minAgeMonths: 12,  maxAgeMonths: 24,   fractionalGainPerMonth: 0.020, label: "Toddler"),
        GrowthBand(minAgeMonths: 24,  maxAgeMonths: 60,   fractionalGainPerMonth: 0.013, label: "Preschool"),
        GrowthBand(minAgeMonths: 60,  maxAgeMonths: 120,  fractionalGainPerMonth: 0.012, label: "School age"),
        GrowthBand(minAgeMonths: 120, maxAgeMonths: 168,  fractionalGainPerMonth: 0.020, label: "Pubertal spurt"),
        GrowthBand(minAgeMonths: 168, maxAgeMonths: 216,  fractionalGainPerMonth: 0.013, label: "Late adolescent"),
        GrowthBand(minAgeMonths: 216, maxAgeMonths: 1200, fractionalGainPerMonth: 0.002, label: "Adult")
    ]

    /// Fractional dose error tolerated before a new weight is required.
    static let defaultTolerance = 0.10
    static let minThresholdDays = 7.0
    static let maxThresholdDays = 365.0

    /// Mean Gregorian month, so a threshold in months converts to days the
    /// same way on both sides of the wire.
    static let daysPerMonth = 30.436875

    // MARK: Policy source

    /// Server-supplied bands and tolerance, when they have been fetched.
    /// Falling back to the compiled defaults is safe: they are the values the
    /// migration seeds, so an offline client and a fresh server agree.
    static var bands: [GrowthBand] { DosingRuleCache.shared.growthBands ?? defaultBands }
    static var tolerance: Double { DosingRuleCache.shared.doseDriftTolerance ?? defaultTolerance }

    // MARK: The maths

    private static func band(at ageMonths: Double, in bands: [GrowthBand]) -> GrowthBand? {
        bands.first { ageMonths >= $0.minAgeMonths && ageMonths < $0.maxAgeMonths }
    }

    /// Cumulative expected fractional mass gain over an interval, integrated
    /// across every band the child passed through.
    ///
    /// Integrating is not fussiness. A weight taken at two months and read at
    /// eight spans the steepest part of the curve; evaluating a single rate at
    /// either endpoint is wrong by a factor of five in one direction or the
    /// other. Growth compounds, so the bands multiply rather than add.
    static func expectedDrift(ageMonthsAtRecord: Double, elapsedMonths: Double,
                              bands: [GrowthBand] = WeightFreshness.bands) -> Double {
        guard elapsedMonths > 0, !bands.isEmpty else { return 0 }
        var age = max(ageMonthsAtRecord, 0)
        var remaining = elapsedMonths
        var factor = 1.0

        while remaining > 0 {
            let current = band(at: age, in: bands) ?? bands[bands.count - 1]
            let span = band(at: age, in: bands) == nil
                ? remaining
                : min(remaining, current.maxAgeMonths - age)
            guard span > 0 else { break }
            factor *= pow(1 + current.fractionalGainPerMonth, span)
            remaining -= span
            age += span
        }
        return factor - 1
    }

    /// Months from the recording until expected drift reaches the tolerance.
    static func stalenessMonths(ageMonthsAtRecord: Double,
                                tolerance: Double = WeightFreshness.tolerance,
                                bands: [GrowthBand] = WeightFreshness.bands) -> Double {
        guard !bands.isEmpty else { return maxThresholdDays / daysPerMonth }
        var age = max(ageMonthsAtRecord, 0)
        var factor = 1.0
        var months = 0.0

        while months < 1200 {
            let isLast = band(at: age, in: bands) == nil
            let current = band(at: age, in: bands) ?? bands[bands.count - 1]
            let rate = current.fractionalGainPerMonth
            guard rate > 0 else { return 1200 }

            let needed = log((1 + tolerance) / factor) / log(1 + rate)
            let span = isLast ? Double.infinity : current.maxAgeMonths - age
            if needed <= span { return months + max(needed, 0) }

            factor *= pow(1 + rate, span)
            months += span
            age += span
        }
        return 1200
    }

    /// The refresh interval for a weight taken at this age, clamped by the
    /// floor and ceiling in policy.
    static func thresholdDays(ageMonthsAtRecord: Double) -> Double {
        let months = stalenessMonths(ageMonthsAtRecord: ageMonthsAtRecord)
        return min(max(months * daysPerMonth, minThresholdDays), maxThresholdDays)
    }

    // MARK: The gate

    struct Verdict: Hashable {
        let grams: Int?
        let recordedAt: Date?
        let ageMonthsAtRecord: Double?
        let expectedDrift: Double?
        let thresholdDays: Double?
        let staleAt: Date?
        let isStale: Bool

        var kilograms: Double? { grams.map { Double($0) / 1000 } }

        /// Absence is not freshness. A child with no weight on file is gated
        /// exactly as one whose weight expired — ¶[0049] draws no distinction
        /// between them, and neither does the dose.
        var isMissing: Bool { grams == nil }
    }

    static func evaluate(grams: Int?, recordedAt: Date?, dateOfBirth: Date?,
                         now: Date = Date()) -> Verdict {
        guard let grams, let recordedAt, let dateOfBirth else {
            return Verdict(grams: nil, recordedAt: recordedAt, ageMonthsAtRecord: nil,
                           expectedDrift: nil, thresholdDays: nil, staleAt: nil, isStale: true)
        }
        let secondsPerMonth = daysPerMonth * 86400
        let ageAtRecord = max(recordedAt.timeIntervalSince(dateOfBirth) / secondsPerMonth, 0)
        let elapsed = max(now.timeIntervalSince(recordedAt) / secondsPerMonth, 0)
        let days = thresholdDays(ageMonthsAtRecord: ageAtRecord)
        let staleAt = recordedAt.addingTimeInterval(days * 86400)

        return Verdict(
            grams: grams,
            recordedAt: recordedAt,
            ageMonthsAtRecord: ageAtRecord,
            expectedDrift: expectedDrift(ageMonthsAtRecord: ageAtRecord, elapsedMonths: elapsed),
            thresholdDays: days,
            staleAt: staleAt,
            isStale: now >= staleAt)
    }

    /// Caregiver-facing explanation. It states the consequence rather than the
    /// rule, because "the dose could be off by about 12%" is actionable and
    /// "your weight record has exceeded its configured staleness threshold" is
    /// not.
    static func explanation(for verdict: Verdict, childName: String) -> String {
        guard let drift = verdict.expectedDrift, verdict.grams != nil else {
            return "Cappy needs \(childName)'s weight before it can work out a dose."
        }
        let percent = Int((drift * 100).rounded())
        if percent <= 0 {
            return "\(childName)'s weight is due for an update."
        }
        return "\(childName) has likely grown about \(percent)% since that weight was taken, so a dose based on it could be off by about the same amount. Add today's weight to continue."
    }
}
