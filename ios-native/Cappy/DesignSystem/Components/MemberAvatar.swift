//
//  MemberAvatar.swift
//  Cappy
//
//  Renders a family member's uploaded photo (resolving the private storage
//  path to a signed URL) with an initials fallback. Port of
//  app/src/components/{Avatar,MemberAvatar}.tsx.
//

import SwiftUI

enum AvatarSize {
    case sm, md, lg
    var dimension: CGFloat {
        switch self { case .sm: return 32; case .md: return 44; case .lg: return 64 }
    }
    var font: CGFloat {
        switch self { case .sm: return 13; case .md: return 16; case .lg: return 22 }
    }
}

struct MemberAvatar: View {
    @Environment(\.theme) private var theme
    let avatarPath: String?
    let initials: String
    var tint: Color = Palette.blue500
    var size: AvatarSize = .md

    @State private var resolvedURL: URL?

    var body: some View {
        ZStack {
            Circle().fill(tint.opacity(0.16))
            if let url = resolvedURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initialsView
                    }
                }
            } else {
                initialsView
            }
        }
        .frame(width: size.dimension, height: size.dimension)
        .clipShape(Circle())
        .overlay(Circle().stroke(theme.tokens.border, lineWidth: 1))
        .task(id: avatarPath) {
            resolvedURL = await AvatarsRepository.signedURL(path: avatarPath)
        }
    }

    private var initialsView: some View {
        Text(initials)
            .font(CappyFont.sansBold(size.font))
            .foregroundStyle(tint)
    }
}
