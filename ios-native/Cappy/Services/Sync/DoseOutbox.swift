//
//  DoseOutbox.swift
//  Cappy
//
//  The local store of ¶[0053]: "A local store 190 holds the event when server
//  150 is unavailable. The event is transmitted when connectivity resumes and
//  is propagated to a second handheld computing device through the shared
//  record."
//
//  Before this, logging a dose was a PostgREST insert and nothing else. With
//  no signal it threw, the caregiver saw "Couldn't log", and the dose that was
//  actually given never entered the record — which is the exact failure
//  ¶[0052] warns about, since every interval rule in the app is computed from
//  what was recorded.
//
//  Three properties this has to hold:
//
//  * Idempotent. The row id is generated here, on the device, before the
//    first attempt. A retry, a duplicate flush, a crash between the insert and
//    the acknowledgement — all land on the same primary key, and the server
//    treats the unique violation as success.
//
//  * Durable across a kill. Written atomically to Application Support, not
//    kept in memory. A dose given at 2 AM must survive the app being swiped
//    away at 2:01.
//
//  * Visible to the interlocks *before* it syncs. A pending dose is a real
//    dose. `localEvents` is merged into the history the offline evaluator
//    reads, so a second dose thirty minutes later is refused on a phone that
//    has not spoken to the server since the first one.
//

import Foundation

/// One administration event, in the shape the server takes, plus the
/// provenance ¶[0053] enumerates: recipient, medication, amount, asserted
/// time, device, administering user, creation time, sync time.
struct PendingDoseEvent: Codable, Hashable, Identifiable {
    let id: String
    var familyId: String
    var childId: String?
    var caregiverUserId: String?
    var medicationId: String
    var givenAt: Date
    var amountMg: Double
    var amountVolumeMl: Double?
    var unitCount: Int?
    var note: String?

    // Identification provenance — ¶[0006] channel, ¶[0007] binding.
    var acquisitionChannel: AcquisitionChannel?
    var bindingStrength: BindingStrength?
    var identifierPresented: String?
    var tagAssociationId: String?
    var identifiedClass: String?

    // ¶[0052]: the caregiver's answer to "is anything missing from the log?"
    var unrecordedDosesAttested: Bool?

    // ¶[0055] time provenance.
    var givenAtUtcOffsetMinutes: Int
    var deviceId: String
    var observedClockSkewMs: Int?
    var timeUncertaintyMs: Int
    var createdAtDevice: Date

    // Local bookkeeping — never sent.
    var attempts: Int = 0
    var lastAttemptAt: Date?
    var lastError: String?

    /// The instant the interlocks use locally, matching the server's
    /// `effective_at`: the late end of the uncertainty band.
    var effectiveAt: Date {
        givenAt.addingTimeInterval(Double(timeUncertaintyMs) / 1000)
    }

    var isChildDose: Bool { childId != nil }

    /// The row body for PostgREST. Local-only fields are absent by
    /// construction rather than filtered, so a new one cannot leak by being
    /// forgotten.
    var wireRow: [String: Any?] {
        [
            "id": id,
            "family_id": familyId,
            "child_id": childId,
            "caregiver_user_id": caregiverUserId,
            "medication_id": medicationId,
            "given_at": givenAt.iso,
            "amount_mg": amountMg,
            "amount_volume_ml": amountVolumeMl,
            "unit_count": unitCount,
            "note": note,
            "acquisition_channel": acquisitionChannel?.rawValue,
            "binding_strength": bindingStrength?.rawValue,
            "identifier_presented": identifierPresented,
            "tag_association_id": tagAssociationId,
            "identified_class": identifiedClass,
            "unrecorded_doses_attested": unrecordedDosesAttested,
            "given_at_utc_offset_minutes": givenAtUtcOffsetMinutes,
            "device_id": deviceId,
            "observed_clock_skew_ms": observedClockSkewMs,
            "time_uncertainty_ms": timeUncertaintyMs,
            "created_at_device": createdAtDevice.iso
        ]
    }
}

@MainActor
final class DoseOutbox: ObservableObject {
    static let shared = DoseOutbox()

