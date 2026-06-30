import SwiftUI
import UIKit

enum CappyColor {
    static let backgroundPrimary = Color(light: 0xFFFFFF, dark: 0x0B0F14)
    static let backgroundSecondary = Color(light: 0xF5F7FA, dark: 0x161B22)
    static let backgroundElevated = Color(light: 0xFFFFFF, dark: 0x1C232C)

    static let textPrimary = Color(light: 0x0B0F14, dark: 0xF5F7FA)
    static let textSecondary = Color(light: 0x4A5560, dark: 0xA8B0BB)
    static let textTertiary = Color(light: 0x7B8694, dark: 0x7B8694)
    static let textInverse = Color(light: 0xFFFFFF, dark: 0x0B0F14)

    static let brandPrimary = Color(hex: 0x1F6FEB)
    static let brandSecondary = Color(hex: 0x6E40C9)

    static let statusSafeForeground = Color(hex: 0x0B5E2A)
    static let statusSafeBackground = Color(hex: 0xE6F4EA)
    static let statusWarningForeground = Color(hex: 0x7A4F00)
    static let statusWarningBackground = Color(hex: 0xFFF4D6)
    static let statusDangerForeground = Color(hex: 0x9B1C1C)
    static let statusDangerBackground = Color(hex: 0xFDE7E7)
    static let statusInfoForeground = Color(hex: 0x1F4F9B)
    static let statusInfoBackground = Color(hex: 0xE6EEF9)

    static let divider = Color(light: 0xE1E4E8, dark: 0x2D333B)
}

enum CappySpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

enum CappyRadius {
    static let sm: CGFloat = 6
    static let md: CGFloat = 12
    static let lg: CGFloat = 20
    static let full: CGFloat = 9999
}

enum CappyTypography {
    static let display = Font.system(size: 28, weight: .semibold)
    static let title = Font.system(size: 22, weight: .semibold)
    static let subtitle = Font.system(size: 17, weight: .medium)
    static let body = Font.system(size: 17, weight: .regular)
    static let callout = Font.system(size: 16, weight: .regular)
    static let caption = Font.system(size: 13, weight: .regular)
}

enum CappyMotion {
    static let fast = 0.150
    static let medium = 0.250
    static let slow = 0.400
}

enum CappyTouchTarget {
    static let minimum: CGFloat = 44
}

private extension Color {
    init(hex: UInt) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0
        )
    }

    init(light: UInt, dark: UInt) {
        self.init(UIColor { traitCollection in
            let value = traitCollection.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((value >> 16) & 0xFF) / 255.0,
                green: CGFloat((value >> 8) & 0xFF) / 255.0,
                blue: CGFloat(value & 0xFF) / 255.0,
                alpha: 1
            )
        })
    }
}
