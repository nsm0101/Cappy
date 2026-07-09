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

import Foundation

enum Tags {
    static let urlHost = "cappy.closedose.com"
    static var urlPrefix: String { "https://\(urlHost)/t/" }

    static let wellKnownSlugs: [String: MedicationKind] = [
        "ace-child": .acetaminophen,
        "ibu-child": .ibuprofen
    ]

    static func generic(forSlug tagUid: String) -> MedicationKind? {
        wellKnownSlugs[tagUid.trimmingCharacters(in: .whitespaces).lowercased()]
    }

    static func isWellKnownSlug(_ tagUid: String) -> Bool {
        generic(forSlug: tagUid) != nil
    }

    /// Reverse lookup: the well-known slug (if any) for a medication kind.
    /// Lets a flow that only knows a `MedicationKind` — a scheduled dose
    /// reminder, a manual medication pick — re-enter the same tag-resolution
    /// pipeline a live NFC/QR scan uses.
    static func slug(forGeneric kind: MedicationKind) -> String? {
        wellKnownSlugs.first { $0.value == kind }?.key
    }

    enum TagParseError: Error, LocalizedError {
        case invalidUrl(String)
        var errorDescription: String? {
            switch self {
            case .invalidUrl(let m): return m
            }
        }
    }

    /// Parse a scanned payload into a tag UID. Accepts every form a Cappy
    /// sticker has ever carried, so older printings keep working:
    ///   - `https://cappy.closedose.com/t/ace-child`  (current QR + NFC)
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

        let rest: String
        if clean.hasPrefix(urlPrefix) {
            rest = String(clean.dropFirst(urlPrefix.count))
        } else if clean.lowercased().hasPrefix("cappy://t/") {
            rest = String(clean.dropFirst("cappy://t/".count))
        } else {
            return .failure(.invalidUrl("This doesn't look like a Cappy tag."))
        }
        let uid = rest.split(whereSeparator: { $0 == "/" || $0 == "?" || $0 == "#" })
            .first.map(String.init)?
            .trimmingCharacters(in: .whitespaces) ?? ""

        // Allow letters, digits, hyphen, underscore (4–32 chars).
        let pattern = "^[A-Za-z0-9_-]{4,32}$"
        if uid.range(of: pattern, options: .regularExpression) == nil {
            return .failure(.invalidUrl("Tag identifier is invalid."))
        }
        return .success(uid)
    }
}
