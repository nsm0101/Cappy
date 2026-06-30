# Cappy! — Alpha Build Task List

**Owner:** Dr. Nick (founder, sole decision-maker)
**Generated:** 2026-06-29
**Goal:** Get the ClaudeBuildPlan React Native app to a functioning, device-testable alpha wired to the live `cappy-dev` Supabase backend.
**Decision locked:** **Posture C (consumer health app)** — the database will match the app code (plaintext `profiles` schema). Field-level encryption is deferred to a future Posture A upgrade.

> **This document is the shared backlog.** It is written to be handed to any coding agent (Claude Code, Cursor, Windsurf, Codex, a human dev, etc.). Each task is self-contained: it states what to do, where, the acceptance criteria, complexity, priority, and dependencies. Work the P0 items first and respect the `Depends on` field.

---

## How to read this list

**Priority (importance)** — how much it blocks the alpha:

| Tag | Meaning |
|-----|---------|
| **P0** | Hard blocker. The alpha cannot run or is unsafe without it. Do these first. |
| **P1** | Required for a usable alpha demo to a design partner. |
| **P2** | Needed before beta / external testers. Quality & correctness. |
| **P3** | Nice-to-have / polish. Can ship alpha without it. |

**Complexity (effort)** — rough agent time:

| Tag | Meaning |
|-----|---------|
| **S** | Small, < 1 hour. |
| **M** | Medium, 1–3 hours. |
| **L** | Large, half-day+. |
| **XL** | Multi-day or needs human/external steps (Apple, DNS, counsel). |

**Status** — `TODO` / `IN PROGRESS` / `BLOCKED` / `DONE`. Update in place as work proceeds.

---

## Key facts agents will need

| Item | Value |
|------|-------|
| Supabase project | `cappy-dev` (ref `hyfmcwswtjlnxtdspggr`), region us-east-1, ACTIVE_HEALTHY, Postgres 17 |
| Supabase URL | `https://hyfmcwswtjlnxtdspggr.supabase.co` |
| Publishable (anon) key | `sb_publishable_RLYYTH08Wp1_eePf9b5ezA_-eeDw1vp` — safe for the client, goes in `.env` |
| Apple Developer Team ID | `H2AGCK2WB8` |
| iOS bundle identifier | `com.closedose.cappy` |
| NFC tag URL host | `cappy.closedose.com` (path `/t/{TAG_UID}`) |
| App root | `ClaudeBuildPlan/` (Expo SDK 51, RN 0.74, TS strict) |

> The service-role key and the database password are **secrets** — never commit them, never paste them into chat or code. See **SEC-1**.

---

## Workstreams (for parallel distribution)

- **A. Backend / Supabase** — make the live DB match the app and deploy functions.
- **B. App shell** — the wiring that makes the app boot.
- **C. Screens** — the remaining UI.
- **D. Apple / iOS deploy** — signing, EAS, universal links.
- **E. Legal / compliance** — consumer-posture documents.
- **F. Quality** — tests, CI, realtime, performance.
- **S. Security** — secrets hygiene & hardening.

Workstreams A, B, and D can largely proceed in parallel by different agents. C depends on B. D's device test depends on A + B.

---

# P0 — Blockers (do first)

### SEC-1 · Rotate the exposed database password — **P0 · S · Security**
**Status:** TODO
The `cappy-dev` Postgres password was shared in plaintext during setup. Treat it as compromised.
- In the Supabase dashboard → Project Settings → Database → **Reset database password**.
- Update any local `.env`, CI secret, or password manager entry with the new value.
- Confirm the connection string is **not** committed anywhere in the repo (`git grep -i 'postgres:'`).
**Acceptance:** Old password no longer works; new password stored only in a secret manager / local `.env`. No DB credentials in git history going forward.
**Depends on:** none. Do this immediately.

---

