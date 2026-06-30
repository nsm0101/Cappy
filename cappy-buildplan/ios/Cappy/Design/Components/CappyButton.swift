import SwiftUI

struct CappyButton: View {
    enum Style {
        case primary
        case secondary
        case destructive
    }

    let title: String
    let style: Style
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(CappyTypography.callout.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: CappyTouchTarget.minimum)
                .foregroundStyle(foregroundColor)
                .padding(.horizontal, CappySpacing.md)
                .background(backgroundColor)
                .clipShape(RoundedRectangle(cornerRadius: CappyRadius.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    private var backgroundColor: Color {
        switch style {
        case .primary: CappyColor.brandPrimary
        case .secondary: CappyColor.backgroundSecondary
        case .destructive: CappyColor.statusDangerBackground
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .primary: CappyColor.textInverse
        case .secondary: CappyColor.textPrimary
        case .destructive: CappyColor.statusDangerForeground
        }
    }
}
