import SwiftUI

struct CappyCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(CappySpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CappyColor.backgroundElevated)
            .clipShape(RoundedRectangle(cornerRadius: CappyRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: CappyRadius.lg, style: .continuous)
                    .stroke(CappyColor.divider, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.08), radius: 16, x: 0, y: 8)
    }
}
