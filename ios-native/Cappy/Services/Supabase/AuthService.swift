//
//  AuthService.swift
//  Cappy
//
//  GoTrue auth client: email+password, email OTP, Sign in with Apple
//  (id-token exchange), sign-up, refresh, and sign-out. The session is
//  persisted in the Keychain and restored on launch. Mirrors the surface of
//  app/src/api/auth.ts + AuthContext.
//

import Foundation

// MARK: - Session models

struct AuthUser: Codable, Hashable {
    let id: String
    let email: String?
    var userMetadata: [String: JSONValue]?

    enum CodingKeys: String, CodingKey {
        case id, email
        case userMetadata = "user_metadata"
    }

    var displayNameFromMetadata: String? {
        if case .string(let s)? = userMetadata?["display_name"] { return s }
        if case .string(let s)? = userMetadata?["full_name"] { return s }
        return nil
    }
}

struct AuthSession: Codable, Hashable {
    let accessToken: String
    let refreshToken: String
    var expiresAt: Double?
    let user: AuthUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
        case user
    }

    var isExpiringSoon: Bool {
        guard let expiresAt else { return false }
        return Date().timeIntervalSince1970 > (expiresAt - 60)
    }
}

// MARK: - AuthService

final class AuthService {
    private let lock = NSLock()
    private var _session: AuthSession?
    private var refreshTask: Task<Bool, Never>?

    /// GoTrue responses are decoded with a plain decoder: `AuthSession` /
    /// `AuthUser` carry explicit snake_case CodingKeys, so the PostgREST
    /// `convertFromSnakeCase` strategy must NOT be applied here.
    private static let authDecoder = JSONDecoder()

    /// Fired on the main thread whenever the session changes (login / logout /
    /// refresh). `AppState` uses this to drive routing.
    var onSessionChange: ((AuthSession?) -> Void)?

    private static let keychainKey = "session"

    init() {
        restoreSession()
    }

    var currentSession: AuthSession? {
        lock.lock(); defer { lock.unlock() }
        return _session
    }

    var currentUser: AuthUser? { currentSession?.user }
    var isSignedIn: Bool { currentSession != nil }

    private func setSession(_ session: AuthSession?, persist: Bool = true) {
        lock.lock(); _session = session; lock.unlock()
        if persist {
            if let session, let data = try? JSONEncoder().encode(session),
               let json = String(data: data, encoding: .utf8) {
                KeychainStore.set(json, for: Self.keychainKey)
            } else {
                KeychainStore.remove(Self.keychainKey)
            }
        }
        let s = session
        DispatchQueue.main.async { [weak self] in self?.onSessionChange?(s) }
    }

    private func restoreSession() {
        guard let json = KeychainStore.get(Self.keychainKey),
              let data = json.data(using: .utf8),
              let session = try? JSONDecoder().decode(AuthSession.self, from: data)
        else { return }
        lock.lock(); _session = session; lock.unlock()
    }

    // MARK: HTTP helper

    private func post(path: String, query: [URLQueryItem] = [], body: [String: Any]) async throws -> Data {
        var comps = URLComponents(url: SupabaseConfig.authURL.appendingPathComponent(path),
                                  resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = "POST"
        req.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(currentSession?.accessToken ?? SupabaseConfig.anonKey)",
                     forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await SupabaseClient.shared.session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError(status: -1, message: "No HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw SupabaseClient.decodeError(data: data, status: http.statusCode)
        }
        return data
    }

    // MARK: Sign-in flows

    /// Email + password sign-in.
    func signIn(email: String, password: String) async throws {
        let data = try await post(path: "token", query: [URLQueryItem(name: "grant_type", value: "password")],
                                  body: ["email": email.trimmed.lowercased(), "password": password])
        try adoptSession(from: data)
    }

    /// Create an account with email + password. Returns whether the project
    /// requires email confirmation (no session yet).
    func signUp(email: String, password: String, displayName: String?) async throws -> Bool {
        var body: [String: Any] = ["email": email.trimmed.lowercased(), "password": password]
        if let name = displayName?.trimmed, !name.isEmpty {
            body["data"] = ["display_name": name]
        }
        let data = try await post(path: "signup", body: body)
        // If a session came back, adopt it; otherwise confirmation is required.
        if let session = try? Self.authDecoder.decode(AuthSession.self, from: data),
           !session.accessToken.isEmpty {
            setSession(session)
            return false
        }
        return true
    }

    /// Send a 6-digit email OTP code (also usable as a magic link).
    func sendEmailOTP(email: String) async throws {
        _ = try await post(path: "otp", body: ["email": email.trimmed, "create_user": true])
    }

    /// Verify a 6-digit email OTP code and adopt the returned session.
    func verifyEmailOTP(email: String, token: String) async throws {
        let data = try await post(path: "verify",
                                  body: ["type": "email", "email": email.trimmed, "token": token.trimmed])
        try adoptSession(from: data)
    }

    /// Exchange an Apple identity token for a Supabase session.
    func signInWithApple(idToken: String, nonce: String?) async throws {
        var body: [String: Any] = ["provider": "apple", "id_token": idToken]
        if let nonce { body["nonce"] = nonce }
        let data = try await post(path: "token", query: [URLQueryItem(name: "grant_type", value: "id_token")],
                                  body: body)
        try adoptSession(from: data)
    }

    /// Refresh the access token. Returns true if a fresh session was obtained.
    @discardableResult
    func refreshSessionIfPossible() async throws -> Bool {
        guard let refreshToken = currentSession?.refreshToken else { return false }
        // Coalesce concurrent refreshes.
        if let task = refreshTask { return await task.value }
        let task = Task<Bool, Never> { [weak self] in
            guard let self else { return false }
            do {
                let data = try await self.post(
                    path: "token",
                    query: [URLQueryItem(name: "grant_type", value: "refresh_token")],
                    body: ["refresh_token": refreshToken])
                try self.adoptSession(from: data)
                return true
            } catch {
                // Refresh failed (revoked / offline). Sign out on hard failure.
                if let e = error as? SupabaseError, e.status == 400 || e.status == 401 {
                    self.setSession(nil)
                }
                return false
            }
        }
        refreshTask = task
        let result = await task.value
        refreshTask = nil
        return result
    }

    /// Refresh proactively if the token is near expiry (call on app foreground).
    func refreshIfNeeded() async {
        guard let session = currentSession, session.isExpiringSoon else { return }
        _ = try? await refreshSessionIfPossible()
    }

    func signOut() async {
        if currentSession != nil {
            _ = try? await post(path: "logout", body: [:])
        }
        setSession(nil)
    }

    private func adoptSession(from data: Data) throws {
        let session = try Self.authDecoder.decode(AuthSession.self, from: data)
        setSession(session)
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
