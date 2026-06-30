# ADR-0004: Native iOS and Android, not React Native or Flutter

**Status:** Accepted
**Date:** Day 0
**Deciders:** Founder, Architect

## Context

Cappy's central interaction is an NFC tap. Reliable NFC support across
iOS and Android is the table-stakes requirement of the product. NFC
support has historically been one of the weakest areas in
cross-platform mobile frameworks:

- React Native NFC support relies on community-maintained packages
  (react-native-nfc-manager) with inconsistent feature coverage and
  platform-specific quirks
- Flutter NFC similarly relies on the nfc_manager community package
- Both stacks add latency for the JS/Dart bridge, which works against
  our <800ms tap-to-screen target
- Background NFC modes, host card emulation, and tag writing have all
  been historically problematic on cross-platform stacks

The maintenance argument for cross-platform ("write once, ship two")
weakens significantly when the central feature requires platform-specific
work anyway.

## Decision

Build native:
- **iOS**: Swift 5.10+, SwiftUI for new screens, UIKit only when SwiftUI
  cannot do the job, Core NFC, Core Data, minimum iOS 16
- **Android**: Kotlin 2.0+, Jetpack Compose, Room, minimum Android 11
  (SDK 30) — built starting month 4

The shared layer is the API contract (OpenAPI generates clients for
both) and the data model concepts. UI is platform-idiomatic.

## Consequences

### Positive
- Best-in-class NFC reliability and performance
- Platform-idiomatic UX (iOS feels like iOS, Android feels like Android)
- Direct access to platform crypto (Apple CryptoKit, Android KeyStore)
- Direct access to platform secure storage (Keychain, EncryptedSharedPreferences)

### Negative
- Two codebases to maintain
- Mobile Engineer agent needs to be competent in both Swift and Kotlin
- Feature parity between platforms requires explicit attention

### Neutral / accepted tradeoffs
- Shipping iOS first, Android in month 4, is a deliberate scope choice
  to fit the 90-day alpha
- We could revisit this if the agentic build experience for native is
  meaningfully worse than for React Native (current evidence: no)

## Alternatives considered

**React Native.** Rejected. NFC support is the deal-breaker. Performance
is acceptable for typical apps but not for our latency target.

**Flutter.** Rejected for the same reason as React Native, plus a
weaker ecosystem of healthcare-specific tooling.

**Capacitor / Ionic.** Rejected. Web-based UI cannot meet the
"native-feel quick screen in <800ms" target.

**Native iOS only, web for everything else.** Considered. Rejected
because Android is too large a market segment to ignore long-term.
But accepted as the alpha-stage scope.

## References

- Core NFC documentation https://developer.apple.com/documentation/corenfc
- Android NFC documentation https://developer.android.com/develop/connectivity/nfc

## Follow-up actions

- Validate Core NFC NDEF reading works as expected on a real iPhone in
  Milestone 0 — file ticket
