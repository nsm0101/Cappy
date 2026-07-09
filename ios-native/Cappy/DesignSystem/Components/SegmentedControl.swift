//
//  SegmentedControl.swift
//  Cappy
//
//  Design-system segmented control. Port of app/src/components/Segmented.tsx.
//

import SwiftUI

struct SegmentedOption<Value: Hashable>: Identifiable {
    let value: Value
    let label: String
    var id: Value { value }
}

struct SegmentedControl<Value: Hashable>: View {
    @Environment(\.theme) private var theme
    let options: [SegmentedOption<Value>]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options) { option in
                let active = option.value == selection
                Button {
                    selection = option.value
                } label: {
                    Text(option.label)
                        .font(CappyFont.sansSemibold(FontSizeToken.sm))
                        .foregroundStyle(active ? theme.tokens.brand : theme.tokens.fg2)
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .padding(.horizontal, Space.base)
                        .background(active ? theme.tokens.bgCard : .clear)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                        .cappyShadow(active ? theme.shadow1 : ShadowStyle(color: .clear, radius: 0, x: 0, y: 0))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(theme.tokens.bgInset)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(theme.tokens.border, lineWidth: 1))
    }
}
