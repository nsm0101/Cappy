//
//  SignInView.swift
//  Cappy
//
//  Email + password sign-in / sign-up with native Sign in with Apple.
//  Port of app/src/screens/SignInScreen.tsx.
//

import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme

    private enum Mode { case signIn, signUp }
    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var alert: CappyAlert?
    @State private var appleNonce = ""

    private var isSignUp: Bool { mode == .signUp }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Wordmark(size: 32).padding(.top, Space.xxl).padding(.bottom, Space.xl)

                Text(isSignUp ? "Create your account" : "Welcome back")
                    .font(CappyFont.display(FontSizeToken.xxl))
                    .foregroundStyle(theme.tokens.fg1)
                Text(isSignUp
                     ? "Set up Cappy to coordinate doses with your family."
                     : "Sign in to coordinate doses with your family.")
                    .font(CappyFont.sans(FontSizeToken.base))
                    .foregroundStyle(theme.tokens.fg2)
                    .padding(.top, Space.sm)
                    .padding(.bottom, Space.xl)

                Card {
                    VStack(spacing: Space.base) {
                        if isSignUp {
                            CappyTextField(label: "Your name", placeholder: "e.g. Alex", text: $name,
                                           autocapitalization: .words, contentType: .name)
                        }
                        CappyTextField(label: "Email", placeholder: "you@example.com", text: $email,
                                       keyboard: .emailAddress, autocapitalization: .never,
                                       disableAutocorrection: true, contentType: .emailAddress)
                        CappyTextField(label: "Password", placeholder: "At least 6 characters",
                                       text: $password, secure: true, autocapitalization: .never,
                                       contentType: isSignUp ? .newPassword : .password)
                        CappyButton(label: busy ? "Please wait…" : (isSignUp ? "Create account" : "Sign in"),
                                    block: true, loading: busy) { Task { await submit() } }
                            .disabled(busy || email.isEmpty || password.count < 6)
                    }
                }

                dividerOr
                SignInWithAppleButton(.continue) { request in
                    appleNonce = AppleSignIn.randomNonce()
                    request.requestedScopes = [.fullName, .email]
                    request.nonce = AppleSignIn.sha256(appleNonce)
                } onCompletion: { result in
                    Task { await handleApple(result) }
                }
                .signInWithAppleButtonStyle(theme.colorScheme == .dark ? .white : .black)
                .frame(height: 50)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))

                Button(isSignUp ? "Already have an account? Sign in" : "New here? Create an account") {
                    mode = isSignUp ? .signIn : .signUp
                }
                .font(CappyFont.sansSemibold(FontSizeToken.base))
                .foregroundStyle(theme.tokens.brand)
                .frame(maxWidth: .infinity)
                .padding(.top, Space.lg)

                Text("By continuing you agree to our Terms and Privacy Policy. Cappy is a coordination tool, not medical advice — always follow the medication label and consult a pediatrician for dosing decisions.")
                    .font(CappyFont.sans(FontSizeToken.xs))
                    .foregroundStyle(theme.tokens.fg3)
                    .multilineTextAlignment(.center)
                    .padding(.top, Space.xxl)
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .cappyAlert($alert)
    }

    private var dividerOr: some View {
        HStack {
            Rectangle().fill(theme.tokens.border).frame(height: 1)
            Text("or").font(CappyFont.sans(FontSizeToken.xs)).foregroundStyle(theme.tokens.fg3)
                .padding(.horizontal, Space.md)
            Rectangle().fill(theme.tokens.border).frame(height: 1)
        }
        .padding(.vertical, Space.lg)
    }

    private func submit() async {
        let trimmed = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard trimmed.range(of: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", options: .regularExpression) != nil else {
            alert = CappyAlert(title: "Email needed", message: "Please enter a valid email address."); return
        }
        guard password.count >= 6 else {
            alert = CappyAlert(title: "Password too short", message: "Use at least 6 characters."); return
        }
        if isSignUp, name.trimmingCharacters(in: .whitespaces).isEmpty {
            alert = CappyAlert(title: "Name needed", message: "Enter your name so doses are attributed to you."); return
        }
        busy = true; defer { busy = false }
        do {
            if isSignUp {
                let needsConfirm = try await SupabaseClient.shared.auth.signUp(
                    email: trimmed, password: password, displayName: name)
                if needsConfirm {
                    mode = .signIn
                    alert = CappyAlert(title: "Check your email",
                                       message: "We sent a confirmation link to \(trimmed). Tap it, then come back and sign in.")
                }
            } else {
                try await SupabaseClient.shared.auth.signIn(email: trimmed, password: password)
            }
        } catch {
            alert = CappyAlert(title: isSignUp ? "Couldn't create account" : "Couldn't sign in",
                               message: error.localizedDescription)
        }
    }

    private func handleApple(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            alert = CappyAlert(title: "Apple sign-in failed", message: error.localizedDescription)
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8) else {
                alert = CappyAlert(title: "Apple sign-in failed", message: "No identity token returned from Apple.")
                return
            }
            busy = true; defer { busy = false }
            do {
                try await SupabaseClient.shared.auth.signInWithApple(idToken: idToken, nonce: appleNonce)
            } catch {
                alert = CappyAlert(title: "Apple sign-in failed", message: error.localizedDescription)
            }
        }
    }
}
