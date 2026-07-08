# Cappy — Native iOS App (SwiftUI)

A ground-up **native Swift / SwiftUI** rebuild of the Cappy family
medication-coordination app, replacing the Expo/React Native client (`/app`)
with a pure-Apple implementation. It talks to the **same live Supabase
backend** (project `hyfmcwswtjlnxtdspggr`) and preserves every core concept of
the original: tap-to-coordinate NFC dosing, weight/age-aware dose safety,
per-family caregivers and roles, real-time sync, and the full Cappy design
system.

No Expo, no React Native, no JavaScript bridge — this is a first-class iOS app
that uses CoreNFC, Sign in with Apple, ActivityKit (Live Activities),
WidgetKit, UserNotifications, and the Keychain directly.

---

## Opening the project

**Option A — open the pre-generated project (no tools needed):**

```
open Cappy.xcodeproj
```

Then set your **Team** under *Signing & Capabilities* for both targets and run.

**Option B — regenerate with XcodeGen (canonical spec):**

```
brew install xcodegen
xcodegen generate
open Cappy.xcodeproj
```

`project.yml` is the source of truth for the project structure; the committed
`Cappy.xcodeproj` is generated from it (via `project/generate_xcodeproj.py`, a
dependency-free fallback that produces the same two-target project). Regenerate
after adding or moving files.

- **Deployment target:** iOS 17.0
- **Targets:** `Cappy` (app) + `CappyWidgetExtension` (widget & Live Activity)
- **Bundle IDs:** `com.closedose.cappy` / `com.closedose.cappy.CappyWidget`
- **App Group:** `group.com.closedose.cappy` (shared snapshot for the widget)

---

## First-run configuration

Everything needed to build and run on the Simulator is already in place. Before
running on a **device** or submitting, set:

1. **Signing team** — select your Apple Developer team for both targets
   (`DEVELOPMENT_TEAM` in `project.yml`, or the Signing tab).
2. **Capabilities** (already declared in the entitlements files — just make sure
   they're enabled on your App ID in the developer portal):
   - Near Field Communication Tag Reading
   - Sign in with Apple
   - Associated Domains (`applinks:cappy.closedose.com`)
   - App Groups (`group.com.closedose.cappy`)
   - Push Notifications is **not** required (reminders are local).
3. **Supabase** — the publishable anon key + URL are embedded in
   `Cappy/Services/Supabase/SupabaseConfig.swift` (the same client-safe values
   the Expo app ships, protected by row-level security). To point at another
   environment, edit that file or add `SUPABASE_URL` / `SUPABASE_ANON_KEY` to
   `Info.plist` (they take precedence).

The Apple provider must be enabled in Supabase Auth with `com.closedose.cappy`
as an authorized client ID — same requirement as the Expo build.

---

## Architecture

```
Cappy/
  App/              CappyApp, RootView, MainTabView, AppModel (state), TabRouter
  DesignSystem/     Tokens, Theme, Typography + reusable components
  Models/           Codable ports of the Supabase schema + ResolvedTag
  Domain/           Dosing engine, time/format helpers, brands, allergens, tags
  Services/
    Supabase/       Dependency-free client: Auth (GoTrue), PostgREST, Functions,
                    Realtime (WebSocket), Storage
    Repositories/   One per API module (families, children, doses, nfc, …)
    NFC/            CoreNFC read + write
    Notifications/  Local reminders + Live Activity controller
    Keychain/       Session persistence
  Features/         One folder per screen (view + view-model where needed)
  Resources/        Info.plist, entitlements, Assets, PrivacyInfo.xcprivacy
Shared/             Files compiled into BOTH app + widget (App Group snapshot,
                    Live Activity attributes)
CappyWidget/        Home Screen widget + Live Activity UI
```

**State flow** mirrors the Expo contexts, consolidated into one `AppModel`
(`@MainActor ObservableObject`): session → caregiver profile → active family,
driving the routing gate (splash → sign-in → caregiver setup → tabs).

**Networking** is hand-rolled on `URLSession` with **zero external
dependencies**, so the project resolves and compiles with nothing to fetch. It
implements the exact surface the app uses: GoTrue password/OTP/Apple-id-token
auth with Keychain-persisted sessions and silent refresh, a small PostgREST
query builder, Edge Function invocation (`nfc-resolve`, `accept-invite`), a
Phoenix-protocol Realtime subscription for live dose updates, and Storage signed
URLs for avatars.

**The dosing engine** (`Domain/Dosing.swift`) is a faithful line-by-line port of
`app/src/lib/dosing.ts`; the server still owns the safety *clock* via the
`compute_dose_status` RPC, exactly as in the original.

---

## Feature parity with the Expo app

| Concept | Native implementation |
|---|---|
| Tap-to-coordinate NFC | `NfcService` (CoreNFC read/write) → `nfc-resolve` → DoseSheet |
| Dose safety (due/early/recent/overdue/max) | `DosePill` + `compute_dose_status` RPC |
| Weight/age dosing engine | `Domain/Dosing.swift` (acetaminophen + ibuprofen, age gates) |
| Home dashboard + onboarding checklist | `HomeView` |
| Scan (+ manual fallback for Simulator) | `ScanView` |
| Log-a-dose quick action | `DoseSheetView` (child + caregiver recipients, backdating, SAFE-3 recheck) |
| Timeline (family-wide, live) | `TimelineView` + Realtime |
| Schedule (dose-window clocks) | `ScheduleView` + `DoseClock` |
| Settings (theme, reminders, profile) | `SettingsView` |
| Child detail (weight, allergies, history) | `ChildDetailView` (manual weight entry) |
| Add child / create family / accept invite | dedicated screens |
| Family dashboard (caregivers, invites, brands) | `FamilyDashboardView` |
| Share-via-Tap (QR + NFC write + link) | `ShareViaTapView` |
| Sign in with Apple + email/password | `SignInView` (AuthenticationServices) |
| Caregiver setup + consent gate | `CaregiverSetupView` |
| Light/Dark theming + design tokens | `DesignSystem/*` |
| Universal Links (tag taps, invite links) | `AppModel.handle(url:)` + entitlements |
| Real-time cross-caregiver sync | `RealtimeService` |
| Local next-dose reminders | `ReminderService` |

**Native additions beyond parity:** a Home Screen **widget** (next-safe-dose per
child) and a **Live Activity** countdown to the next safe dose (lock screen +
Dynamic Island).

---

## Fonts

The Cappy type roles (Baloo 2 / Nunito Sans / Inter / DM Mono) map to Apple
system fonts by default (`SF Pro Rounded` for the wordmark, `SF Mono` for units,
etc.), so the app looks polished out of the box with no font bundling. To use
the exact brand fonts, drop the TTFs into `Cappy/Resources/Fonts`, add
`UIAppFonts` to `Info.plist`, and set `CappyFont.useBundledFonts = true`
(`DesignSystem/Typography.swift`).

---

## Simulator vs device

- **CoreNFC** is device-only. On the Simulator, the Scan screen offers a manual
  "log without scanning" fallback (tap the built-in `ace-child` / `ibu-child`
  sticker codes or enter a tag ID).
- Everything else — auth, dosing, timeline, realtime, widgets — runs in the
  Simulator against the live backend.
- Weight is entered manually (dosing is weight-based). Cappy does not read from
  Apple Health, since HealthKit tracks the phone owner's body mass, not a
  child's.

---

## Notes

- All rights reserved. Proprietary to the Cappy product; not for distribution.
- See `SUBMISSION-CHECKLIST.md` for the App Store submission steps.
