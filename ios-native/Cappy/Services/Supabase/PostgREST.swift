//
//  PostgREST.swift
//  Cappy
//
//  A small fluent PostgREST query builder (the subset the app needs):
//  select / insert / update / delete / upsert / rpc with the common filters
//  and modifiers. RLS is enforced server-side; every request carries the
//  signed-in user's bearer token.
//

import Foundation

final class PostgREST {
    private let client: SupabaseClient
    init(client: SupabaseClient) { self.client = client }

    func from(_ table: String) -> PostgRESTQuery {
        PostgRESTQuery(client: client, url: SupabaseConfig.restURL.appendingPathComponent(table))
    }

    /// Call a Postgres function. `params` is encoded as the JSON body.
    func rpc(_ name: String, params: [String: Any]) -> PostgRESTQuery {
        let url = SupabaseConfig.restURL.appendingPathComponent("rpc").appendingPathComponent(name)
        let q = PostgRESTQuery(client: client, url: url)
        q.method = "POST"
        q.body = try? JSONSerialization.data(withJSONObject: params)
        return q
    }
}

final class PostgRESTQuery {
    private let client: SupabaseClient
    private let baseURL: URL
    fileprivate var method = "GET"
    fileprivate var body: Data?
    private var queryItems: [URLQueryItem] = []
    private var preferTokens: [String] = []
    private var wantsSingle = false

    init(client: SupabaseClient, url: URL) {
        self.client = client
        self.baseURL = url
    }

    // MARK: Column selection

    @discardableResult
    func select(_ columns: String = "*") -> Self {
        queryItems.append(URLQueryItem(name: "select", value: columns))
        if method != "GET" && !preferTokens.contains("return=representation") {
            preferTokens.append("return=representation")
        }
        return self
    }

    // MARK: Filters

    @discardableResult func eq(_ column: String, _ value: String) -> Self { filter(column, "eq.\(value)") }
    @discardableResult func neq(_ column: String, _ value: String) -> Self { filter(column, "neq.\(value)") }
    @discardableResult func lt(_ column: String, _ value: String) -> Self { filter(column, "lt.\(value)") }
    @discardableResult func gt(_ column: String, _ value: String) -> Self { filter(column, "gt.\(value)") }
    @discardableResult func gte(_ column: String, _ value: String) -> Self { filter(column, "gte.\(value)") }
    @discardableResult func isNull(_ column: String) -> Self { filter(column, "is.null") }
    @discardableResult func isValue(_ column: String, _ value: String) -> Self { filter(column, "is.\(value)") }

    private func filter(_ column: String, _ value: String) -> Self {
        queryItems.append(URLQueryItem(name: column, value: value))
        return self
    }

    // MARK: Modifiers

    @discardableResult
    func order(_ column: String, ascending: Bool = true) -> Self {
        queryItems.append(URLQueryItem(name: "order", value: "\(column).\(ascending ? "asc" : "desc")"))
        return self
    }

    @discardableResult
    func limit(_ n: Int) -> Self {
        queryItems.append(URLQueryItem(name: "limit", value: String(n)))
        return self
    }

    /// Expect (and decode) exactly one object.
    @discardableResult
    func single() -> Self { wantsSingle = true; return self }

    // MARK: Writes

    @discardableResult
    func insert(_ values: [String: Any?]) -> Self {
        method = "POST"
        body = try? JSONSerialization.data(withJSONObject: Self.clean(values))
        preferTokens.append("return=representation")
        return self
    }

    @discardableResult
    func update(_ values: [String: Any?]) -> Self {
        method = "PATCH"
        body = try? JSONSerialization.data(withJSONObject: Self.clean(values))
        preferTokens.append("return=representation")
        return self
    }

    @discardableResult
    func upsert(_ values: [String: Any?], onConflict: String) -> Self {
        method = "POST"
        body = try? JSONSerialization.data(withJSONObject: Self.clean(values))
        queryItems.append(URLQueryItem(name: "on_conflict", value: onConflict))
        preferTokens.append("resolution=merge-duplicates")
        preferTokens.append("return=representation")
        return self
    }

    @discardableResult
    func delete() -> Self {
        method = "DELETE"
        return self
    }

    /// Replace nil optionals with NSNull so JSONSerialization keeps the key.
    private static func clean(_ values: [String: Any?]) -> [String: Any] {
        var out: [String: Any] = [:]
        for (k, v) in values { out[k] = v ?? NSNull() }
        return out
    }

    // MARK: Execution

    private func buildRequest() -> URLRequest {
        var comps = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        if !queryItems.isEmpty { comps.queryItems = queryItems }
        var headers: [String: String] = [:]
        if !preferTokens.isEmpty { headers["Prefer"] = preferTokens.joined(separator: ",") }
        if wantsSingle { headers["Accept"] = "application/vnd.pgrst.object+json" }
        return client.makeRequest(url: comps.url!, method: method, body: body, extraHeaders: headers)
    }

    /// Run and return the raw response data.
    @discardableResult
    func run() async throws -> Data {
        let (data, _) = try await client.execute(buildRequest())
        return data
    }

    /// Run and decode into `T`. PostgREST returns `[]` (not an empty body) for
    /// empty result sets, so a normal decode covers the empty case.
    func execute<T: Decodable>(decoding type: T.Type) async throws -> T {
        let data = try await run()
        return try SupabaseJSON.decoder.decode(T.self, from: data)
    }
}
