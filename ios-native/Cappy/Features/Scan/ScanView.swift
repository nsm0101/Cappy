//
//  ScanView.swift
//  Cappy
//
//  Scan entry point with three ways in: NFC tap, QR camera scan, or an
//  admin-passcode-gated manual log — all three end up resolving a tag/slug
//  through the same nfc-resolve pipeline and opening the family member
//  selection / dose sheet. Port of app/src/screens/ScanScreen.tsx, extended
//  with QR + manual-gate paths.
//

import SwiftUI
#if canImport(VisionKit)
import VisionKit
#endif

struct ResolvedTagBox: Identifiable {
    let id = UUID()
    let tag: ResolvedTag
}

struct ScanView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme
    @Binding var incomingTagUID: String?

    private enum Phase: Equatable { case idle, scanning, resolving, error(String) }
    @State private var phase: Phase = .idle
    @State private var resolvedBox: ResolvedTagBox?
    @State private var manualUID = ""
    @State private var nfc = NfcService()

    @State private var showQRScanner = false
    @State private var manualUnlocked = false
    @State private var showPasscodePrompt = false
    @State private var passcodeInput = ""
    @State private var alert: CappyAlert?
    @State private var heroPulse = false

    private var isBusy: Bool {
        if case .scanning = phase { return true }
        if case .resolving = phase { return true }
        return false
    }
    private var isError: Bool { if case .error = phase { return true }; return false }

    var body: some View {
        ScrollView {
            VStack(spacing: Space.lg) {
                optionsSection
                if isBusy || isError { statusCard }
                if manualUnlocked { manualFallback }
            }
            .padding(Space.lg)
            .frame(maxWidth: .infinity)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationTitle("Scan")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $resolvedBox) { box in
            DoseSheetView(resolved: box.tag)
        }
        .fullScreenCover(isPresented: $showQRScanner) {
            QRScanSheet { uid in Task { await resolve(tagUID: uid) } }
        }
        .alert("Manual Dose Log", isPresented: $showPasscodePrompt) {
            SecureField("Passcode", text: $passcodeInput)
            Button("Cancel", role: .cancel) { passcodeInput = "" }
            Button("Continue") { verifyPasscode() }
        } message: {
            Text("Enter the admin-set passcode to log a dose without scanning.")
        }
        .cappyAlert($alert)
        .task(id: incomingTagUID) {
            if let uid = incomingTagUID {
                incomingTagUID = nil
                await resolve(tagUID: uid)
            }
        }
    }

    // MARK: Options

    private var optionsSection: some View {
        VStack(spacing: Space.md) {
            nfcHero
            RowItem(title: "Scan QR Code",
                    subtitle: "Use the camera to scan the sticker's code") {
                showQRScanner = true
            } left: {
                optionIcon("qrcode.viewfinder", tint: theme.tokens.accent2)
            }

            RowItem(title: "Manual Dose Log",
                    subtitle: "Admin passcode required") {
                presentPasscodePrompt()
            } left: {
                optionIcon("lock.shield", tint: theme.tokens.fg2)
            }
        }
    }

    /// The star of the screen: a big, friendly gradient target with softly
    /// pulsing NFC rings. Tapping anywhere starts the scan.
    private var nfcHero: some View {
        Button { if NfcService.isAvailable { Task { await scan() } } } label: {
            VStack(spacing: Space.base) {
                ZStack {
                    Circle().stroke(.white.opacity(0.25), lineWidth: 2)
                        .frame(width: 132, height: 132)
                        .scaleEffect(heroPulse ? 1.12 : 0.96)
                        .opacity(heroPulse ? 0.2 : 0.7)
                    Circle().stroke(.white.opacity(0.4), lineWidth: 2)
                        .frame(width: 104, height: 104)
                        .scaleEffect(heroPulse ? 1.08 : 0.98)
                        .opacity(heroPulse ? 0.4 : 0.9)
                    Circle().fill(.white.opacity(0.18))
                        .frame(width: 84, height: 84)
                    Image(systemName: "wave.3.right")
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .frame(height: 140)

                Text("Tap Cappy! Tag")
                    .font(CappyFont.brandBold(FontSizeToken.xl))
                    .foregroundStyle(.white)
                Text(NfcService.isAvailable
                        ? "Hold the top of your phone against the sticker on the bottle"
                        : "NFC isn't available on this device")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(.white.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Space.lg)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Space.xl)
            .background(theme.brandGradient)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sheet))
            .cappyShadow(theme.shadow2)
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!NfcService.isAvailable || isBusy)
        .opacity(NfcService.isAvailable ? 1 : 0.55)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) {
                heroPulse = true
            }
        }
        .accessibilityLabel("Tap Cappy tag to log a dose")
    }

    private func optionIcon(_ systemName: String, tint: Color) -> some View {
        ZStack {
            Circle().fill(tint.opacity(0.12)).frame(width: 40, height: 40)
            Image(systemName: systemName).foregroundStyle(tint)
        }
    }

    // MARK: Status

    private var statusCard: some View {
        Card {
            VStack(spacing: Space.sm) {
                if isBusy {
                    HStack(spacing: Space.sm) {
                        ProgressView()
                        Text(headline)
                            .font(CappyFont.sansSemibold(FontSizeToken.base))
                            .foregroundStyle(theme.tokens.fg1)
                    }
                } else if case .error(let message) = phase {
                    Text("Couldn't read tag")
                        .font(CappyFont.displaySemibold(FontSizeToken.lg))
                        .foregroundStyle(theme.tokens.error)
                    Text(message)
                        .font(CappyFont.sans(FontSizeToken.sm))
                        .foregroundStyle(theme.tokens.fg2)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var headline: String {
        switch phase {
        case .scanning: return "Hold steady…"
        case .resolving: return "Reading tag…"
        default: return ""
        }
    }

    // MARK: Manual fallback (revealed once the passcode gate is passed)

    private var manualFallback: some View {
        Card(inset: true) {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionLabel(text: "Log without scanning")
                Text("Tap a Cappy sticker code, or enter a tag ID.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg2)
                HStack(spacing: Space.sm) {
                    CappyButton(label: "Acetaminophen", variant: .secondary, block: true) {
                        Task { await resolve(tagUID: "ace-child") }
                    }
                    CappyButton(label: "Ibuprofen", variant: .secondary, block: true) {
                        Task { await resolve(tagUID: "ibu-child") }
                    }
                }
                HStack(spacing: Space.sm) {
                    CappyTextField(placeholder: "Tag ID (e.g. ace-child)", text: $manualUID,
                                   autocapitalization: .never, disableAutocorrection: true)
                    CappyButton(label: "Go") {
                        let uid = manualUID.trimmingCharacters(in: .whitespaces)
                        if !uid.isEmpty { Task { await resolve(tagUID: uid) } }
                    }
                }
            }
        }
    }

    // MARK: Manual passcode gate

    private func presentPasscodePrompt() {
        guard model.activeFamily != nil else {
            alert = CappyAlert(title: "No family yet",
                               message: "Create or join a family first to log doses manually.")
            return
        }
        passcodeInput = ""
        showPasscodePrompt = true
    }

    /// Verifies against the family's server-stored passcode hash (works on
    /// every caregiver's device), falling back to the legacy local Keychain
    /// copy when offline or before the admin re-saves the passcode.
    private func verifyPasscode() {
        let entered = passcodeInput
        passcodeInput = ""
        guard !entered.isEmpty, let familyId = model.activeFamily?.id else { return }

        func matchesLocal() -> Bool {
            KeychainStore.get(KeychainStore.manualDoseLogPasscodeKey) == entered
        }

        Task {
            do {
                guard let hash = try await FamilySettingsRepository.manualDosePasscodeHash(familyId: familyId) else {
                    if matchesLocal() {
                        manualUnlocked = true
                    } else {
                        alert = CappyAlert(title: "No passcode set",
                                           message: "Ask your family admin to set a manual dose log passcode in Settings first.")
                    }
                    return
                }
                if FamilySettingsRepository.passcodeHash(familyId: familyId, passcode: entered) == hash {
                    manualUnlocked = true
                } else {
                    alert = CappyAlert(title: "Incorrect passcode")
                }
            } catch {
                if matchesLocal() {
                    manualUnlocked = true
                } else {
                    alert = CappyAlert(title: "Couldn't verify passcode", message: error.localizedDescription)
                }
            }
        }
    }

    // MARK: Actions

    private func scan() async {
        phase = .scanning
        do {
            let uid = try await nfc.scanTagUID()
            Haptics.impact()
            await resolve(tagUID: uid)
        } catch let error as NfcError {
            if case .userCancelled = error { phase = .idle } else { phase = .error(error.localizedDescription) }
        } catch {
            phase = .error(error.localizedDescription)
        }
    }

    private func resolve(tagUID: String) async {
        phase = .resolving
        do {
            let resolved = try await NfcRepository.resolveTag(tagUid: tagUID, activeFamilyId: model.activeFamily?.id)
            guard let resolved else {
                let msg = (Tags.isWellKnownSlug(tagUID) && model.activeFamily == nil)
                    ? "Create or join a family first, then tap the sticker again to log a dose."
                    : "This tag isn't registered to a family you have access to. Ask the family admin to register it."
                phase = .error(msg)
                return
            }
            Haptics.success()
            resolvedBox = ResolvedTagBox(tag: resolved)
            manualUnlocked = false
            phase = .idle
        } catch {
            phase = .error(error.localizedDescription)
        }
    }
}

// MARK: - QR scanning

#if canImport(VisionKit)
/// Live camera QR scanner backed by VisionKit's on-device DataScannerViewController.
/// Reports each recognized barcode payload; the caller decides whether it's a
/// valid Cappy tag URL.
private struct QRScannerView: UIViewControllerRepresentable {
    var onPayload: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: false,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true)
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {
        guard !context.coordinator.didStart else { return }
        context.coordinator.didStart = true
        try? uiViewController.startScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onPayload: onPayload) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onPayload: (String) -> Void
        var didStart = false
        init(onPayload: @escaping (String) -> Void) { self.onPayload = onPayload }

        func dataScanner(_ dataScanner: DataScannerViewController,
                          didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            for item in addedItems {
                if case let .barcode(barcode) = item, let value = barcode.payloadStringValue {
                    onPayload(value)
                }
            }
        }
    }
}
#endif

/// Full-screen QR scan sheet: shows the live camera, validates each scanned
/// payload as a Cappy tag URL (same parser NFC uses), and reports the tag
/// UID back to the caller once one matches.
struct QRScanSheet: View {
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss
    var onResolved: (String) -> Void

    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            ZStack {
                scannerOrUnavailable
                if let errorText {
                    VStack {
                        Spacer()
                        Text(errorText)
                            .font(CappyFont.sansSemibold(FontSizeToken.sm))
                            .foregroundStyle(.white)
                            .padding(.horizontal, Space.md)
                            .padding(.vertical, Space.sm)
                            .background(.black.opacity(0.75))
                            .clipShape(Capsule())
                            .padding(.bottom, Space.xl)
                    }
                }
            }
            .navigationTitle("Scan QR Code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .task(id: errorText) {
            guard errorText != nil else { return }
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            errorText = nil
        }
    }

    @ViewBuilder private var scannerOrUnavailable: some View {
        #if canImport(VisionKit)
        if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
            QRScannerView { payload in
                switch Tags.parseTagUrl(payload) {
                case .success(let uid):
                    onResolved(uid)
                    dismiss()
                case .failure:
                    errorText = "That QR code isn't a Cappy tag."
                }
            }
            .ignoresSafeArea()
        } else {
            unavailable
        }
        #else
        unavailable
        #endif
    }

    private var unavailable: some View {
        VStack(spacing: Space.md) {
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 48))
                .foregroundStyle(theme.tokens.fgMuted)
            Text("QR scanning isn't available on this device.")
                .font(CappyFont.sans(FontSizeToken.base))
                .foregroundStyle(theme.tokens.fg2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Space.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.tokens.bg)
    }
}