### BE-1 · Reconcile the live DB to the Posture-C app schema — **P0 · L · Backend**
**Status:** DONE (2026-06-29) — public schema reset; 5 migrations tracked (reset, init, rls, triggers, rpc); `users`/`idempotency_keys` dropped, `profiles` present; RLS on all tables; meds seed intact; trigger functions hardened (search_path pinned, EXECUTE revoked). Note: `config.toml` project_id left as `cappy` (local-dev alias only; remote deploys go via `--project-ref hyfmcwswtjlnxtdspggr`).
The deployed `cappy-dev` schema is the **encrypted "server" foundation** (`users` table with `email_encrypted` JSONB, hash-chained `audit_events`, `idempotency_keys`). The app expects the **plaintext ClaudeBuildPlan** schema (`profiles`, plain `email`/`name`). They are incompatible.
Because the alpha is Posture C and `cappy-dev` holds **zero real rows** (only 4 seed medications), reset the project schema to the ClaudeBuildPlan migrations.
- Verify no real data exists (only `medications` has rows).
- Apply, in order, as tracked migrations:
  1. `supabase/migrations/20260101000000_init.sql` (profiles, families, children, dose_events, etc. + acetaminophen seed)
  2. `supabase/migrations/20260101000100_rls.sql`
  3. `supabase/migrations/20260101000200_triggers.sql`
  4. `supabase/migrations/20260101000300_rpc.sql`
- Drop the orphaned encrypted tables/objects that are not in the ClaudeBuildPlan schema (e.g. `idempotency_keys`, encrypted column variants) so the schema is clean.
- Reconcile `supabase/config.toml` `project_id` so the CLI links to `cappy-dev` (`hyfmcwswtjlnxtdspggr`).
**Acceptance:** `list_tables` shows exactly the ClaudeBuildPlan tables with `profiles` (not `users`); `list_migrations` shows the 4 migrations tracked; RLS enabled on every table; medication seed present.
**Depends on:** SEC-1 (rotate first). **Risk:** destructive — confirm zero real data before dropping anything.

---

### BE-2 · Generate TypeScript types from the live schema — **P0 · S · Backend**
**Status:** DONE (2026-06-29) — `src/api/database.types.ts` regenerated from the live schema. Full project `tsc --noEmit` passes.
After BE-1, regenerate `src/api/database.types.ts` from the real schema so the API layer typechecks against what's actually deployed.
- `supabase gen types typescript --project-id hyfmcwswtjlnxtdspggr > src/api/database.types.ts` (or `--local` against the migrations).
**Acceptance:** `pnpm typecheck` passes for `src/api/*` with no missing-table/column errors.
**Depends on:** BE-1.

---

### BE-3 · Deploy the Edge Functions to cappy-dev — **P0 · M · Backend**
**Status:** DONE (2026-06-29) — `nfc-resolve` (v1) and `accept-invite` (v1) deployed and ACTIVE with `verify_jwt: true`. `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the platform. Happy-path smoke test still pending real auth/data (covered by QA-1).
Deploy `nfc-resolve` and `accept-invite` to the live project; the app calls these for tag resolution and invite acceptance.
- `supabase functions deploy nfc-resolve accept-invite --project-ref hyfmcwswtjlnxtdspggr`.
- Set the functions' required env (service-role key, project URL) as **function secrets**, not in code.
- Smoke-test each: a known tag UID returns context; a valid invite code joins a family.
**Acceptance:** Both functions are listed/deployed and return 200 on a happy-path test; errors are typed JSON, not stack traces.
**Depends on:** BE-1, SEC-1.

---

### APP-1 · Create `App.tsx` + `index.js` entry — **P0 · S · App shell**
**Status:** DONE (2026-06-29) — `App.tsx` (polyfills, Google-font loading, provider stack, splash) and `index.js` created. Typecheck clean.
The app has **no entry point** and will not boot. Build both per `HOW-TO-FINISH.md` → TICKET-APP.
- `App.tsx`: polyfills, font loading (wires TICKET-FONTS automatically), `GestureHandlerRootView → SafeAreaProvider → ThemeProvider → AuthProvider → RootNavigator`, splash handling.
- `index.js`: `registerRootComponent(App)`.
**Acceptance:** `expo start` boots to a screen (the SignIn screen once NAV-1 lands) without a red-box error.
**Depends on:** NAV-1 (imports `RootNavigator`).

---

### NAV-1 · Build the navigation layer — **P0 · M · App shell**
**Status:** DONE (2026-06-29) — `linking.ts`, `AuthNavigator`, `AppNavigator` (bottom tabs via design-system `TabBar` + modal stack), `RootNavigator` (auth switch + NavigationContainer), and `navigation/index.ts` created (`types.ts` already existed). Deep link `t/:initialTagUid` → Scan. Typecheck clean.
None of the React Navigation wiring exists. Build per `HOW-TO-FINISH.md` → TICKET-NAV.
- `src/navigation/types.ts`, `linking.ts`, `RootNavigator.tsx`, `AuthNavigator.tsx`, `AppNavigator.tsx`.
- `linking.ts` must map `https://cappy.closedose.com/t/:tagUid` → `Scan` screen.
- `RootNavigator` switches Auth vs App stack on `useAuth().isSignedIn`.
**Acceptance:** Typechecks; signed-out users see SignIn, signed-in users see the bottom tabs; a `cappy://t/test` deep link routes to Scan.
**Depends on:** none (uses existing screens + AuthContext).

