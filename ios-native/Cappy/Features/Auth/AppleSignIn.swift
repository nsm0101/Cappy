//
//  AppleSignIn.swift
//  Cappy
//
//  Nonce helpers for Sign in with Apple. Supabase verifies the id-token's
//  embedded (hashed) nonce against the raw nonce we submit, so we send the
//  SHA-256 of the raw nonce to Apple and the raw nonce to Supabase.
//

import Foundation
import CryptoKit

enum AppleSignIn {
    /// Cryptographically-random nonce string.
    static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var randoms = [UInt8](repeating: 0, count: 16)
            _ = SecRandomCopyBytes(kSecRandomDefault, randoms.count, &randoms)
            for random in randoms where remaining > 0 {
                if Int(random) < charset.count {
                    result.append(charset[Int(random)])
                    remaining -= 1
                }
            }
        }
        return result
    }

    /// SHA-256 hex digest of a string (the value handed to Apple).
    static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
