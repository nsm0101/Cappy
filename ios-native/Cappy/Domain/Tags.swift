//
//  Tags.swift
//  Cappy
//
//  Well-known NFC tag slugs + tag-URL parsing, ported from app/src/lib/tags.ts
//  and app/src/nfc/nfcService.ts.
//
//  The mass-produced Cappy stickers carry a short URL like
//  https://cappy.closedose.com/t/ace-child. A well-known slug identifies the
//  *medication*, not a family — the family comes from the caller's active
//  family at resolve time, so the same sticker works for every household.
//
//  Printed and 3D-printed tokens carry the shorter captap.pro form instead:
//  HTTP://CAPTAP.PRO/AC. All-uppercase and 20 characters, that encodes as a
//  version-1 (21x21 module) QR in alphanumeric mode, where the closedose.com
//  form is a version-4 (33x33) in byte mode — the difference between two
//  printer perimeters per cell and less than two on a token-sized tag.
//  captap.pro redirects to /t/{slug} for the browser; the app claims the
//  Universal Link and skips the hop.
//

import Foundation

enum Tags {
    static let urlHost = "cappy.closedose.com"
    static var urlPrefix: String { "https://\(urlHost)/t/" }

    /// Short-link host for printed QR tokens. Its entire path is the tag UID
    /// — there is no `/t/` segment, because every character spent there
    /// pushes the QR to a larger version.
    static let shortHost = "captap.pro"

    static let wellKnownSlugs: [String: MedicationKind] = [
        "ace-child": .acetaminophen,
        "ibu-child": .ibuprofen,
        // captap.pro two-character codes. A version-1 QR at ECC M holds 20
        // alphanumeric characters and "HTTP://CAPTAP.PRO/" spends 18, so the
        // smallest possible symbol leaves room for exactly two.
        "ac": .acetaminophen,
        "ib": .ibuprofen
    ]

    static func generic(forSlug tagUid: String) -> MedicationKind? {
        wellKnownSlugs[tagUid.trimmingCharacters(in: .whitespaces).lowercased()]
    }

    static func isWellKnownSlug(_ tagUid: String) -> Bool {
        generic(forSlug: tagUid) != nil
    }

    /// Reverse lookup: the canonical well-known slug for a medication kind.
    /// Lets a flow that only knows a `MedicationKind` — a scheduled dose
    /// reminder, a manual medication pick — re-enter the same tag-resolution
    /// pipeline a live NFC/QR scan uses.
    ///
    /// A switch rather than a reverse dictionary lookup: two slugs now map to
    /// each kind, and `Dictionary.first(where:)` has no defined iteration
    /// order, so it would return "ac" or "ace-child" at random. Both resolve,
    /// but a stable answer keeps notification `userInfo` payloads comparable.
    static func slug(forGeneric kind: MedicationKind) -> String? {
        switch kind {
        case .acetaminophen: return "ace-child"
        case .ibuprofen: return "ibu-child"
        }
    }

    enum TagParseError: Error, LocalizedError {
        case invalidUrl(String)
        var errorDescription: String? {
            switch self {
            case .invalidUrl(let m): return m
            }
        }
    }

    /// The path of a captap.pro short link, lowercased, or nil if the payload
    /// is not one. Both schemes are accepted: the printed QR encodes `HTTP://`
    /// because `HTTPS://` costs two more characters, and Cloudflare upgrades
    /// the hop anyway. A bare `captap.pro/ac` is accepted too, in case a
    /// scanner hands back the display form without a scheme.
    private static func shortLinkPath(in lowered: String) -> String? {
        for prefix in ["https://\(shortHost)/", "http://\(shortHost)/", "\(shortHost)/"] {
            if lowered.hasPrefix(prefix) {
                return String(lowered.dropFirst(prefix.count))
            }
        }
        return nil
    }

    /// Parse a scanned payload into a tag UID. Accepts every form a Cappy
    /// sticker has ever carried, so older printings keep working:
    ///   - `https://cappy.closedose.com/t/ace-child`  (NFC + earlier QR)
    ///   - `HTTP://CAPTAP.PRO/AC`                     (current printed QR)
    ///   - `cappy://t/ace-child`                       (custom-scheme deep link)
    ///   - `ace-child`                                 (bare well-known slug)
    /// Used for live NFC/QR scans and cold-launch via Universal Links.
    static func parseTagUrl(_ url: String) -> Result<String, TagParseError> {
        guard !url.isEmpty else {
            return .failure(.invalidUrl("No URL on the tag."))
        }
        var clean = url.trimmingCharacters(in: .whitespacesAndNewlines)
        while clean.hasSuffix("\0") { clean.removeLast() }

        // Bare well-known slug (e.g. a QR that encodes just "ace-child").
        if isWellKnownSlug(clean) {
            return .success(clean.lowercased())
        }

        // Scheme and host are case-insensitive per RFC 3986, and the printed
        // QR is all-uppercase to stay in alphanumeric mode, so match lowered.
        // Hardware UIDs stay original-case: only the short link, whose codes
        // are always lowercase in the slug map, is sliced from `lowered`.
        let lowered = clean.lowercased()
        let rest: String
        if lowered.hasPrefix(urlPrefix) {
            rest = String(clean.dropFirst(urlPrefix.count))
        } else if lowered.hasPrefix("cappy://t/") {
            rest = String(clean.dropFirst("cappy://t/".count))
        } else if let shortPath = shortLinkPath(in: lowered) {
            rest = shortPath
        } else {
            return .failure(.invalidUrl("This doesn't look like a Cappy tag."))
        }
        let uid = rest.split(whereSeparator: { $0 == "/" || $0 == "?" || $0 == "#" })
            .first.map(String.init)?
            .trimmingCharacters(in: .whitespaces) ?? ""

        // Allow letters, digits, hyphen, underscore (2–32 chars). The lower
        // bound is 2, not 4, because the captap.pro codes are two characters.
        let pattern = "^[A-Za-z0-9_-]{2,32}$"
        if uid.range(of: pattern, options: .regularExpression) == nil {
            return .failure(.invalidUrl("Tag identifier is invalid."))
        }
        return .success(uid)
    }
}
