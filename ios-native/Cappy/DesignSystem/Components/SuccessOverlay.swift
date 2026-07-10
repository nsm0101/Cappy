//
//  SuccessOverlay.swift
//  Cappy
//
//  Full-screen success confirmation shown after a dose is logged. Auto-
//  dismisses after 2.5s; tapping dismisses immediately. Optional reminder
//  toggle. Port of app/src/components/SuccessOverlay.tsx.
//

import SwiftUI

struct SuccessReminderConfig {
    var enabled: Bool
    let label: String
    let onToggle: (Bool) -> Void
}

/// Optional symptom/note capture shown on the success overlay — lets a parent
/// jot symptoms at the moment of logging for later display in the timeline
/// and dose history.
struct SuccessSymptomConfig {
    /// Persist the composed note; returns true on success.
    let onSave: (String) async -> Bool
}

struct SuccessOverlay: View {
    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @Binding var isPresented: Bool
    var title: String = "Dose logged"
    var subtitle: String? = nil
    var reminder: SuccessReminderConfig? = nil
    var symptoms: SuccessSymptomConfig? = nil
    var onDone: () -> Void

    @State private var appeared = false
    @State private var reminderOn = false

    // Symptom note capture
    private static let quickSymptoms = ["Fever", "Pain", "Cough", "Runny nose", "Teething", "Fussy"]
    @State private var noteExpanded = false
    @State private var selectedSymptoms: Set<String> = []
    @State private var noteText = ""
    @State private var savingNote = false
    @State private var noteSaved = false

    var body: some View {
        ZStack {
            theme.tokens.bg.opacity(0.92).ignoresSafeArea()
            Card {
                VStack(spacing: 0) {
                    // Cappy himself delivers the good news.
                    ZStack(alignment: .bottomTrailing) {
                        Image("CappyMark")
                            .resizable()
                            .scaledToFill()
                            .frame(width: 76, height: 76)
                            .clipShape(Circle())
                            .cappyShadow(theme.shadow2)
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 26))
                            .foregroundStyle(theme.tokens.brand)
                            .background(Circle().fill(theme.tokens.bgCard).padding(2))
                            .offset(x: 4, y: 2)
                    }
                    .scaleEffect(appeared || reduceMotion ? 1 : 0.6)
                    .animation(.spring(response: 0.4, dampingFraction: 0.55), value: appeared)
                    Text(title)
                        .font(CappyFont.display(FontSizeToken.xxl))
                        .foregroundStyle(theme.tokens.fg1)
                        .padding(.top, Space.md)
                        .multilineTextAlignment(.center)
                    if let subtitle {
                        Text(subtitle)
                            .font(CappyFont.sans(FontSizeToken.sm))
                            .foregroundStyle(theme.tokens.fg2)
                            .padding(.top, 4)
                            .multilineTextAlignment(.center)
                    }
                    if let reminder {
                        Divider().overlay(theme.tokens.border).padding(.top, Space.md)
                        HStack(spacing: Space.sm) {
                            Text(reminder.label)
                                .font(CappyFont.sans(FontSizeToken.sm))
                                .foregroundStyle(theme.tokens.fg2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Toggle("", isOn: Binding(
                                get: { reminderOn },
                                set: { reminderOn = $0; reminder.onToggle($0) }))
                                .labelsHidden()
                                .tint(theme.tokens.brand)
                        }
                        .padding(.top, Space.md)
                        .onAppear { reminderOn = reminder.enabled }
                    }
                    if symptoms != nil { symptomSection }
                }
                .frame(maxWidth: .infinity)
            }
            .frame(maxWidth: 340)
            .padding(.horizontal, Space.xxl)
            .scaleEffect(appeared || reduceMotion ? 1 : 0.94)
            .opacity(appeared || reduceMotion ? 1 : 0)
        }
        .contentShape(Rectangle())
        .onTapGesture { if !noteExpanded { dismiss() } }
        .onAppear {
            withAnimation(.easeOut(duration: 0.22)) { appeared = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                // Stay open while the parent is writing a symptom note.
                if isPresented && !noteExpanded { dismiss() }
            }
        }
    }

    // MARK: Symptom note capture

    @ViewBuilder private var symptomSection: some View {
        Divider().overlay(theme.tokens.border).padding(.top, Space.md)
        if noteSaved {
            Label("Note saved", systemImage: "checkmark.circle")
                .font(CappyFont.sansSemibold(FontSizeToken.sm))
                .foregroundStyle(theme.tokens.success)
                .padding(.top, Space.md)
        } else if !noteExpanded {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { noteExpanded = true }
            } label: {
                Label("Add symptoms or a note", systemImage: "square.and.pencil")
                    .font(CappyFont.sansSemibold(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.link)
                    .padding(.top, Space.md)
            }
            .buttonStyle(.plain)
        } else {
            VStack(alignment: .leading, spacing: Space.sm) {
                Text("How are they doing?")
                    .font(CappyFont.sansSemibold(FontSizeToken.sm))
                    .foregroundStyle(theme.tokens.fg2)
                FlowLayout(spacing: 6) {
                    ForEach(Self.quickSymptoms, id: \.self) { symptom in
                        let on = selectedSymptoms.contains(symptom)
                        Button {
                            if on { selectedSymptoms.remove(symptom) } else { selectedSymptoms.insert(symptom) }
                        } label: {
                            Text(symptom)
                                .font(CappyFont.sans(FontSizeToken.xs))
                                .foregroundStyle(on ? theme.tokens.fgOnBrand : theme.tokens.fg2)
                                .padding(.horizontal, Space.md).padding(.vertical, 5)
                                .background(Capsule().fill(on ? theme.tokens.brand : theme.tokens.bgInset))
                        }
                        .buttonStyle(.plain)
                    }
                }
                CappyTextField(placeholder: "Anything else? (optional)", text: $noteText)
                CappyButton(label: "Save note", block: true, loading: savingNote) {
                    Task { await saveNote() }
                }
                .disabled(savingNote || (selectedSymptoms.isEmpty && noteText.trimmingCharacters(in: .whitespaces).isEmpty))
            }
            .padding(.top, Space.md)
        }
    }

    private func saveNote() async {
        guard let symptoms else { return }
        let parts = Self.quickSymptoms.filter { selectedSymptoms.contains($0) }
        let extra = noteText.trimmingCharacters(in: .whitespacesAndNewlines)
        let composed = (parts.joined(separator: ", ") + (extra.isEmpty ? "" : (parts.isEmpty ? "" : " — ") + extra))
        guard !composed.isEmpty else { return }
        savingNote = true
        let ok = await symptoms.onSave(composed)
        savingNote = false
        if ok {
            withAnimation { noteSaved = true; noteExpanded = false }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { if isPresented { dismiss() } }
        }
    }

    private func dismiss() {
        isPresented = false
        onDone()
    }
}
