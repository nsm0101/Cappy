//
//  ClockSync.swift
//  Cappy
//
//  Knowing how wrong this phone's clock is.
//
//  Patent ¶[0055], which is unusually direct about why this is not a detail:
//
//      "The administration-event times upon which the interlocks and the
//       reconciliation operate originate at devices whose clocks are set
//       independently, which may be in different time zones, and which may
//       have drifted. This is a technical characteristic of the arrangement
//       rather than an incidental one, because the quantities compared are
//       intervals between events recorded on different machines."
//
//  Everything the app does with time is a subtraction between two events that
//  two different phones wrote down. If Dad's phone is four minutes fast, the
//  gap between his dose and Mom's is wrong by four minutes in whichever
//  direction is least convenient. Wall-clock time is not a shared fact.
//
//  So each event carries three things: the UTC offset in force where it was
//  recorded, the observed skew against the server when that could be measured,
//  and a residual uncertainty when it could not. ¶[0055] then fixes the
//  direction of the remaining doubt:
//
//      "an event whose time is uncertain within a bound is treated, for the
//       purpose of determining the next permissible administration, as having
//       occurred at the later end of that bound."
//
//  Later, always. Treating a dose as later than it was delays the next one.
//  Treating it as earlier can release a dose before the interval has run.
//
//  The skew is observed passively from the `Date` header of responses the app
//  was making anyway, so this costs no extra request.
//

import Foundation

enum ClockSync {

    private static let skewKey = "cappy.clock.skewMs"
    private static let observedKey = "cappy.clock.observedAt"

    /// Round-trip time above which a `Date` header is too coarse to be worth
    /// believing. The header has one-second resolution to begin with, so a
    /// slow response tells us little.
    private static let maxUsefulRoundTripMs: Double = 2000

    /// How long an observation stays good. A phone whose skew was measured
    /// this morning is not evidence about its skew tonight — a time-zone
    /// change or a manual clock adjustment can happen in between.
    private static let observationLifetime: TimeInterval = 6 * 3600

    /// Uncertainty assumed when the skew has never been observed. A phone
    /// with an unmeasured clock is not assumed correct; it is assumed to be
    /// off by up to this much, and the event is stamped accordingly.
    static let unobservedUncertaintyMs = 120_000    // 2 minutes

    /// Floor on uncertainty even with a fresh observation — the header's own
    /// one-second granularity, plus a little for the round trip.
    static let observedFloorUncertaintyMs = 1_500

    private static let httpDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "GMT")
        f.dateFormat = "EEE, dd MMM yyyy HH:mm:ss 'GMT'"
        return f
    }()

    /// Device clock minus server clock, in milliseconds. Positive = this phone
    /// is running fast. Nil when never observed, or when the observation has
    /// aged out.
    static var skewMs: Int? {
        guard let observed = UserDefaults.standard.object(forKey: observedKey) as? Date,
              Date().timeIntervalSince(observed) < observationLifetime,
              UserDefaults.standard.object(forKey: skewKey) != nil
        else { return nil }
        return UserDefaults.standard.integer(forKey: skewKey)
    }

    /// Uncertainty to stamp on an event recorded right now.
    static var uncertaintyMs: Int {
        skewMs == nil ? unobservedUncertaintyMs : observedFloorUncertaintyMs
    }

    /// Observe the server clock from a response the app made for another
    /// reason. `sentAt` is when the request left, so the round trip can be
    /// halved out of the comparison.
    static func observe(response: HTTPURLResponse, sentAt: Date, receivedAt: Date = Date()) {
        guard let header = response.value(forHTTPHeaderField: "Date"),
              let serverTime = httpDateFormatter.date(from: header)
        else { return }

        let roundTripMs = receivedAt.timeIntervalSince(sentAt) * 1000
        guard roundTripMs >= 0, roundTripMs <= maxUsefulRoundTripMs else { return }

        // The server stamped the header somewhere inside the round trip; the
        // midpoint is the least-wrong assumption available.
        let deviceAtServerStamp = sentAt.addingTimeInterval(receivedAt.timeIntervalSince(sentAt) / 2)
        let skew = deviceAtServerStamp.timeIntervalSince(serverTime) * 1000

        UserDefaults.standard.set(Int(skew.rounded()), forKey: skewKey)
        UserDefaults.standard.set(Date(), forKey: observedKey)
    }

    /// The stable identity of this installation, used to tell one caregiver's
    /// two phones apart during reconciliation. Not a hardware identifier: it
    /// is generated here and dies with the app's storage.
    static var deviceId: String {
        let key = "cappy.device.id"
        if let existing = UserDefaults.standard.string(forKey: key) { return existing }
        let fresh = UUID().uuidString
        UserDefaults.standard.set(fresh, forKey: key)
        return fresh
    }

    /// The time provenance to attach to an event being recorded now.
    struct Stamp: Codable, Hashable {
        /// The instant the caregiver asserts the dose was given.
        let givenAt: Date
        /// Minutes east of UTC in force on this device at recording time.
        /// ¶[0055]: "a subsequent change of time zone at a device, or an
        /// adjustment of its clock, does not alter the recorded instants of
        /// events already stored."
        let utcOffsetMinutes: Int
        let deviceId: String
        let observedClockSkewMs: Int?
        let timeUncertaintyMs: Int
        let createdAtDevice: Date

        /// The instant the interlocks will use: the late end of the bound.
        var effectiveAt: Date {
            givenAt.addingTimeInterval(Double(timeUncertaintyMs) / 1000)
        }
    }

    static func stamp(givenAt: Date, now: Date = Date()) -> Stamp {
        Stamp(givenAt: givenAt,
              utcOffsetMinutes: TimeZone.current.secondsFromGMT(for: givenAt) / 60,
              deviceId: deviceId,
              observedClockSkewMs: skewMs,
              timeUncertaintyMs: uncertaintyMs,
              createdAtDevice: now)
    }
}
