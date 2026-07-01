# Cappy ClaudeBuildPlan — Build Status

**Generated:** 2026-06-29 by Claude (Opus 4.7)
**Posture:** C (consumer-app, not HIPAA-covered) — see `docs/posture.md` (TBD)
**Backend:** Supabase-only (no separate Node service in alpha)
**Target:** iOS first via Expo + EAS, Android in month 4
**Approx state:** ~55% of the way to a runnable, testable app

This document is the honest accounting of what's in this bundle and
what still needs to be built before you can `expo start` cleanly,
sign in, log a dose, and have it sync between two devices.

---

## What's in this bundle (working)

### Project scaffolding (complete)
- `package.json` — Expo SDK 51 + React Native 0.74 + Supabase + NFC + Google Fonts
- `app.json` — iOS NFC entitlements, associated domain (`cappy.closedose.com`),
  Android NFC intent filters, splash, icons, bundle ID `com.closedose.cappy`
- `tsconfig.json` — strict mode, path alias `@/*` → `src/*`
- `babel.config.js` — Expo preset + module-resolver + Reanimated
- `metro.config.js` — Expo defaults
- `eas.json` — three EAS build profiles (development / preview / production)
- `.eslintrc.js`, `.prettierrc`, `.gitignore`, `.env.example`

### Theme system (complete)
- `src/theme/tokens.ts` — full design-token translation of `cappy.css`
  (palette, semantic light/dark tokens, dose-safety colors, spacing,
  radii, motion, typography)
- `src/theme/ThemeProvider.tsx` — light/dark/system mode with
  AsyncStorage persistence and OS appearance sync
- `src/theme/fonts.ts` — font-loader stub (needs the
  `@expo-google-fonts/*` imports wired in)
- `src/theme/index.ts` — barrel export

### Components (complete — 13 of 13)
All ported from the CSS design system into React Native primitives:
- `Avatar` — photo or initials, three sizes
- `Badge` — pill labels (OTC / Rx / brand)
- `Button` — primary / blue / secondary / ghost; md / lg; block
- `Card` — surface card, optional inset variant
- `DosePill` — the signature dose-safety status pill (due / early /
  recent / overdue)
- `DoseSafetyText` — quiet disclaimer line, always pairs with a pill
- `Field` — labeled text input with focus state and error variant
- `NfcTarget` — pulsing concentric-rings circle with capybara mark,
  respects Reduce Motion
- `RowItem` — tappable list row with left/right slots and chevron
- `Segmented` — generic segmented control (typed by option value)
- `Sheet` — bottom sheet / centered modal with Reanimated entrance
- `TabBar` — custom bottom tab bar (used by React Navigation custom
  tabBar prop)
- `Wordmark` — the "Cappy!" lockup with the mark image

### API layer (complete — typed Supabase wrapper)
This is the migration boundary. When you eventually leave Supabase,
swap each file's implementation; screens don't change.
- `src/api/client.ts` — Supabase client with SecureStore-backed token
  storage and AppState-aware refresh
- `src/api/database.types.ts` — TypeScript types matching the Postgres
  schema (regenerate with `pnpm supabase:gen-types`)
- `src/api/auth.ts` — magic-link sign in, OTP verify, sign out, session
  observer
- `src/api/families.ts` — listMyFamilies, createFamily,
  listFamilyCaregivers, createInvite, acceptInvite (calls Edge
  Function)
- `src/api/children.ts` — listChildrenInFamily, createChild,
  recordWeight, getLatestWeight
- `src/api/doses.ts` — logDose with client-generated UUIDv4 as primary
  key (idempotent on retry), listDosesForChild, getDoseStatus,
  correctDose
- `src/api/nfc.ts` — resolveNfcTag (calls Edge Function), registerTag
- `src/api/realtime.ts` — subscribeFamilyDoses for live updates
- `src/api/index.ts` — barrel export

### Auth (complete)
- `src/auth/AuthContext.tsx` — Provider + `useAuth` hook with session
  state, isLoading, sign-in / sign-out methods

### NFC service (complete)
- `src/nfc/nfcService.ts` — wraps `react-native-nfc-manager`:
  - `initNfc()` — start manager
  - `scanOnce()` — foreground NDEF read with timeout, returns typed
    error variants
  - `parseTagUrl()` — extracts UID from
    `https://cappy.closedose.com/t/{UID}`
  - `cancelNfcScan()` — cleanup
- `src/nfc/index.ts` — barrel export

### Domain helpers (complete)
- `src/lib/time.ts` — `formatRelativeTime`, `formatTimeUntil`,
  `formatClockTime`
