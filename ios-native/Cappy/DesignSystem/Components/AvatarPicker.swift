//
//  AvatarPicker.swift
//  Cappy
//
//  A MemberAvatar with a tap-to-change-photo affordance. Handles picking from
//  the photo library, downscaling + compressing to JPEG, and hands the bytes
//  to the caller — which performs the actual Supabase upload (see
//  AvatarsRepository.uploadMyAvatar / uploadChildAvatar) and refreshes state.
//

import SwiftUI
import PhotosUI
import UIKit

struct AvatarPicker: View {
    @Environment(\.theme) private var theme
    let avatarPath: String?
    let initials: String
    var tint: Color = Palette.blue500
    var size: AvatarSize = .lg
    /// Called with a compressed JPEG once the user picks a photo. The caller
    /// is responsible for the actual upload + refreshing `avatarPath`.
    let onPick: (Data) async -> Void

    @State private var selection: PhotosPickerItem?
    @State private var uploading = false

    private var badgeDimension: CGFloat { max(10, size.dimension * 0.32) }

    var body: some View {
        PhotosPicker(selection: $selection, matching: .images) {
            ZStack(alignment: .bottomTrailing) {
                MemberAvatar(avatarPath: avatarPath, initials: initials, tint: tint, size: size)
                    .opacity(uploading ? 0.5 : 1)
                if uploading {
                    ProgressView()
                        .frame(width: size.dimension, height: size.dimension)
                } else {
                    Image(systemName: "camera.fill")
                        .font(.system(size: badgeDimension * 0.55, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: badgeDimension, height: badgeDimension)
                        .background(theme.tokens.brand, in: Circle())
                        .overlay(Circle().stroke(theme.tokens.bg, lineWidth: 2))
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(uploading)
        .onChange(of: selection) { _, item in
            guard let item else { return }
            Task {
                uploading = true
                defer { uploading = false; selection = nil }
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let uiImage = UIImage(data: data),
                      let jpeg = uiImage.cappyAvatarJPEG()
                else { return }
                await onPick(jpeg)
            }
        }
    }
}

private extension UIImage {
    /// Downscale to a reasonable avatar resolution and re-encode as JPEG, so
    /// uploads stay small regardless of the source photo's dimensions.
    func cappyAvatarJPEG(maxDimension: CGFloat = 640, quality: CGFloat = 0.85) -> Data? {
        let scale = min(1, maxDimension / max(size.width, size.height))
        let targetSize = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let resized = renderer.image { _ in draw(in: CGRect(origin: .zero, size: targetSize)) }
        return resized.jpegData(compressionQuality: quality)
    }
}
