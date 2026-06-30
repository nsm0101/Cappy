# Retrospective: TICKET-IOS-SCAFFOLD

**Date:** 2026-06-30
**Agent role:** Mobile Engineer
**Ticket:** Founder-directed iOS app scaffold kickoff
**Outcome:** Done with follow-ups

## What went well

- The build plan and mobile engineer prompt clearly established native iOS as the alpha direction.
- The design tokens file provided enough structure to create an initial SwiftUI token bridge.
- The design system included enough component references to seed the first Cappy-native card, button, avatar, and status pill components.

## What was harder than expected

- The repository does not currently include an Xcode project generator or a macOS/Xcode environment, so the scaffold could not be compiled with `xcodebuild` here.
- The design system contains CloseDose dose-calculation screens that need careful separation from Cappy's alpha coordination scope.
- The OpenAPI contract appears referenced by documentation but still needs confirmation before a generated Swift client can be wired.

## What I had to invent or assume

- I created a founder-directed scaffold ticket ID because no existing Milestone 2 ticket file exists for the iOS scaffold.
- I assumed placeholder UI copy is acceptable only for scaffolding and avoided displaying sample PHI or clinical dosing guidance.
- I assumed the first source-only scaffold should precede creation of the Xcode project because this environment cannot run Xcode.

## Tech debt or follow-ups created

- High: Generate `Cappy.xcodeproj` on macOS and verify `xcodebuild -scheme Cappy build`.
- High: Add a real Core NFC implementation and test on physical iPhone hardware with NTAG215 tags.
- Medium: Add automated token generation from `design/tokens.json` to `Tokens.swift`.
- Medium: Confirm or complete the OpenAPI contract before implementing networking.
- Medium: Add XCTest and SwiftUI preview coverage for the new components.

## Suggested change to my own system prompt

When scaffolding mobile work in a non-macOS environment, explicitly separate source scaffolding from Xcode project generation and list the macOS verification follow-up.

## Time spent

Approximately 1 agent-hour.
