//
//  Wordmark.swift
//  Cappy
//
//  The "Cappy!" lockup — capybara mark + playful rounded text.
//  Port of app/src/components/Wordmark.tsx.
//

import SwiftUI

struct Wordmark: View {
    @Environment(\.theme) private var theme
    var size: CGFloat = 32
    var color: Color? = nil

    var body: some View {
        HStack(spacing: 12) {
            Image("CappyMark")
                .resizable()
                .scaledToFill()
                .frame(width: size * 1.25, height: size * 1.25)
                .clipShape(Circle())
            Text("Cappy!")
                .font(CappyFont.brand(size))
                .foregroundStyle(color ?? theme.tokens.brand)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Cappy")
        .accessibilityAddTraits(.isHeader)
    }
}
