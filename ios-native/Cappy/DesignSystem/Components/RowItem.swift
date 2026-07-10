//
//  RowItem.swift
//  Cappy
//
//  Tappable list row with optional left/right slots + chevron. Port of
//  app/src/components/RowItem.tsx.
//

import SwiftUI

struct RowItem<Left: View, Right: View>: View {
    @Environment(\.theme) private var theme
    let title: String
    var subtitle: String?
    var showChevron: Bool
    var action: (() -> Void)?
    let left: Left
    let right: Right

    init(title: String, subtitle: String? = nil, showChevron: Bool = true,
         action: (() -> Void)? = nil,
         @ViewBuilder left: () -> Left, @ViewBuilder right: () -> Right) {
        self.title = title
        self.subtitle = subtitle
        self.showChevron = showChevron
        self.action = action
        self.left = left()
        self.right = right()
    }

    var body: some View {
        let content = HStack(spacing: Space.md) {
            left
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(CappyFont.sansSemibold(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg1)
                    .lineLimit(1)
                if let subtitle {
                    Text(subtitle)
                        .font(CappyFont.sans(FontSizeToken.sm))
                        .foregroundStyle(theme.tokens.fg3)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            right
            if showChevron && action != nil {
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(theme.tokens.fgMuted)
            }
        }
        .padding(.horizontal, Space.base)
        .padding(.vertical, Space.md)
        .frame(minHeight: 64)
        .background(theme.tokens.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Radius.lg)
            .stroke(theme.colorScheme == .dark ? theme.tokens.border : Color.clear, lineWidth: 1))
        .cappyShadow(theme.shadow1)

        if let action {
            Button(action: action) { content }.buttonStyle(PressableButtonStyle())
        } else {
            content
        }
    }
}

extension RowItem where Left == EmptyView, Right == EmptyView {
    init(title: String, subtitle: String? = nil, showChevron: Bool = true, action: (() -> Void)? = nil) {
        self.init(title: title, subtitle: subtitle, showChevron: showChevron, action: action,
                  left: { EmptyView() }, right: { EmptyView() })
    }
}

extension RowItem where Right == EmptyView {
    init(title: String, subtitle: String? = nil, showChevron: Bool = true, action: (() -> Void)? = nil,
         @ViewBuilder left: () -> Left) {
        self.init(title: title, subtitle: subtitle, showChevron: showChevron, action: action,
                  left: left, right: { EmptyView() })
    }
}