---

### ENV-1 · Wire client environment to cappy-dev — **P0 · S · App shell**
**Status:** DONE (2026-06-29) — gitignored `.env` created with live URL + publishable key, `EXPO_PUBLIC_USE_MOCK_DATA=false`. Confirmed `src/api/client.ts` reads these exact var names. Runtime sign-in still needs `pnpm install` on a dev machine (sandbox can't run Expo).
Create `.env` (gitignored) from `.env.example` with the live values so the Supabase client initializes.
- `EXPO_PUBLIC_SUPABASE_URL=https://hyfmcwswtjlnxtdspggr.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_RLYYTH08Wp1_eePf9b5ezA_-eeDw1vp`
- `EXPO_PUBLIC_TAG_URL_HOST=cappy.closedose.com`
- Set `EXPO_PUBLIC_USE_MOCK_DATA=false`.
- Confirm `src/api/client.ts` reads these and throws a clear error if missing.
**Acceptance:** App launches and reaches a real auth session against cappy-dev; no "credentials missing" error.
**Depends on:** none (but BE-1 needed before data calls succeed).

---

# P1 — Required for a usable alpha

### SCR-1 · Build the remaining screens — **P1 · L · Screens**
**Status:** DONE
Six screens referenced by navigation are missing. Build per `HOW-TO-FINISH.md` → TICKET-SCREENS, in order: `SettingsScreen`, `CreateFamilyScreen`, `AcceptInviteScreen`, `AddChildScreen`, `ChildDetailScreen`, `TimelineScreen`.
- Use design-system components only (no raw styled `View`s where a component exists).
- Each screen covers all 5 states: default / loading / empty / error / success.
- VoiceOver labels on every interactive element.
- `AddChildScreen` needs `@react-native-community/datetimepicker` added to `package.json`.
**Acceptance:** Every navigation target resolves to a real screen; create-family → add-child → log-dose flow is fully clickable.
**Depends on:** NAV-1, APP-1. Can be split across agents (one screen each).

### COLD-1 · Wire cold-launch from NFC tap — **P1 · S · App shell**
**Status:** DONE (2026-06-29) — routing already handled by NavigationContainer `linking` (`t/:initialTagUid` → Scan) + ScanScreen's existing auto-resolve effect. Added `src/navigation/useTagLinkObserver.ts` (non-navigating cold/warm-link diagnostic + extension point) and wired it into `App.tsx`. Typecheck clean. Real cold-launch verification happens on-device under QA-1.
Per TICKET-COLD-LAUNCH: in `App.tsx`, pick up `Linking.getInitialURL()` and the `url` event so a tag tap that cold-launches the app routes to Scan with the UID. The linking config (NAV-1) does most of this; verify end-to-end.
**Acceptance:** Tapping a programmed tag while the app is killed opens Cappy on the Scan/DoseSheet flow with the UID pre-filled.
**Depends on:** NAV-1, APP-1.

### APL-1 · Configure EAS + Apple signing — **P1 · M · iOS deploy**
**Status:** DONE — Development build `0102e2c0` completed successfully. Distribution cert + ad hoc provisioning profile configured. Device UDID `00008140-001475680E52801C` registered, Team `H2AGCK2WB8`.
Fill the real identifiers so `eas build` can sign for a device.
- In `app.json`: replace `REPLACE_WITH_YOUR_EXPO_USERNAME` (owner), the EAS `projectId`, and the `updates.url`.
- In `eas.json` `submit.production.ios`: set `appleTeamId` to **`H2AGCK2WB8`**, plus your Apple ID email and (later) the App Store Connect app id.
- `eas login`, `eas build:configure`, then `eas build --profile development --platform ios`.
**Acceptance:** A development build completes and installs on a registered iPhone.
**Depends on:** APP-1, NAV-1 (app must compile). External: Apple account (done — enrolled).

### UL-1 · Stand up Universal Links (AASA) — **P1 · L · iOS deploy**
**Status:** DONE
Per TICKET-UL. NFC cold-launch via HTTPS needs the Apple App Site Association file served at the tag host.
- Create `public/.well-known/apple-app-site-association` (no extension) with `"appIDs": ["H2AGCK2WB8.com.closedose.cappy"]` and component `/t/*`.
- DNS: point `cappy.closedose.com` at a host (Cloudflare Pages / GitHub Pages / redirect) that serves the AASA over HTTPS with `Content-Type: application/json` and no redirect.
- Validate with an AASA validator; on device, Safari → `https://cappy.closedose.com/t/test123` should offer to open Cappy.
**Acceptance:** AASA validates; a real device opens the app (not Safari) from the tag URL.
**Depends on:** APL-1 (Team ID), external DNS access. **XL risk** if DNS/hosting isn't already controlled.

### QA-1 · End-to-end alpha smoke test on device — **P1 · M · Quality**
**Status:** TODO
Run the 10-step "minimum viable test" in `HOW-TO-FINISH.md`: sign up → create family → add child → program an NTAG215 with `https://cappy.closedose.com/t/TESTTAG001` → register tag → tap → log dose → verify rows in `dose_events` and `audit_events`.
**Acceptance:** All 10 steps pass end-to-end on a physical iPhone. Record results in `BUILD-STATUS.md`.
**Depends on:** BE-1/2/3, APP-1, NAV-1, ENV-1, SCR-1, APL-1, UL-1.

---

# P2 — Before beta / external testers

### BE-4 · Auth method for alpha — **P1 · S · Backend/App**
**Status:** DONE (2026-06-29) — Pivoted to **email + password** for the alpha after email OTP hit an SMTP `535 Authentication credentials invalid` (custom SMTP creds wrong). `auth.ts` adds `signUpWithPassword`/`signInWithPassword`; `AuthContext` exposes them; `SignInScreen` rebuilt with email+password + sign-in/create-account toggle. Pure JS — works on the current build, no rebuild. Typecheck clean. **Founder dashboard step:** Authentication → Providers → Email → turn **OFF "Confirm email"** so sign-up returns a session immediately (no email send needed). OTP helpers remain in `auth.ts` (unused) if we revisit passwordless once SMTP is fixed. Next: **AUTH-APPLE** (Sign in with Apple) on the next native build.
The app uses magic-link / OTP auth. In the dashboard, set the Site URL and additional redirect URLs (`cappy://`, `https://cappy.closedose.com`), confirm the email template, and verify rate limits for alpha.
**Acceptance:** A magic link / OTP delivered to a test inbox signs the device in.
**Depends on:** ENV-1.

### RT-1 · Wire realtime to HomeScreen — **P2 · M · Quality**
**Status:** TODO
Per TICKET-REALTIME: `HomeScreen` subscribes via `realtime.subscribeFamilyDoses` once the active family + children load, refetching the affected child on a new dose, cleaning up on unmount/family change.
**Acceptance:** A dose logged on device B updates device A's Home within seconds.
**Depends on:** SCR-1, BE-1.

### TEST-1 · Smoke tests for critical helpers — **P2 · M · Quality**
**Status:** TODO
Per TICKET-TESTS: Jest tests for `parseTagUrl` (happy/invalid/wrong-host/malformed), `format.ts` (dose amounts, relative time edges), `uuid.ts` (valid v4).
**Acceptance:** `pnpm test` runs and passes; CI fails on a broken helper.
**Depends on:** none.

### CI-1 · GitHub Actions CI — **P2 · S · Quality**
**Status:** TODO
Per TICKET-CI: `.github/workflows/ci.yml` running typecheck + lint + test on push/PR (pnpm + Node 20).
**Acceptance:** CI is green on a clean branch and red when a check fails.
**Depends on:** TEST-1 (so `pnpm test` exists).

### LEG-1 · Draft consumer-posture legal docs — **P2 · L · Legal**
**Status:** TODO
Per TICKET-LEGAL: `docs/legal/privacy-policy.md`, `terms-of-service.md`, `caregiver-consent.md`, each carrying the **"DRAFT — must be reviewed by counsel before publication"** banner. Consumer-app (not HIPAA NPP) framing; include COPPA notice and the bold non-medical-advice disclaimer.
- App must record `profiles.consent_accepted_at` + `consent_version` when the user accepts.
**Acceptance:** Three drafts exist with banners; in-app consent capture is specced for SCR-1.
**Depends on:** none. **External:** counsel review before any publication.

### DOC-1 · Project documentation — **P2 · M · Backend/Docs**
**Status:** TODO
Per TICKET-DOCS: root `README.md` run instructions, `docs/posture.md` (codify the Posture C decision + upgrade path to A), `docs/audit-evolution.md`, `docs/migration-to-real-backend.md`.
**Acceptance:** A new agent/dev can clone and run from the README alone.
**Depends on:** BE-1 (so instructions match reality).

---

# P3 — Polish / nice-to-have

### PERF-1 · Optimize image assets — **P3 · S · Quality**
**Status:** TODO
Per TICKET-OPTIMIZE: run `cappy-mark.png` (1.2 MB) and `cappy-icon.png` (280 KB) through `pngquant`. Target mark < 200 KB, icon < 100 KB.
**Acceptance:** Assets shrunk below targets with no visible quality loss.

### SEC-2 · Run Supabase security advisors — **P3 · S · Security**
**Status:** TODO
After BE-1, run the Supabase advisors (security + performance) and resolve any RLS gaps, missing indexes, or exposed views before external testers.
**Acceptance:** No high-severity advisor findings open.
**Depends on:** BE-1.

### FEAT-1 · Real "Adjust amount" in DoseSheet — **P3 · M · Screens**
**Status:** TODO
Replace the stubbed alert with a real volume → mg conversion field (per BUILD-STATUS known issue #5).
**Acceptance:** A caregiver can adjust volume and the logged `amount_mg` reflects the conversion.

### FEAT-2 · Default medication per child — **P3 · M · Backend/Screens**
**Status:** TODO
HomeScreen currently uses a crude time heuristic for dose status because the schema doesn't model a child's default medication (BUILD-STATUS known issue #4). Add the model + use the real `compute_dose_status` RPC.
**Acceptance:** Home dose pills come from the RPC, not the heuristic.

---

## Suggested execution order (critical path to alpha)

1. **SEC-1** (rotate password) →
2. **BE-1 → BE-2 → BE-3** (backend live) in parallel with **NAV-1 → APP-1 → ENV-1** (app boots) →
3. **SCR-1** + **COLD-1** (full UI) →
4. **APL-1 → UL-1** (device install + links) →
5. **QA-1** (prove it end-to-end) →
6. P2 hardening (BE-4, RT-1, TEST-1, CI-1, LEG-1, DOC-1) → P3 polish.

## Distribution notes for multi-agent work

- **Backend agent** owns workstream **A + S** (SEC-1, BE-1..4, SEC-2). Has Supabase MCP access.
- **App-shell agent** owns **B** (APP-1, NAV-1, ENV-1, COLD-1).
- **Screens agent(s)** own **C** (SCR-1 split per screen, FEAT-1/2). Start after NAV-1 lands.
- **iOS/release agent** owns **D** (APL-1, UL-1) — needs Apple + DNS credentials, so partly human-in-the-loop.
- **QA agent** owns **F** (TEST-1, CI-1, RT-1, QA-1).
- **Founder / counsel** own **E** (LEG-1 review) and any credential/DNS steps agents can't self-serve.

> When an agent finishes a task, it updates the **Status** line here and notes anything that changed the plan, so the next agent inherits an accurate board.
