//
//  LocalDoseHistory.swift
//  Cappy
//
//  The last administration history the server handed over, kept so the
//  interlocks still have something to work on when it cannot be reached.
//
//  This is the device-side half of ¶[0053]'s shared record. It is a cache, and
//  it is treated as one: it is refreshed on every successful read, entries
//  older than the longest rolling window are dropped, and the evaluator marks
//  any answer derived from it as computed offline.
//
//  What it deliberately does NOT do is let silence look like safety. An empty
//  cache means "this device has not been told about any doses", which is not
//  the same as "no doses were given" — ¶[0052] is explicit that the two must
//  not be conflated. The evaluator therefore never reads an empty history as
//  clearance on its own; the online path is always preferred, and an offline
//  release says so on screen.
//

import Foundation

final class LocalDoseHistory {
    static let shared = LocalDoseHistory()

    private struct Snapshot: Codable {
        var records: [String: [LocalDoseRecord]] = [:]   // recipient key -> doses
        var generics: [String: String] = [:]             // medication id -> generic name
        var updatedAt: Date = .distantPast
    }

    private let queue = DispatchQueue(label: "cappy.dosehistory", attributes: .concurrent)
    private var snapshot = Snapshot()

    /// Long enough to cover the widest rolling window plus a cross-medication
    /// interval, and no longer. Old doses cannot affect any current decision
    /// and keeping them only widens what a lost phone gives away.
    private let retention: TimeInterval = 48 * 3600

    private var fileURL: URL {
        let dir = (try? FileManager.default.url(for: .applicationSupportDirectory,
                                                in: .userDomainMask,
                                                appropriateFor: nil, create: true))
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        return dir.appendingPathComponent("cappy-dose-history.json")
    }

    private init() {
        if let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder.cappy.decode(Snapshot.self, from: data) {
            snapshot = decoded
        }
    }

    static func key(childId: String?, caregiverUserId: String?) -> String {
        if let childId { return "child:\(childId)" }
        if let caregiverUserId { return "caregiver:\(caregiverUserId)" }
        return "none"
    }

    func records(childId: String?, caregiverUserId: String?) -> [LocalDoseRecord] {
        let k = Self.key(childId: childId, caregiverUserId: caregiverUserId)
        let cutoff = Date().addingTimeInterval(-retention)
        return queue.sync { snapshot.records[k]?.filter { $0.effectiveAt > cutoff } ?? [] }
    }

    func generic(forMedicationId id: String) -> String? {
        queue.sync { snapshot.generics[id] }
    }

    /// Replace what is known about one recipient. A replace rather than a
    /// merge, so a dose deleted or superseded server-side disappears here too.
    func replace(childId: String?, caregiverUserId: String?, with records: [LocalDoseRecord]) {
        let k = Self.key(childId: childId, caregiverUserId: caregiverUserId)
        let cutoff = Date().addingTimeInterval(-retention)
        queue.async(flags: .barrier) {
            self.snapshot.records[k] = records.filter { $0.effectiveAt > cutoff }
            self.snapshot.updatedAt = Date()
            self.persistLocked()
        }
    }

    func noteMedications(_ medications: [Medication]) {
        queue.async(flags: .barrier) {
            for m in medications { self.snapshot.generics[m.id] = m.genericName.lowercased() }
            self.persistLocked()
        }
    }

    /// Fold a dose logged on this device straight in, so the interlocks see it
    /// on the very next evaluation rather than after the next server read.
    func note(_ event: PendingDoseEvent) {
        let k = Self.key(childId: event.childId, caregiverUserId: event.caregiverUserId)
        queue.async(flags: .barrier) {
            let generic = self.snapshot.generics[event.medicationId] ?? ""
            var list = self.snapshot.records[k] ?? []
            list.append(LocalDoseRecord(medicationId: event.medicationId,
                                        genericName: generic,
                                        effectiveAt: event.effectiveAt,
                                        amountMg: event.amountMg))
            self.snapshot.records[k] = list
            self.persistLocked()
        }
    }

    func clear() {
        queue.async(flags: .barrier) {
            self.snapshot = Snapshot()
            try? FileManager.default.removeItem(at: self.fileURL)
        }
    }

    private func persistLocked() {
        guard let data = try? JSONEncoder.cappy.encode(snapshot) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}