    /// Events written on this device that the server has not acknowledged.
    @Published private(set) var pending: [PendingDoseEvent] = []
    @Published private(set) var isFlushing = false
    /// Set when a flush failed for a reason that is not "no network" — a
    /// rejected row needs a person, not another retry.
    @Published private(set) var blocked: [PendingDoseEvent] = []

    private var fileURL: URL {
        let dir = (try? FileManager.default.url(for: .applicationSupportDirectory,
                                                in: .userDomainMask,
                                                appropriateFor: nil, create: true))
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        return dir.appendingPathComponent("cappy-dose-outbox.json")
    }

    private init() { pending = readFromDisk() }

    // MARK: Enqueue

    /// Record the dose locally first, then try to send it. The local write is
    /// the one that must not fail — a dose that was given is a fact whether or
    /// not there is signal.
    @discardableResult
    func enqueue(_ event: PendingDoseEvent) -> PendingDoseEvent {
        pending.append(event)
        persist()
        Task { await flush() }
        return event
    }

    // MARK: Flush

    func flush() async {
        guard !isFlushing, !pending.isEmpty else { return }
        guard SupabaseClient.shared.auth.currentSession != nil else { return }
        isFlushing = true
        defer { isFlushing = false }

        // Oldest first, so the server sees them in the order they happened and
        // reconciliation groups them the way a human would.
        for event in pending.sorted(by: { $0.createdAtDevice < $1.createdAtDevice }) {
            do {
                try await DosesRepository.insertPending(event)
                remove(event.id)
            } catch let error as SupabaseError {
                if error.code == "23505" {
                    // Already there. The client-generated primary key is the
                    // idempotency mechanism, and this is it working.
                    remove(event.id)
                } else if (400..<500).contains(error.status), error.status != 401, error.status != 408, error.status != 429 {
                    // A 4xx is the server saying this row is wrong, and it
                    // will be just as wrong in ten minutes. Stop retrying and
                    // surface it.
                    markBlocked(event.id, reason: error.message)
                } else {
                    markAttempt(event.id, reason: error.message)
                    break       // transient: stop here, keep order
                }
            } catch {
                markAttempt(event.id, reason: error.localizedDescription)
                break
            }
        }
        persist()
    }

    // MARK: Local history

    /// Pending events for a recipient and medication, so the interlocks see
    /// doses that have not reached the server. Without this, a phone offline
    /// for an hour would happily present a second dose.
    func localEvents(childId: String?, caregiverUserId: String?, medicationId: String) -> [PendingDoseEvent] {
        pending.filter {
            $0.medicationId == medicationId
            && $0.childId == childId
            && $0.caregiverUserId == caregiverUserId
        }
    }

    /// Pending events for a recipient across every medication — needed for the
    /// cross-medication interval, which reaches outside one medication id.
    func localEvents(childId: String?, caregiverUserId: String?) -> [PendingDoseEvent] {
        pending.filter { $0.childId == childId && $0.caregiverUserId == caregiverUserId }
    }

    var hasPending: Bool { !pending.isEmpty }

    // MARK: Internals

    private func remove(_ id: String) {
        pending.removeAll { $0.id == id }
        blocked.removeAll { $0.id == id }
    }

    private func markAttempt(_ id: String, reason: String) {
        guard let i = pending.firstIndex(where: { $0.id == id }) else { return }
        pending[i].attempts += 1
        pending[i].lastAttemptAt = Date()
        pending[i].lastError = reason
    }

    private func markBlocked(_ id: String, reason: String) {
        guard let i = pending.firstIndex(where: { $0.id == id }) else { return }
        pending[i].lastError = reason
        let event = pending[i]
        if !blocked.contains(where: { $0.id == id }) { blocked.append(event) }
        pending.remove(at: i)
    }

    private func persist() {
        guard let data = try? JSONEncoder.cappy.encode(pending) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }

    private func readFromDisk() -> [PendingDoseEvent] {
        guard let data = try? Data(contentsOf: fileURL),
              let rows = try? JSONDecoder.cappy.decode([PendingDoseEvent].self, from: data)
        else { return [] }
        return rows
    }
}