- `src/lib/format.ts` — `formatDoseAmount`, `initialsFromName`,
  `formatWeightFromGrams`
- `src/lib/uuid.ts` — UUIDv4 generator with `crypto.randomUUID()`
  preference

### Screens (4 of 7 complete)
- `SignInScreen` — magic-link entry with "check your email" success
  state
- `HomeScreen` — family list, child rows with `DosePill` + last-dose
  subtitle, empty state with "Create family" / "Join with code"
- `ScanScreen` — NFC tap target with state machine (idle / scanning /
  resolving / error), handles unsupported-device case
- `DoseSheetScreen` — the centerpiece: single-child or multi-child
  picker, suggested dose card, log/adjust/cancel actions

### Supabase backend (complete)
- `supabase/config.toml` — local dev config
- `supabase/migrations/20260101000000_init.sql` — full schema
  (profiles, families, family_caregivers, caregiver_child_access,
  children, weight_records, medications, nfc_tags, dose_events,
  dose_corrections, audit_events, invites) plus acetaminophen seed
- `supabase/migrations/20260101000100_rls.sql` — Row Level Security
  policies enforcing family-scoped authorization, with helper
  functions `is_family_member` and `can_log_dose_for_child`
- `supabase/migrations/20260101000200_triggers.sql` — auto-create
  profile on signup, auto-add family creator as admin, audit-log
  triggers, updated_at triggers, supersede-on-correction trigger,
  realtime publication
- `supabase/migrations/20260101000300_rpc.sql` — `compute_dose_status`
  RPC for server-side dose-safety calculation
- `supabase/functions/_shared/utils.ts` — shared Edge Function helpers
- `supabase/functions/nfc-resolve/index.ts` — tag UID → context
  resolver, computes dose status per child
- `supabase/functions/accept-invite/index.ts` — atomic invite
  acceptance using service role

### Brand assets
- `src/assets/cappy-mark.png` — 1.2 MB; **needs optimization** to
  ~200 KB (see "What's not done")
- `src/assets/cappy-icon.png` — 280 KB; **needs optimization**

---

## What's not in this bundle (you still need)

### Screens not yet written (3 missing)
These are the screens referenced by navigation but not yet implemented:

- **`SettingsScreen.tsx`** — theme toggle, account info, sign out,
  legal links, app version, "report a bug" → mailto. ~150 LoC.
- **`CreateFamilyScreen.tsx`** — single Field for family name + Button
  to call `families.createFamily`, navigate back. ~80 LoC.
- **`AddChildScreen.tsx`** — Field for display name, date picker for
  date of birth, optional weight entry, calls `children.createChild`
  and optionally `children.recordWeight`. ~120 LoC.
- **`AcceptInviteScreen.tsx`** — six-digit code input, calls
  `families.acceptInvite`. ~80 LoC.
- **`ChildDetailScreen.tsx`** — child header (avatar, name, weight),
  dose timeline from `doses.listDosesForChild`, "log dose" button to
  manually start a dose. ~180 LoC.
- **`TimelineScreen.tsx`** (tab) — cross-child dose timeline for the
  active family. ~120 LoC.

See `HOW-TO-FINISH.md` for the dispatch tickets to build these.

### Navigation (not yet built)
None of the React Navigation wiring exists yet:
- `src/navigation/types.ts` — typed route params
- `src/navigation/linking.ts` — universal links config mapping
  `https://cappy.closedose.com/t/{UID}` to the Scan screen with the
  UID pre-populated
- `src/navigation/RootNavigator.tsx` — switches Auth vs App stack on
  session state
- `src/navigation/AuthNavigator.tsx` — single screen, SignIn
- `src/navigation/AppNavigator.tsx` — bottom tabs (Home, Scan,
  Timeline, Settings) plus modal stack for DoseSheet, CreateFamily,
  etc.

See `HOW-TO-FINISH.md` ticket #1.

### App entry (not yet built)
- `App.tsx` — root component composing
  `<SafeAreaProvider><ThemeProvider><AuthProvider><RootNavigator /></AuthProvider></ThemeProvider></SafeAreaProvider>`,
  splash screen handling, font loading
- `index.js` — Expo entry registering `App` as the root component

See `HOW-TO-FINISH.md` ticket #2.

### Universal Links / closedose.com config (server-side)
- `apple-app-site-association` JSON file to host at
  `https://cappy.closedose.com/.well-known/apple-app-site-association`
- Cloudflare DNS for `cappy.closedose.com` pointing at a host that
  serves the AASA file (can be Cloudflare Pages, GitHub Pages, or a
  redirect to the marketing site)
