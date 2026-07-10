//
//  Card.swift
//  Cappy
//
//  Surface container. Port of app/src/components/Card.tsx.
//

import SwiftUI

struct Card<Content: View>: View {
    @Environment(\.theme) private var theme
    var inset: Bool = false
    var padLarge: Bool = false
    var topAccent: Color? = nil
    let content: Content

    init(inset: Bool = false, padLarge: Bool = false, topAccent: Color? = nil,
         @ViewBuilder content: () -> Content) {
        self.inset = inset
        self.padLarge = padLarge
        self.topAccent = topAccent
        self.content = content()
    }

    var body: some View {
        // Elevated cards float on shadow alone in light mode; dark mode keeps
        // a hairline so surfaces don't melt into the background.
        let showBorder = !inset && theme.colorScheme == .dark
        VStack(alignment: .leading, spacing: 0) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padLarge ? Space.xl : Space.lg)
            .background(inset ? theme.tokens.bgInset : theme.tokens.bgCard)
            .overlay(alignment: .top) {
                if let topAccent {
                    Rectangle().fill(topAccent).frame(height: 3)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg)
                    .stroke(showBorder ? theme.tokens.border : Color.clear, lineWidth: showBorder ? 1 : 0))
            .cappyShadow(inset ? theme.shadowNone : theme.shadow2)
    }
}

/// Uppercase section label used across screens (e.g. "CURRENT STATUS").
struct SectionLabel: View {
    @Environment(\.theme) private var theme
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(CappyFont.sansSemibold(FontSizeToken.xs))
            .tracking(1)
            .foregroundStyle(theme.tokens.fg3)
    }
}
