import SwiftUI

struct ChildAvatar: View {
    let initials: String
    let color: Color

    var body: some View {
        Text(initials.prefix(2).uppercased())
            .font(CappyTypography.caption.weight(.semibold))
            .foregroundStyle(.white)
            .frame(width: CappyTouchTarget.minimum, height: CappyTouchTarget.minimum)
            .background(color)
            .clipShape(Circle())
            .accessibilityHidden(true)
    }
}
