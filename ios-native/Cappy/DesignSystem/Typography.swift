//
//  Typography.swift
//  Cappy
//
//  Cappy uses four type roles (mirroring app/src/theme/tokens.ts):
//    - brand   (Baloo 2)     → the playful "Cappy!" wordmark
//    - display (Nunito Sans) → headings & big numerals
//    - sans    (Inter)       → UI body
//    - mono    (DM Mono)     → units (mL, mg, °F)
//
//  By default these map to Apple's system fonts with an appropriate design so
//  the app is polished out of the box with zero font-bundling. To use the
//  exact brand fonts, drop the TTFs into Resources/Fonts, register them in
//  Info.plist (UIAppFonts), and flip `CappyFont.useBundledFonts = true`.
//

import SwiftUI

enum CappyFont {
    /// Set true after bundling the four brand TTF families (see file header).
    static let useBundledFonts = false

    // Bundled font PostScript names (only used when `useBundledFonts`).
    private static let brandName = "Baloo2-SemiBold"
    private static let brandBoldName = "Baloo2-Bold"
    private static let displayName = "NunitoSans-Bold"
    private static let displaySemiName = "NunitoSans-SemiBold"
    private static let sansName = "Inter-Regular"
    private static let monoName = "DMMono-Regular"

    // MARK: Brand — rounded & friendly
    static func brand(_ size: CGFloat) -> Font {
        useBundledFonts ? .custom(brandName, size: size)
                        : .system(size: size, weight: .semibold, design: .rounded)
    }
    static func brandBold(_ size: CGFloat) -> Font {
        useBundledFonts ? .custom(brandBoldName, size: size)
                        : .system(size: size, weight: .bold, design: .rounded)
    }

    // MARK: Display — headings & numerals (heavy, tight)
    static func display(_ size: CGFloat) -> Font {
        useBundledFonts ? .custom(displayName, size: size)
                        : .system(size: size, weight: .heavy, design: .default)
    }
    static func displaySemibold(_ size: CGFloat) -> Font {
        useBundledFonts ? .custom(displaySemiName, size: size)
                        : .system(size: size, weight: .bold, design: .default)
    }

    // MARK: Sans — UI body
    static func sans(_ size: CGFloat) -> Font {
        useBundledFonts ? .custom(sansName, size: size)
                        : .system(size: size, weight: .regular)
    }
    static func sansMedium(_ size: CGFloat) -> Font {
        useBundledFonts ? .custom("Inter-Medium", size: size)
                        : .system(size: size, weight: .medium)
    }
    static func sansSemibold(_ size: CGFloat) -> Font {
        useBundledFonts ? .custom("Inter-SemiBold", size: size)
                        : .system(size: size, weight: .semibold)
    }
    static func sansBold(_ size: CGFloat) -> Font {
        useBundledFonts ? .custom("Inter-Bold", size: size)
                        : .system(size: size, weight: .bold)
    }

    // MARK: Mono — units
    static func mono(_ size: CGFloat) -> Font {
        useBundledFonts ? .custom(monoName, size: size)
                        : .system(size: size, weight: .regular, design: .monospaced)
    }
}
