//
//  CappyTextField.swift
//  Cappy
//
//  Labeled text field with hint / error + focus ring. Port of
//  app/src/components/Field.tsx.
//

import SwiftUI

struct CappyTextField: View {
    @Environment(\.theme) private var theme
    @FocusState private var focused: Bool

    var label: String?
    let placeholder: String
    @Binding var text: String
    var hint: String? = nil
    var errorText: String? = nil
    var secure: Bool = false
    var keyboard: UIKeyboardType = .default
    var autocapitalization: TextInputAutocapitalization = .sentences
    var disableAutocorrection: Bool = false
    var contentType: UITextContentType? = nil

    private var hasError: Bool { errorText != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            if let label {
                Text(label)
                    .font(CappyFont.sansSemibold(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg2)
            }
            Group {
                if secure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .focused($focused)
            .font(CappyFont.sans(FontSizeToken.base))
            .foregroundStyle(theme.tokens.fg1)
            .keyboardType(keyboard)
            .textInputAutocapitalization(autocapitalization)
            .autocorrectionDisabled(disableAutocorrection)
            .textContentType(contentType)
            .frame(minHeight: Space.tapMin)
            .padding(.horizontal, Space.base)
            .background(theme.tokens.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(hasError ? theme.tokens.error : (focused ? theme.tokens.focus : theme.tokens.borderStrong),
                            lineWidth: (focused || hasError) ? 2 : 1))

            if let errorText {
                Text(errorText).font(CappyFont.sans(FontSizeToken.sm)).foregroundStyle(theme.tokens.error)
            } else if let hint {
                Text(hint).font(CappyFont.sans(FontSizeToken.sm)).foregroundStyle(theme.tokens.fg3)
            }
        }
    }
}
