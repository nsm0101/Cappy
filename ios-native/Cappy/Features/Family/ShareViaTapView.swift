//
//  ShareViaTapView.swift
//  Cappy
//
//  Hand off a family invite phone-to-phone: an on-screen QR code, an NFC
//  "write to a blank tag" option, and a share link. iOS Core NFC can't
//  emulate a tag, so the peer either scans the QR / opens the link, or the
//  admin writes a physical sticker. Port of app/src/screens/ShareViaTapScreen.tsx.
//

import SwiftUI
import CoreImage.CIFilterBuiltins

struct ShareViaTapView: View {
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss

    let code: String
    let familyName: String?

    @State private var writing = false
    @State private var writeMessage: String?
    @State private var alert: CappyAlert?
    @State private var nfc = NfcService()

    private var link: String { FamiliesRepository.inviteLink(code: code) }

    var body: some View {
        ScrollView {
            VStack(spacing: Space.lg) {
                VStack(spacing: Space.sm) {
                    Text("Add a caregiver")
                        .font(CappyFont.display(FontSizeToken.xxl))
                        .foregroundStyle(theme.tokens.fg1)
                    Text(familyName.map { "Invite someone to \($0)." } ?? "Invite someone to your family.")
                        .font(CappyFont.sans(FontSizeToken.sm))
                        .foregroundStyle(theme.tokens.fg2)
                }

                if let qr = qrImage(from: link) {
                    Image(uiImage: qr)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 220, height: 220)
                        .padding(Space.base)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.base))
                        .overlay(RoundedRectangle(cornerRadius: Radius.base).stroke(theme.tokens.border, lineWidth: 1))
                }

                Text(code)
                    .font(CappyFont.mono(FontSizeToken.display))
                    .tracking(6)
                    .foregroundStyle(theme.tokens.fg1)

                Text("They can scan this code, open the link, or tap a Cappy sticker you write below.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg3)
                    .multilineTextAlignment(.center)

                VStack(spacing: Space.sm) {
                    if NfcService.isAvailable {
                        CappyButton(label: writing ? (writeMessage ?? "Hold near a tag…") : "Write to an NFC tag",
                                    variant: .blue, size: .lg, block: true, loading: writing) {
                            Task { await writeTag() }
                        }
                        .disabled(writing)
                    }
                    ShareLink(item: link) {
                        Text("Share link")
                            .font(CappyFont.sansSemibold(FontSizeToken.base))
                            .foregroundStyle(theme.tokens.fg1)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(theme.tokens.bgCard)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.base))
                            .overlay(RoundedRectangle(cornerRadius: Radius.base).stroke(theme.tokens.borderStrong, lineWidth: 1))
                    }
                }
            }
            .padding(Space.lg)
            .frame(maxWidth: .infinity)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationTitle("Share")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
        .cappyAlert($alert)
    }

    private func writeTag() async {
        writing = true
        writeMessage = "Hold near a tag…"
        defer { writing = false; writeMessage = nil }
        do {
            try await nfc.writeURI(link)
            Haptics.success()
            alert = CappyAlert(title: "Tag written", message: "Anyone can tap it to join this family.")
        } catch let error as NfcError {
            if case .userCancelled = error { return }
            alert = CappyAlert(title: "Couldn't write tag", message: error.localizedDescription)
        } catch {
            alert = CappyAlert(title: "Couldn't write tag", message: error.localizedDescription)
        }
    }

    private func qrImage(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)),
              let cg = context.createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
