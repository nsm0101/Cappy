//
//  NfcService.swift
//  Cappy
//
//  CoreNFC wrapper. Reads the first NDEF URI record from a Cappy sticker and
//  parses the tag UID, and writes a URI to a blank tag (the "tap to add a
//  caregiver" flow). Mirrors app/src/nfc/nfcService.ts.
//
//  Both read and write go through `didDetect(tags:)` — when a delegate
//  implements the tag callback, CoreNFC never calls didDetectNDEFs, so we
//  connect to the tag and read/write it ourselves.
//
//  CoreNFC is device-only — `isAvailable` is false on the Simulator, where
//  the Scan screen offers a manual-entry fallback.
//

import Foundation
#if canImport(CoreNFC)
import CoreNFC
#endif

enum NfcError: LocalizedError {
    case unsupported
    case noTagData
    case invalidURL(String)
    case notWritable
    case userCancelled
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .unsupported: return "NFC is not available on this device."
        case .noTagData: return "Could not read the tag. Try again."
        case .invalidURL(let m): return m
        case .notWritable: return "This tag can't be written to."
        case .userCancelled: return "Scan cancelled."
        case .unknown(let m): return m
        }
    }
}

final class NfcService: NSObject {

    static var isAvailable: Bool {
        #if canImport(CoreNFC)
        return NFCNDEFReaderSession.readingAvailable
        #else
        return false
        #endif
    }

    #if canImport(CoreNFC)
    private enum Mode { case read, write(String) }
    private var mode: Mode = .read
    private var session: NFCNDEFReaderSession?
    private var readContinuation: CheckedContinuation<String, Error>?
    private var writeContinuation: CheckedContinuation<Void, Error>?
    private var didResume = false
    #endif

    // MARK: Read

    func scanTagUID(alert: String = "Hold the top of your phone against the Cappy sticker on the bottle.") async throws -> String {
        #if canImport(CoreNFC)
        guard NFCNDEFReaderSession.readingAvailable else { throw NfcError.unsupported }
        didResume = false
        mode = .read
        return try await withCheckedThrowingContinuation { cont in
            self.readContinuation = cont
            begin(alert: alert)
        }
        #else
        throw NfcError.unsupported
        #endif
    }

    // MARK: Write

    func writeURI(_ url: String, alert: String = "Hold your phone near the tag to write it.") async throws {
        #if canImport(CoreNFC)
        guard NFCNDEFReaderSession.readingAvailable else { throw NfcError.unsupported }
        didResume = false
        mode = .write(url)
        return try await withCheckedThrowingContinuation { cont in
            self.writeContinuation = cont
            begin(alert: alert)
        }
        #else
        throw NfcError.unsupported
        #endif
    }

    #if canImport(CoreNFC)
    private func begin(alert: String) {
        // invalidateAfterFirstRead must be false so `didDetect(tags:)` is used.
        let session = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: false)
        session.alertMessage = alert
        self.session = session
        session.begin()
    }

    private func resumeRead(_ result: Result<String, Error>) {
        guard !didResume else { return }
        didResume = true
        switch result {
        case .success(let uid): readContinuation?.resume(returning: uid)
        case .failure(let error): readContinuation?.resume(throwing: error)
        }
        readContinuation = nil
    }

    private func resumeWrite(_ result: Result<Void, Error>) {
        guard !didResume else { return }
        didResume = true
        switch result {
        case .success: writeContinuation?.resume(returning: ())
        case .failure(let error): writeContinuation?.resume(throwing: error)
        }
        writeContinuation = nil
    }
    #endif
}

#if canImport(CoreNFC)
extension NfcService: NFCNDEFReaderSessionDelegate {

    func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        // Fires when the session ends. If we already resumed on success this is
        // a no-op; otherwise it's a cancel/failure.
        let nfcError = error as? NFCReaderError
        let mapped: NfcError = (nfcError?.code == .readerSessionInvalidationErrorUserCanceled)
            ? .userCancelled : .unknown(error.localizedDescription)
        resumeRead(.failure(mapped))
        resumeWrite(.failure(mapped))
        self.session = nil
    }

    // Required stub — never invoked because we implement the tag callback.
    func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {}

    func readerSession(_ session: NFCNDEFReaderSession, didDetect tags: [NFCNDEFTag]) {
        guard let tag = tags.first else { return }
        session.connect(to: tag) { [weak self] connectError in
            guard let self else { return }
            if let connectError {
                session.invalidate(errorMessage: connectError.localizedDescription)
                return
            }
            switch self.mode {
            case .write(let url): self.write(url: url, to: tag, session: session)
            case .read: self.read(tag: tag, session: session)
            }
        }
    }

    private func read(tag: NFCNDEFTag, session: NFCNDEFReaderSession) {
        tag.readNDEF { [weak self] message, error in
            guard let self else { return }
            if let error {
                session.invalidate(errorMessage: error.localizedDescription)
                return
            }
            guard let record = message?.records.first, let url = Self.uriString(from: record) else {
                self.resumeRead(.failure(NfcError.noTagData))
                session.invalidate(errorMessage: "This isn't a Cappy tag.")
                return
            }
            switch Tags.parseTagUrl(url) {
            case .success(let uid):
                session.alertMessage = "Tag read."
                self.resumeRead(.success(uid))
                session.invalidate()
            case .failure(let err):
                self.resumeRead(.failure(NfcError.invalidURL(err.errorDescription ?? "Invalid tag.")))
                session.invalidate(errorMessage: "This isn't a Cappy tag.")
            }
        }
    }

    private func write(url: String, to tag: NFCNDEFTag, session: NFCNDEFReaderSession) {
        guard let payload = Self.uriPayload(from: url) else {
            resumeWrite(.failure(NfcError.unknown("Could not encode the link.")))
            session.invalidate(errorMessage: "Could not encode the link.")
            return
        }
        tag.queryNDEFStatus { [weak self] status, _, statusError in
            guard let self else { return }
            if let statusError {
                session.invalidate(errorMessage: statusError.localizedDescription)
                return
            }
            guard status == .readWrite else {
                self.resumeWrite(.failure(NfcError.notWritable))
                session.invalidate(errorMessage: "This tag can't be written to.")
                return
            }
            tag.writeNDEF(NFCNDEFMessage(records: [payload])) { writeError in
                if let writeError {
                    session.invalidate(errorMessage: writeError.localizedDescription)
                } else {
                    session.alertMessage = "Tag written."
                    self.resumeWrite(.success(()))
                    session.invalidate()
                }
            }
        }
    }

    private static func uriString(from record: NFCNDEFPayload) -> String? {
        if let url = record.wellKnownTypeURIPayload() { return url.absoluteString }
        if let s = String(data: record.payload, encoding: .utf8) { return s }
        return nil
    }

    private static func uriPayload(from urlString: String) -> NFCNDEFPayload? {
        guard let url = URL(string: urlString) else { return nil }
        return NFCNDEFPayload.wellKnownTypeURIPayload(url: url)
    }
}
#endif
