//
//  CaregiverSetupView.swift
//  Cappy
//
//  First-run caregiver setup: first/last name, DOB, and consent. Shown by the
//  root gate whenever the profile is incomplete. Port of
//  app/src/screens/CaregiverSetupScreen.tsx.
//

import SwiftUI

struct CaregiverSetupView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme

    private static let minCaregiverAge = 18

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var dob = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    @State private var consent = false
    @State private var saving = false
    @State private var alert: CappyAlert?

    private var age: Int {
        Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                VStack(alignment: .leading, spacing: Space.xs) {
                    Text("Welcome to Cappy")
                        .font(CappyFont.display(FontSizeToken.xxl))
                        .foregroundStyle(theme.tokens.fg1)
                    Text("Let's set up your caregiver profile. Your name appears on the doses you log so other caregivers know who gave a dose.")
                        .font(CappyFont.sans(FontSizeToken.base))
                        .foregroundStyle(theme.tokens.fg2)
                }

                CappyTextField(label: "First name", placeholder: "First name", text: $firstName,
                               autocapitalization: .words, contentType: .givenName)
                CappyTextField(label: "Last name", placeholder: "Last name", text: $lastName,
                               autocapitalization: .words, contentType: .familyName)

                VStack(alignment: .leading, spacing: Space.sm) {
                    SectionLabel(text: "Date of birth")
                    DatePicker("", selection: $dob, in: ...Date(), displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .labelsHidden()
                        .tint(theme.tokens.brand)
                    Text("\(age) years old")
                        .font(CappyFont.sans(FontSizeToken.sm))
                        .foregroundStyle(theme.tokens.fg3)
                }

                Button {
                    consent.toggle()
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(consent ? theme.tokens.brand : .clear)
                                .frame(width: 24, height: 24)
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(consent ? theme.tokens.brand : theme.tokens.border, lineWidth: 2)
                                .frame(width: 24, height: 24)
                            if consent {
                                Image(systemName: "checkmark").font(.system(size: 13, weight: .black))
                                    .foregroundStyle(.white)
                            }
                        }
                        Text("I agree to Cappy's Terms of Service and Privacy Policy, and understand Cappy is a coordination tool, not medical advice.")
                            .font(CappyFont.sans(FontSizeToken.base))
                            .foregroundStyle(theme.tokens.fg2)
                            .multilineTextAlignment(.leading)
                    }
                }
                .buttonStyle(.plain)
                .padding(.top, Space.sm)

                CappyButton(label: "Continue", variant: .blue, size: .lg, block: true, loading: saving) {
                    Task { await save() }
                }
                CappyButton(label: "Sign out", variant: .ghost, block: true) {
                    Task { await model.signOut() }
                }
                if let email = model.session?.user.email {
                    Text(email).font(CappyFont.sans(FontSizeToken.xs))
                        .foregroundStyle(theme.tokens.fgMuted)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .cappyAlert($alert)
        .onAppear {
            firstName = model.profile?.firstName ?? ""
            lastName = model.profile?.lastName ?? ""
            if let d = model.profile?.dateOfBirth, let parsed = CappyTime.date(from: d) { dob = parsed }
        }
    }

    private func save() async {
        guard !firstName.trimmingCharacters(in: .whitespaces).isEmpty,
              !lastName.trimmingCharacters(in: .whitespaces).isEmpty else {
            alert = CappyAlert(title: "Name required", message: "Please enter your first and last name."); return
        }
        guard age >= Self.minCaregiverAge else {
            alert = CappyAlert(title: "Must be 18 or older",
                               message: "Caregiver accounts are for adults. Please check the date of birth you entered."); return
        }
        guard consent else {
            alert = CappyAlert(title: "Consent required", message: "Please agree to the Terms & Privacy Policy to continue."); return
        }
        saving = true; defer { saving = false }
        do {
            try await ProfilesRepository.updateMyProfile(.init(
                firstName: firstName, lastName: lastName, dateOfBirth: dob.yyyyMMdd,
                consentVersion: AppModel.currentConsentVersion))
            Haptics.success()
            await model.refreshProfile()
        } catch {
            alert = CappyAlert(title: "Could not save", message: error.localizedDescription)
        }
    }
}
