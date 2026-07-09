//
//  SupabaseClient.swift
//  Cappy
//
//  A small, dependency-free Supabase client built on URLSession. It exposes
//  the four surfaces the app uses — Auth (GoTrue), Database (PostgREST),
//  Functions (Edge Functions) and Realtime — plus Storage signed URLs.
//
//  The client is deliberately hand-rolled (no SPM packages) so the Xcode
//  project resolves and compiles with zero external dependencies.
//

import Foundation

// MARK: - Errors

struct SupabaseError: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }

    /// Postgres error code when surfaced by PostgREST (e.g. "23505").
    var code: String?
}

// MARK: - Shared JSON coders

enum SupabaseJSON {
    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        // NOTE: we deliberately do NOT use `.convertFromSnakeCase`. Foundation's
        // built-in strategy titlecases each segment with `.capitalized`, which
        // mangles keys that contain a number+letter segment: `doses_in_last_24h`
        // becomes `dosesInLast24H` (capital H) and `max_doses_per_24h` becomes
        // `maxDosesPer24H`. Those no longer match the Swift properties
        // (`dosesInLast24h`, `maxDosesPer24h`), so decoding `ResolvedTag`,
        // `Medication`, `DoseStatusResult` and the dose-history embeds throws
        // `keyNotFound` ("The data couldn't be read because it is missing.").
        // This explicit strategy only uppercases the first character of each
        // underscore-separated segment, leaving digits untouched, so every key
        // maps to the exact property name.
        d.keyDecodingStrategy = .custom { path in
            SnakeCaseKey(stringValue: snakeToCamel(path.last!.stringValue))
        }
        return d
    }()

    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    /// snake_case → camelCase that preserves digits: uppercases only the first
    /// character of each segment after the first (e.g. `doses_in_last_24h` →
    /// `dosesInLast24h`, `avatar_url` → `avatarUrl`).
    static func snakeToCamel(_ s: String) -> String {
        guard s.contains("_") else { return s }
        let parts = s.split(separator: "_", omittingEmptySubsequences: true)
        guard let first = parts.first else { return s }
        var out = String(first)
        for part in parts.dropFirst() {
            out += part.prefix(1).uppercased() + part.dropFirst()
        }
        return out
    }

    /// Minimal `CodingKey` used by the custom key-decoding strategy above.
    private struct SnakeCaseKey: CodingKey {
        var stringValue: String
        var intValue: Int?
        init(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { self.intValue = intValue; self.stringValue = String(intValue) }
    }
}

// MARK: - Client

/// The app-wide Supabase facade. `auth` owns the session; the other services
/// read the current access token from it for every request.
final class SupabaseClient {
    static let shared = SupabaseClient()

    let session: URLSession
    let auth: AuthService

    // PostgREST/Functions/Storage wrappers are stateless value-holders, so a
    // fresh instance per access is cheap and avoids any lazy-init race.
    var db: PostgREST { PostgREST(client: self) }
    var functions: FunctionsService { FunctionsService(client: self) }
    var storage: StorageService { StorageService(client: self) }

    /// Realtime owns a single WebSocket, so it must be a shared instance.
    let realtime: RealtimeService

    private init() {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        config.timeoutIntervalForRequest = 30
        let session = URLSession(configuration: config)
        self.session = session
        self.auth = AuthService()
        self.realtime = RealtimeService()
    }

    /// The bearer token to use: the signed-in user's access token, or the
    /// anon key when signed out.
    var bearerToken: String {
        auth.currentSession?.accessToken ?? SupabaseConfig.anonKey
    }

    /// Build a request against a Supabase surface with the standard headers.
    func makeRequest(url: URL, method: String, body: Data? = nil,
                     extraHeaders: [String: String] = [:]) -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        for (k, v) in extraHeaders { req.setValue(v, forHTTPHeaderField: k) }
        req.httpBody = body
        return req
    }

    /// Execute a request, refreshing the session once on a 401 if possible.
    func execute(_ request: URLRequest, allowRefresh: Bool = true) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError(status: -1, message: "No HTTP response")
        }

        if http.statusCode == 401, allowRefresh, auth.currentSession != nil {
            // Token likely expired — refresh once and retry with a new bearer.
            if (try? await auth.refreshSessionIfPossible()) == true {
                var retry = request
                retry.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
                return try await execute(retry, allowRefresh: false)
            }
        }

        guard (200..<300).contains(http.statusCode) else {
            throw Self.decodeError(data: data, status: http.statusCode)
        }
        return (data, http)
    }

    static func decodeError(data: Data, status: Int) -> SupabaseError {
        // PostgREST: { message, code, details, hint }
        // GoTrue:    { error, error_description } or { msg } or { message }
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let msg = (obj["message"] as? String)
                ?? (obj["error_description"] as? String)
                ?? (obj["msg"] as? String)
                ?? (obj["error"] as? String)
                ?? "Request failed (\(status))."
            let code = obj["code"] as? String
            return SupabaseError(status: status, message: msg, code: code)
        }
        return SupabaseError(status: status, message: "Request failed (\(status)).")
    }
}
