# Cappy iOS App

Native iOS is the alpha mobile target for Cappy. ADR-0004 rejects React Native and Flutter for the alpha because the product depends on reliable NFC behavior and a sub-second tap-to-screen path.

## Current scaffold

This directory now contains the first native SwiftUI source scaffold for the Cappy app:

```text
/ios/
  /Cappy/
    /App/                 App entry point and dependency root
    /Features/            Auth, Family, Children, NFC, Doses, Settings
    /Core/                Networking, Persistence, Crypto, Realtime, Logging
    /Design/              Tokens and reusable SwiftUI components
    /Resources/           Assets and localizable resources
  /CappyTests/
  /CappyUITests/
```

An Xcode project still needs to be generated on macOS. The next mobile ticket should create `Cappy.xcodeproj`, attach these source files to the app target, set the minimum deployment target to iOS 16, and run `xcodebuild -scheme Cappy build`.

## Design system source of truth

`../design/tokens.json` is the machine-readable source of truth for app colors, spacing, typography, radii, motion, and touch target minimums. `Cappy/Design/Tokens.swift` is the native SwiftUI bridge and should be updated whenever the token JSON changes.

The visual references in `../../Cappy Design System_6.29.26/` are useful for component behavior and tone, but the alpha app should implement Cappy coordination screens rather than CloseDose dose-calculation screens.

## Safety notes

- Do not log child names, caregiver names, medication details, dose details, email addresses, or other PHI.
- NFC tags carry only a UID. Medication and child context must come from the authenticated API.
- Dose logging must eventually use a local pending state and an idempotency key before syncing to the server.
- Cappy coordinates a shared record; it must not present itself as clinical guidance.

## Immediate next steps

1. Generate `Cappy.xcodeproj` on macOS and attach the scaffolded sources.
2. Add the Core NFC entitlement and spike real NTAG215 UID reading on device.
3. Generate the Swift API client from `contracts/openapi/cappy.yaml` once the contract is complete.
4. Add Core Data models for pending dose events and cached family context.
5. Add SwiftUI previews and XCTest coverage for design components.
