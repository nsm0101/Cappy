import SwiftUI

// MARK: - Color Design Tokens
extension Color {
    // Brand Colors
    static let cappyTeal = Color(hex: "18A78D")
    static let cappyTealHover = Color(hex: "128873")
    static let cappyTealPress = Color(hex: "0E6D5C")
    static let cappyTealDark = Color(hex: "0A4C40")
    static let cappyTealLight = Color(hex: "E8F5F1")
    
    // Capybara Blue (Secondary Accent)
    static let cappyBlue = Color(light: Color(hex: "1E6FC4"), dark: Color(hex: "4D93DD"))
    static let cappyBlueHover = Color(light: Color(hex: "155AA6"), dark: Color(hex: "6FA8E0"))
    static let cappyBluePress = Color(light: Color(hex: "114887"), dark: Color(hex: "A6C9EE"))
    static let cappyBlueTint = Color(light: Color(hex: "EAF2FB"), dark: Color(hex: "4D93DD").opacity(0.16))
    
    // Capybara Tan (Warm Accent for fur/mascots)
    static let cappyTan = Color(hex: "C29A66")
    static let cappyTanLight = Color(hex: "F2E7D6")
    
    // Surfaces
    static let cappyBackground = Color(light: Color(hex: "FBF8F2"), dark: Color(hex: "0B1717"))
    static let cappyCard = Color(light: Color(hex: "FFFFFF"), dark: Color(hex: "13201F"))
    static let cappyInset = Color(light: Color(hex: "F4EFE5"), dark: Color(hex: "1A2A29"))
    
    // Text / Ink
    static let cappyText = Color(light: Color(hex: "0B1E1D"), dark: Color(hex: "E3ECEB"))
    static let cappyTextMuted = Color(light: Color(hex: "566E6C"), dark: Color(hex: "95ACAA"))
    
    // Dose Safety Status
    static let doseDueSolid = Color(light: Color.cappyTeal, dark: Color(hex: "2BCBB0"))
    static let doseDueFG = Color(light: Color(hex: "0A4C40"), dark: Color(hex: "8FE6CF"))
    static let doseDueBG = Color(light: Color.cappyTealLight, dark: Color.cappyTeal.opacity(0.16))
    
    static let doseEarlySolid = Color(light: Color(hex: "D97A0E"), dark: Color(hex: "F59E0B"))
    static let doseEarlyFG = Color(light: Color(hex: "B2620A"), dark: Color(hex: "F4C173"))
    static let doseEarlyBG = Color(light: Color(hex: "FEF3E2"), dark: Color(hex: "D97A0E").opacity(0.18))
    
    static let doseRecentSolid = Color.cappyBlue
    static let doseRecentFG = Color(light: Color(hex: "114887"), dark: Color(hex: "A6C9EE"))
    static let doseRecentBG = Color(light: Color(hex: "EAF2FB"), dark: Color.cappyBlue.opacity(0.16))
    
    static let doseOverdueSolid = Color(light: Color(hex: "D84A4A"), dark: Color(hex: "E05252"))
    static let doseOverdueFG = Color(light: Color(hex: "A83232"), dark: Color(hex: "F2A8A2"))
    static let doseOverdueBG = Color(light: Color(hex: "FCE8E8"), dark: Color(hex: "D84A4A").opacity(0.18))
    
    // NFC Tap Rings
    static let nfcCore = Color.cappyBlue
    static let nfcGlow = Color(light: Color(hex: "1E6FC4").opacity(0.22), dark: Color(hex: "4D93DD").opacity(0.26))
    static let nfcRing = Color(light: Color(hex: "1E6FC4").opacity(0.40), dark: Color(hex: "4D93DD").opacity(0.46))
}

// MARK: - Color Initializer Helpers
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
    
    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}

// MARK: - Typography Design Tokens
struct CappyFont {
    static func display(size: CGFloat) -> Font {
        Font.custom("NunitoSans-Bold", size: size)
            .weight(.bold)
    }
    
