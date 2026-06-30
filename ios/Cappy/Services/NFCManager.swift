import Foundation
import CoreNFC
import Combine

class NFCManager: NSObject, ObservableObject {
    @Published var scannedTagUID: String? = nil
    @Published var isScanning = false
    @Published var errorMsg: String? = nil
    
    private var session: NFCNDEFReaderSession?
    
    func startScanning() {
        #if targetEnvironment(simulator)
        // Simulator Mock Scan
        isScanning = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.isScanning = false
            // Simulate a tag UID (standard NTAG215 UID is 7 bytes hex, 14 chars)
            let mockUIDs = ["047A1B2C3D4E5F", "04A1B2C3D4E5F6", "0487F6E5D4C3B2"]
            self.scannedTagUID = mockUIDs.randomElement()
        }
        #else
        // Physical Device Core NFC
        guard NFCNDEFReaderSession.readingAvailable else {
            self.errorMsg = "NFC scanning is not supported on this device."
            return
        }
        
        isScanning = true
        self.errorMsg = nil
        self.scannedTagUID = nil
        
        session = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: true)
        session?.alertMessage = "Hold the top of your iPhone near the Cappy NFC sticker."
        session?.begin()
        #endif
    }
    
    /// Parse and extract tag UID from Universal Link URL
    /// Format: https://tap.cappy.app/t/{TAG_UID}
    func handleUniversalLink(_ url: URL) -> Bool {
        guard url.host == "tap.cappy.app" else { return false }
        let pathComponents = url.pathComponents
        guard pathComponents.count >= 3, pathComponents[1] == "t" else { return false }
        
        let uid = pathComponents[2]
        self.scannedTagUID = uid
        return true
    }
    
    func clearTag() {
        self.scannedTagUID = nil
    }
}

// MARK: - Core NFC Delegate
extension NFCManager: NFCNDEFReaderSessionDelegate {
    func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        DispatchQueue.main.async {
            self.isScanning = false
            if let nfcError = error as? NFCReaderError, nfcError.code != .readerSessionInvalidationErrorUserCanceled {
                self.errorMsg = error.localizedDescription
            }
        }
    }
    
    func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        guard let firstMessage = messages.first, let firstRecord = firstMessage.records.first else {
            session.invalidate(errorMessage: "No valid payload found on tag.")
            return
        }
        
        // Parse NDEF URI payload
        firstRecord.wellKnownTypeURIPayload { [weak self] url in
            guard let self = self else { return }
            
            DispatchQueue.main.async {
                if let url = url {
                    if self.handleUniversalLink(url) {
                        session.alertMessage = "Medication detected successfully!"
                    } else {
                        session.invalidate(errorMessage: "Unrecognized Cappy URL scheme.")
                    }
                } else {
                    session.invalidate(errorMessage: "Could not parse NDEF payload as URI.")
                }
                self.isScanning = false
            }
        }
    }
}
