//
//  KeychainStore.swift
//  Cappy
//
//  Minimal Keychain wrapper for persisting the Supabase auth session.
//  Tokens land in the iOS Keychain — never UserDefaults — mirroring the
//  Expo app's SecureStore adapter (app/src/api/client.ts).
//

import Foundation
import Security

enum KeychainStore {
    private static let service = "com.closedose.cappy.auth"

    /// Admin-set passcode gating the "Manual Dose Log" path on the Scan
    /// screen (logging a dose without scanning a tag or QR code).
    static let manualDoseLogPasscodeKey = "manualDoseLogPasscode"

    static func set(_ value: String, for key: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8)
        else { return nil }
        return string
    }

    static func remove(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}