    static func displayBlack(size: CGFloat) -> Font {
        Font.custom("NunitoSans-Black", size: size)
            .weight(.black)
    }
    
    static func body(size: CGFloat = 16) -> Font {
        Font.custom("Inter-Regular", size: size)
    }
    
    static func uiMedium(size: CGFloat = 14) -> Font {
        Font.custom("Inter-Medium", size: size)
            .weight(.medium)
    }
    
    static func mono(size: CGFloat = 12) -> Font {
        Font.custom("DMMono-Regular", size: size)
    }
}

// MARK: - Dose Safety Status Enum
enum DoseSafetyStatus: String, CaseIterable, Codable {
    case due = "due"
    case early = "early"
    case recent = "recent"
    case overdue = "overdue"
    
    var title: String {
        switch self {
        case .due: return "Due now"
        case .early: return "Too early"
        case .recent: return "Given recently"
        case .overdue: return "Window passed"
        }
    }
    
    var subtitle: String {
        switch self {
        case .due: return "Enough time has passed; a dose may be given."
        case .early: return "Too soon for another dose. Please wait."
        case .recent: return "A dose was just logged by a caregiver."
        case .overdue: return "An expected dose window has passed."
        }
    }
    
    var solidColor: Color {
        switch self {
        case .due: return .doseDueSolid
        case .early: return .doseEarlySolid
        case .recent: return .doseRecentSolid
        case .overdue: return .doseOverdueSolid
        }
    }
    
    var fgColor: Color {
        switch self {
        case .due: return .doseDueFG
        case .early: return .doseEarlyFG
        case .recent: return .doseRecentFG
        case .overdue: return .doseOverdueFG
        }
    }
    
    var bgColor: Color {
        switch self {
        case .due: return .doseDueBG
        case .early: return .doseEarlyBG
        case .recent: return .doseRecentBG
        case .overdue: return .doseOverdueBG
        }
    }
}

// MARK: - Reusable Design Components
struct DoseStatusPill: View {
    let status: DoseSafetyStatus
    var size: Size = .md
    
    enum Size {
        case sm, md
    }
    
    var body: some View {
        Text(status.title)
            .font(CappyFont.uiMedium(size: size == .sm ? 12 : 14))
            .padding(.horizontal, size == .sm ? 10 : 14)
            .padding(.vertical, size == .sm ? 4 : 6)
            .foregroundColor(status.fgColor)
            .background(status.bgColor)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(status.solidColor.opacity(0.3), lineWidth: 1)
            )
    }
}

struct ChildAvatar: View {
    let initials: String
    let themeColor: Color
    var size: CGFloat = 48
    var isCaregiver: Bool = false
    var caregiverRole: String? = nil
    
    var body: some View {
        ZStack {
            Circle()
                .fill(themeColor.opacity(0.15))
                .frame(width: size, height: size)
            
            Text(initials.uppercased())
                .font(CappyFont.display(size: size * 0.4))
                .foregroundColor(themeColor)
            
            Circle()
                .strokeBorder(themeColor, lineWidth: 1.5)
                .frame(width: size, height: size)
        }
        .overlay(
            Group {
                if isCaregiver && caregiverRole != nil {
                    Circle()
                        .fill(Color.cappyBlue)
                        .frame(width: size * 0.35, height: size * 0.35)
                        .overlay(
                            Image(systemName: "shield.fill")
                                .resizable()
                                .scaledToFit()
                                .foregroundColor(.white)
                                .padding(2)
                        )
                        .offset(x: size * 0.35, y: size * 0.35)
                }
            }
        )
    }
}

// MARK: - Card Container Modifier
struct CappyCardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(24)
            .background(Color.cappyCard)
            .cornerRadius(16)
            .shadow(color: Color.black.opacity(0.04), radius: 2, x: 0, y: 1)
            .shadow(color: Color.black.opacity(0.10), radius: 24, x: 0, y: 8)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.cappyText.opacity(0.08), lineWidth: 1)
            )
    }
}

extension View {
    func cappyCard() -> some View {
        self.modifier(CappyCardStyle())
    }
}
