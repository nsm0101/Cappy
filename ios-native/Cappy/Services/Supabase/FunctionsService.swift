//
//  FunctionsService.swift
//  Cappy
//
//  Invokes Supabase Edge Functions (nfc-resolve, accept-invite). Requests
//  carry the caller's JWT so RLS still applies inside the function.
//

import Foundation

final class FunctionsService {
    private let client: SupabaseClient
    init(client: SupabaseClient) { self.client = client }

    /// Invoke an Edge Function with a JSON body, decoding the response.
    func invoke<T: Decodable>(_ name: String, body: [String: Any], decoding: T.Type) async throws -> T {
        let data = try await invokeRaw(name, body: body)
        return try SupabaseJSON.decoder.decode(T.self, from: data)
    }

    /// Invoke and return raw data (caller decodes / inspects).
    @discardableResult
    func invokeRaw(_ name: String, body: [String: Any]) async throws -> Data {
        let url = SupabaseConfig.functionsURL.appendingPathComponent(name)
        let payload = try JSONSerialization.data(withJSONObject: body)
        let request = client.makeRequest(url: url, method: "POST", body: payload)
        let (data, _) = try await client.execute(request)
        return data
    }
}
