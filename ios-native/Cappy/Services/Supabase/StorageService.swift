//
//  StorageService.swift
//  Cappy
//
//  Supabase Storage: create short-lived signed URLs for the private
//  `avatars` bucket, and upload avatar images. Mirrors app/src/api/avatars.ts.
//

import Foundation

final class StorageService {
    private let client: SupabaseClient
    init(client: SupabaseClient) { self.client = client }

    private let bucket = "avatars"

    /// Resolve a stored object path to a signed URL for display.
    func signedURL(path: String, expiresIn seconds: Int = 3600) async -> URL? {
        guard !path.isEmpty else { return nil }
        let url = SupabaseConfig.storageURL
            .appendingPathComponent("object/sign")
            .appendingPathComponent(bucket)
            .appendingPathComponent(path)
        let body = try? JSONSerialization.data(withJSONObject: ["expiresIn": seconds])
        let request = client.makeRequest(url: url, method: "POST", body: body)
        guard let (data, _) = try? await client.execute(request),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let signed = obj["signedURL"] as? String
        else { return nil }
        // The API returns a path (with a `?token=…` query) relative to
        // /storage/v1. `appendingPathComponent` would percent-encode the
        // `?` into `%3F`, pushing the token into the path and 400-ing the
        // download — so concatenate the string and let URL parse the query.
        let base = SupabaseConfig.storageURL.absoluteString
        let rel = signed.hasPrefix("/") ? signed : "/" + signed
        return URL(string: base + rel)
    }

    /// Upload JPEG data to a versioned path and return that path.
    func uploadJPEG(_ data: Data, to path: String) async throws {
        let url = SupabaseConfig.storageURL
            .appendingPathComponent("object")
            .appendingPathComponent(bucket)
            .appendingPathComponent(path)
        var request = client.makeRequest(url: url, method: "POST", body: data,
                                         extraHeaders: ["Content-Type": "image/jpeg",
                                                        "x-upsert": "true"])
        request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        _ = try await client.execute(request)
    }

    func remove(paths: [String]) async {
        let url = SupabaseConfig.storageURL.appendingPathComponent("object").appendingPathComponent(bucket)
        let body = try? JSONSerialization.data(withJSONObject: ["prefixes": paths])
        let request = client.makeRequest(url: url, method: "DELETE", body: body)
        _ = try? await client.execute(request)
    }
}
