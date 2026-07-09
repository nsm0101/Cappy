//
//  OnboardingSteps.swift
//  Cappy
//
//  First-run checklist shown on Home until every step is complete. Port of
//  app/src/components/OnboardingSteps.tsx.
//

import SwiftUI

struct OnboardingStep: Identifiable {
    let id = UUID()
    let title: String
    let done: Bool
    let actionLabel: String
    let action: () -> Void
}

struct OnboardingSteps: View {
    @Environment(\.theme) private var theme
    let steps: [OnboardingStep]

    private var nextIndex: Int? { steps.firstIndex(where: { !$0.done }) }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                Text("Get set up")
                    .font(CappyFont.displaySemibold(FontSizeToken.lg))
                    .foregroundStyle(theme.tokens.fg1)
                Text("A few quick steps to start coordinating doses.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg2)

                VStack(spacing: Space.sm) {
                    ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                        HStack(spacing: Space.md) {
                            ZStack {
                                Circle()
                                    .fill(step.done ? theme.tokens.brand : theme.tokens.bgInset)
                                    .frame(width: 26, height: 26)
                                if step.done {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(.white)
                                } else {
                                    Text("\(index + 1)")
                                        .font(CappyFont.sansBold(FontSizeToken.sm))
                                        .foregroundStyle(theme.tokens.fg3)
                                }
                            }
                            Text(step.title)
                                .font(CappyFont.sans(FontSizeToken.base))
                                .foregroundStyle(step.done ? theme.tokens.fg3 : theme.tokens.fg1)
                                .strikethrough(step.done, color: theme.tokens.fg3)
                            Spacer()
                            if index == nextIndex {
                                Button(step.actionLabel, action: step.action)
                                    .font(CappyFont.sansSemibold(FontSizeToken.sm))
                                    .foregroundStyle(theme.tokens.brand)
                            }
                        }
                    }
                }
                .padding(.top, Space.xs)
            }
        }
    }
}
