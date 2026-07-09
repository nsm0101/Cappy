//
//  SupabaseConfig.swift
//  Cappy
//
//  Backend configuration for the live cappy-prod Supabase project
//  (project ref msjmnvegjrycwoedrwym). The publishable/anon key is a
//  client key — it is safe to embed in the app and is protected by
//  row-level security, exactly like the Expo app's EXPO_PUBLIC_* values.
//
//  To point at a different environment (e.g. cappy-dev, ref
//  hyfmcwswtjlnxtdspggr), either edit the values here or supply
//  SUPABASE_URL / SUPABASE_ANON_KEY via the app's Info.plist (they take
//  precedence when present).
//

import Foundation

enum SupabaseConfig {
    static let url: URL = {
        if let s = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
           let u = URL(string: s), !s.isEmpty {
            return u
        }
        return URL(string: "https://msjmnvegjrycwoedrwym.supabase.co")!
    }()

    static let anonKey: String = {
        if let s = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
           !s.isEmpty {
            return s
        }
        return "sb_publishable_mIqDeSdJdpSgolgpBs1VfA_H_zev7WJ"
    }()

    /// Universal-link host used for NFC tag URLs and invite links.
    static let tagUrlHost = "cappy.closedose.com"

    /// Realtime WebSocket endpoint.
    static var realtimeURL: URL {
        var comps = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        comps.scheme = "wss"
        comps.path = "/realtime/v1/websocket"
        comps.queryItems = [
            URLQueryItem(name: "apikey", value: anonKey),
            URLQueryItem(name: "vsn", value: "1.0.0")
        ]
        return comps.url!
    }

    static var restURL: URL { url.appendingPathComponent("rest/v1") }
    static var authURL: URL { url.appendingPathComponent("auth/v1") }
    static var functionsURL: URL { url.appendingPathComponent("functions/v1") }
    static var storageURL: URL { url.appendingPathComponent("storage/v1") }
}
