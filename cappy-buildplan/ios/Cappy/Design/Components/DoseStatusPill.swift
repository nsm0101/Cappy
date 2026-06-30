import SwiftUI

struct DoseStatusPill: View {
    enum Status {
        case safe
        case dueSoon
        case tooEarly
        case pendingSync
    }

    let status: Status

    var body: some View {
        Text(label)
            .font(CappyTypography.caption.weight(.semibold))
            .padding(.horizontal, CappySpacing.sm)
            .padding(.vertical, CappySpacing.xs)
            .foregroundStyle(foregroundColor)
            .background(backgroundColor)
            .clipShape(Capsule())
            .accessibilityLabel("Dose status: \(label)")
    }

    private var label: String {
        switch status {
        case .safe: "Ready to log"
        case .dueSoon: "Check timing"
        case .tooEarly: "Too soon"
        case .pendingSync: "Pending sync"
        }
    }

    private var foregroundColor: Color {
        switch status {
        case .safe: CappyColor.statusSafeForeground
        case .dueSoon: CappyColor.statusWarningForeground
        case .tooEarly: CappyColor.statusDangerForeground
        case .pendingSync: CappyColor.statusInfoForeground
        }
    }

    private var backgroundColor: Color {
        switch status {
        case .safe: CappyColor.statusSafeBackground
        case .dueSoon: CappyColor.statusWarningBackground
        case .tooEarly: CappyColor.statusDangerBackground
        case .pendingSync: CappyColor.statusInfoBackground
        }
    }
}
