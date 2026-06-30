# ADR-0008: NTAG215 stickers with custom URI scheme

**Status:** Accepted
**Date:** Day 0
**Deciders:** Founder, Architect

## Context

Cappy's central interaction is the NFC tap. We need to choose:
1. The physical tag hardware
2. The NDEF payload format
3. How the phone goes from tap to the right app screen
4. How the server identifies which medication and family the tag
   belongs to

## Decision

### Hardware: NTAG215

- **NTAG215** stickers (NXP NFC Forum Type 2 tag, 540 bytes)
- ~$0.30 per sticker in small quantities; pennies at volume
- Universally readable on iOS 13+ and Android 4.4+
- Generic, off-the-shelf — no manufacturing relationships needed for
  alpha
- The founder writes tags using a phone-based NFC writer app or a USB
  NFC reader/writer

### NDEF payload: Custom URI

Each tag stores a single NDEF URI record of the form:

```
https://tap.cappy.app/t/{TAG_UID}
```

- Universal Link / App Link convention, not a custom URL scheme; this
  is what works reliably on iOS Background Tag Reading
- The path component `{TAG_UID}` is the tag's hardware UID, which is
  globally unique and immutable
- The server resolves `{TAG_UID}` to (medication, family, child) via
  the `nfc_tags` table

### Tag-to-context mapping

Tags are not pre-bound to medication or family at manufacture. Binding
happens at provisioning time:

1. Founder (or, post-alpha, the family admin) opens the app's tag
   provisioning flow
2. App reads the empty tag's UID
3. App writes the URI payload to the tag
4. App sends a registration request to the server: "this UID belongs
   to family X, medication Y"
5. Server stores the binding in `nfc_tags`

A tag tapped before registration shows an "unregistered tag" screen
with a button to register it (admin-only).

### Tag-to-app routing on tap

- **iOS** — the URL `https://tap.cappy.app/t/...` is registered as a
  Universal Link associated with the Cappy app via
  `apple-app-site-association`. iOS Background Tag Reading detects the
  NDEF URI and opens the Cappy app directly to the right screen.
- **Android** (post-alpha) — App Links via `assetlinks.json` provide
  equivalent behavior.

### Security properties

- Tags carry only a UID. They contain no PHI. A lost or stolen tag
  reveals only "this tag was assigned to some medication for some
  family"; an attacker cannot resolve it without an authenticated
  caregiver session for the binding family.
- The server-side binding can be rotated: if a tag is lost, the admin
  marks it revoked, the URI now resolves to "unregistered" for
  everyone.
- We do not use NTAG215's password protection or signature features
  in alpha — the security model is server-side, not tag-side.

## Consequences

### Positive
- Cheap, available, no supplier dependency
- Robust on iOS background tag reading
- Tags are interchangeable; no per-medication or per-family
  manufacturing
- Lost tags are low-impact

### Negative
- A tag in the hands of an unauthorized person could be tapped to
  identify *that something is in this drawer*; this is low-stakes
  metadata leakage
- Tag UIDs are not cryptographically authenticated; if an attacker
  knew a UID, they could fabricate a sticker. Mitigated by server-side
  authorization — even with the UID, the attacker cannot log a dose
  without a valid caregiver session.

### Neutral / accepted tradeoffs
- Universal Link domain (`tap.cappy.app`) must be registered and TLS
  served from day 1
- We pre-buy a roll of 100 NTAG215 stickers for alpha (~$30)

## Alternatives considered

**Pre-programmed tags from a vendor.** Considered. Rejected for alpha
because of supplier coordination costs and inflexibility for design
iteration.

**QR codes instead of NFC.** Rejected. The brief explicitly anchors
the product on NFC, and QR fails the "one-handed in dim light" test.

**iOS custom URL scheme (`cappy://`).** Rejected. iOS does not handle
custom schemes via background tag reading; only Universal Links work
for the seamless tap experience.

**Tag-side encryption / signing (NTAG424 DNA).** Considered. Rejected
for alpha on cost and complexity grounds. Reasonable upgrade path
post-alpha if tag forgery becomes a real threat.

## References

- NXP NTAG215 datasheet
- Apple Background Tag Reading
  https://developer.apple.com/documentation/corenfc/adding_support_for_background_tag_reading
- NFC Forum NDEF specification

## Follow-up actions

- Register `tap.cappy.app` domain — founder action
- Set up apple-app-site-association on the domain — file ticket
- Buy a roll of NTAG215 stickers — founder action
- Build CLI tag-programming utility — file ticket (TICKET-NFC-001)