- Once the app is signed via Apple Developer, fill in the Team ID and
  Bundle ID

See `HOW-TO-FINISH.md` ticket #3.

### Background tag delivery
The Universal Link wiring above gives you cold-launch from a tag tap.
The bit that still needs to be written in code is:
- `useEffect` in `App.tsx` (or the navigation linking config) that
  picks up the initial URL via `Linking.getInitialURL()`, parses out
  the tag UID, and pushes the Scan screen with `initialTagUid` set

The Scan screen is already wired to accept this prop. See ticket #4.

### Privacy Policy & Terms (consumer-app posture)
- `docs/legal/privacy-policy.md` (consumer-app version, not HIPAA NPP)
- `docs/legal/terms-of-service.md`
- `docs/legal/caregiver-consent.md` (in-app text)

The previous foundation kit had HIPAA-flavored drafts. These need to
be redrafted for consumer-app posture and reviewed by counsel before
publication.

See `HOW-TO-FINISH.md` ticket #5.

### Docs you'll want to add
- `README.md` at project root explaining how to run it
- `docs/posture.md` — codifying the Posture C decision
- `docs/audit-evolution.md` — when to migrate from triggers to
  explicit audit calls
- `docs/migration-to-real-backend.md` — when to leave Supabase

See `HOW-TO-FINISH.md` ticket #6.

### Font wiring
`src/theme/fonts.ts` is a stub. The Google Fonts packages are listed
in `package.json` but the imports in `loadCappyFonts` are commented
out. Wire them in once you've run `pnpm install`. See ticket #7.

### CI / GitHub Actions
None of the workflows in the previous foundation kit have been ported
yet. At minimum you want:
- `.github/workflows/ci.yml` — lint, typecheck, test on every PR
- `.github/workflows/eas-preview.yml` — EAS preview build on PR

See ticket #8.

### Asset optimization
`cappy-mark.png` (1.2 MB) and `cappy-icon.png` (280 KB) are larger
than necessary. Run them through ImageOptim or `pngquant` —
target <200 KB for the mark, <100 KB for the icon.

---

## Known issues to be aware of

1. **The Sheet component uses Reanimated.** Reanimated has a Babel
   plugin requirement (already in `babel.config.js`). If you see a
   "worklet" error on first run, clear Metro cache:
   `pnpm start --clear`.

2. **`expo-secure-store` has a 2048-byte value limit.** Supabase
   sessions usually fit. If you see a "value too long" error, the
   workaround is in
   https://supabase.com/docs/guides/auth/quickstarts/react-native —
   wrap the storage adapter with a chunking strategy.

3. **The `react-native-get-random-values` polyfill is imported in
   `src/api/doses.ts` only.** If you generate UUIDs elsewhere before
   that file is imported, you'll get an error. Safe pattern: import
   the polyfill at the top of `App.tsx`.

4. **HomeScreen has placeholder logic for dose status.** It uses a
   crude time-based heuristic instead of the real
   `compute_dose_status` RPC. The reason: families can have multiple
   medications, and the schema doesn't yet model "which medication is
   the default for this child" — that's a Phase 2 ticket.

5. **`DoseSheetScreen` has a stub for "Adjust amount"** that just
   shows an alert. Real implementation involves a Field for volume +
   conversion math to mg.

6. **Cross-family realtime not yet wired in screens.** The
   `realtime.subscribeFamilyDoses` helper exists; nothing calls it
   yet. HomeScreen should subscribe on mount when the active family
   loads. See ticket #9.

7. **No tests.** The previous foundation kit specified Vitest for the
   backend. For this RN app, Jest with `jest-expo` is in
   `devDependencies` but no tests are written. Worth adding at least
   a smoke test of `parseTagUrl` and the dose-status formatter
   before going to beta.

---

## What you can do today with this bundle

Even without the missing pieces, you can:

1. Push it to your GitHub repo (see `PUSH-TO-GITHUB.md`)
2. Open it in your editor and inspect every file
3. Run `pnpm install` (or `npm install`) without errors
4. See TypeScript errors only for the missing navigation imports —
   everything else typechecks

You cannot yet:
1. `expo start` and see a screen (no `App.tsx`)
2. Sign in (no `EXPO_PUBLIC_SUPABASE_URL` configured)
3. Scan a tag (no Supabase project, no programmed tags)

Filling in the missing pieces from `HOW-TO-FINISH.md` gets you to a
runnable app in roughly 1-2 days of focused work, or about a week of
agent-led tickets.
