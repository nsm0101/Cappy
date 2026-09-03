//
//  UnloggedDosePrompt.swift
//  Cappy
//
//  "Did you give that dose?"
//
//  Shown when a caregiver opened a dose for a family member and no dose
//  followed within the grace window. It asks; it never assumes. ¶[0052] is
//  clear that an absence in the record is not an affirmative finding that
//  nothing was given, and the reverse is just as true: an unanswered tap is
//  not evidence that something was.
//
//  So there are exactly two answers, and neither of them invents an
//  administration event:
//
//    "Yes, log it"  — opens the dose sheet, where the normal interlocks,
//                     weight gate and confirmation apply. The dose is entered
//                     by a person, as it always is.
//    "No, I didn't" — closes the gap. The record is complete again, and the
//                     interlocks stop withholding on `historyIncomplete`.
//
//  There is no third option that quietly guesses, because a guessed dose in
//  the history is worse than a known hole in it: the hole makes Cappy
//  cautious, and the guess makes it confidently wrong.
//

import SwiftUI

struct UnloggedDosePrompt: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var service = UnloggedDoseService.shared

    /// Called with the intent the caregiver wants to finish logging.
    var onLog: (UnloggedDoseService.Intent) -> Void

    var body: some View {
        let due = service.dueIntents()
        if !due.isEmpty {
            VStack(spacing: Space.md) {
                ForEach(due) { intent in
                    card(intent)
                }
            }
        }
    }

    private func card(_ intent: UnloggedDoseService.Intent) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                HStack(spacing: Space.sm) {
                    Image(systemName: "questionmark.circle.fill")
                        .foregroundStyle(theme.tokens.warn)
                    Text("Did you give that dose?")
                        .font(CappyFont.displaySemibold(FontSizeToken.lg))
                        .foregroundStyle(theme.tokens.fg1)
                }

                Text(body(for: intent))
                    .font(CappyFont.sans(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg2)

                // Until this is answered the recent history has a known gap,
                // and the dose card says so rather than quietly working around
                // it. Worth telling the caregiver why it matters.
                Text("Cappy spaces doses using what's been logged, so it'll hold off on new doses of \(intent.medicationName) until it knows.")
                    .font(CappyFont.sans(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg3)

                HStack(spacing: Space.sm) {
                    CappyButton(label: "Yes — log it", variant: .blue, block: true) {
                        onLog(intent)
                    }
                    CappyButton(label: "No, I didn't", variant: .ghost, block: true) {
                        service.dismiss(intent.id)
                    }
                }
            }
        }
        .overlay(RoundedRectangle(cornerRadius: Radius.base)
            .stroke(theme.tokens.warn, lineWidth: 1))
    }

    private func body(for intent: UnloggedDoseService.Intent) -> String {
        let when = CappyTime.relative(intent.openedAt.iso)
        let opener = intent.doseReleased
            ? "You opened a \(intent.medicationName) dose for \(intent.recipientName) \(when)"
            : "You checked \(intent.medicationName) for \(intent.recipientName) \(when)"
        return "\(opener) and never logged one. If it was given, log it now so the next dose is timed correctly."
    }
}
