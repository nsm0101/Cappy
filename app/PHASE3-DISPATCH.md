# Phase 3 — Dispatch Tickets for Junior Coding Agents

**Generated:** 2026-07-02 · Companion to `PHASE3-PLAN.md`
**Audience:** Any coding agent (Claude Haiku/Sonnet, Cursor, Codex, human junior dev). Each ticket is self-contained — follow it verbatim. Where exact values are given, they are **normative**: do not "improve" them.

**Division of labor:** Tickets here are mechanical and well-bounded. The safety-critical work — SAFE-1 (24h cap), SAFE-2 (interval unification), SAFE-3 (log-time re-check), FLOW-1 (manual dosing), FLOW-2 (notifications) — is **reserved for the senior/reviewing agent** and is NOT in this file. Do not attempt it.

---

## Global rules (read before every ticket)

1. **Work only inside `app/`** — except ticket D7, which touches the repo-root `.github/`.
2. **NEVER modify these paths.** They are reserved or sensitive:
   - `src/lib/dosing.ts` (safety-critical dose math)
   - `supabase/migrations/**` and `supabase/functions/**`
   - `.env`, `src/api/client.ts`, `app.json`, `eas.json`
3. **No new runtime dependencies.** devDependencies only where a ticket explicitly says so.
4. **Design system only.** Use existing components (`Button`, `Card`, `Field`, `Sheet`, `Segmented`, `RowItem`, `DosePill`, …) and theme tokens (`useTheme()` → `theme.tokens`, `theme.spacing`, `theme.fontSize`, `theme.fonts`). **Never hardcode hex colors** (exception: `#FFFFFF` where existing code already does).
5. **Accessibility:** every new interactive element gets `accessibilityRole` and `accessibilityLabel`.
6. **Minimal diffs.** Do not reformat, reorder imports, or rename anything outside the ticket scope.
7. **Verification (all must pass before a ticket is DONE):**
   ```bash
   cd app
   npx tsc --noEmit
   npx eslint src --ext .ts,.tsx
   npm test          # once D6 lands
   ```
8. **Git:** one ticket = one branch `phase3/<ticket-id>` off `main`. Commit as `D<N>: <summary>`. Do not push to `main` directly.
9. **Report template** (append to the ticket's Status line in this file):
   - Files changed (list)
   - Output of the verification commands (pass/fail)
   - Any deviation from the spec + why
   - Open questions for the reviewer
   Never mark DONE with a failing check — mark BLOCKED and describe.

---

## D1 · Add an `unknown` dose status — never fail open to "Due now" — **(SAFE-4) · S**
**Status:** DONE (2026-07-02) — executed by delegated junior agent; reviewed, refined & verified by senior agent.

**Context:** `HomeScreen` currently catches RPC/network errors and defaults a child's status to `'due'` — a dead network renders the most permissive answer in a medication app. Add a neutral `unknown` status for error paths. (The equivalent fix in `supabase/functions/nfc-resolve` is reserved — do not touch it.)

**Files:** `src/api/doses.ts`, `src/components/DosePill.tsx`, `src/screens/HomeScreen.tsx`

**Steps:**
1. `src/api/doses.ts` line 6 — extend the union:
   ```ts
   export type DoseStatus = 'due' | 'early' | 'recent' | 'overdue' | 'unknown';
   ```
   (`DosePill.tsx` also declares its own `DoseStatus` on line 5 — extend both; they must stay identical.)
2. `src/components/DosePill.tsx` — in `statusColor`, add a `case 'unknown'` using **existing neutral tokens** (do not add new tokens):
   - `solid` → `t.fgMuted` · `fg` → `t.fg2` · `bg` → `t.bgInset` · `ring` → `t.border`
3. `src/screens/HomeScreen.tsx`:
   - Replace the nested ternary in the `DosePill` `label` prop with a top-level constant:
     ```ts
     const STATUS_LABEL: Record<DoseStatus, string> = {
       due: 'Due now',
       early: 'Too early',
       recent: 'Given recently',
       overdue: 'Overdue',
       unknown: 'Status unavailable',
     };
     ```
   - In `loadChildren`, change **error paths only** to `'unknown'`:
     - the inner `catch` around `getDoseStatus` (currently `status = 'due'`)
     - the outer per-child `catch` (currently `{ ...child, status: 'due', ... }`)
   - **Do NOT change** the no-prior-dose default (`let status: DoseStatus = 'due'` when `last` is undefined) — a child with no doses is legitimately due-eligible, not an error.

**Acceptance:** `tsc` + `eslint` pass. Code inspection: no `catch` path in HomeScreen can yield `'due'`. Pill renders gray/neutral for `unknown`.

---

## D2 · Home greeting uses the caregiver's display name — **(UX-2) · S**
**Status:** DONE (2026-07-02) — executed by delegated junior agent; reviewed, refined & verified by senior agent.

**Context:** The greeting shows the raw email prefix (`user.email.split('@')[0]`) even though `profiles.display_name` is captured at sign-up and editable in Settings.

**Files:** `src/screens/HomeScreen.tsx`

**Steps:**
1. Import `profiles as profilesApi` from `@/api` (already exported — see `SettingsScreen.tsx` line 17 for the pattern).
2. Add state `const [displayName, setDisplayName] = useState<string | null>(null);` and load it once:
   ```ts
   useEffect(() => {
     void profilesApi.getMyDisplayName().then(setDisplayName).catch(() => undefined);
   }, []);
   ```
3. Greeting logic: prefer `displayName`, fall back to email prefix, fall back to plain "Welcome back.":
   ```ts
   const who = displayName ?? user?.email?.split('@')[0] ?? null;
   // …  Welcome back{who ? `, ${who}` : ''}.
   ```

**Acceptance:** `tsc` + `eslint` pass; a user with display name "Nick" sees "Welcome back, Nick."

---

## D3 · ActiveFamilyContext + family switcher — **(FLOW-3) · M**
**Status:** DONE (2026-07-02) — executed by delegated junior agent; reviewed, refined & verified by senior agent.

**Context:** `HomeScreen`, `TimelineScreen`, and `SettingsScreen` each independently call `listMyFamilies()` and hardcode `fams[0]`. A user in two families can never reach the second. Centralize the active family in a context with AsyncStorage persistence, and add a switcher on Home.

**Files:** new `src/family/ActiveFamilyContext.tsx`, `App.tsx` (provider insertion only), `src/screens/HomeScreen.tsx`, `src/screens/TimelineScreen.tsx`, `src/screens/SettingsScreen.tsx`

**Steps:**
1. Create `src/family/ActiveFamilyContext.tsx`:
   - State: `families: FamilyWithRole[]`, `activeFamily: FamilyWithRole | null`, `loading: boolean`.
   - On mount: `familiesApi.listMyFamilies()`; read AsyncStorage key `cappy.activeFamilyId` (`@react-native-async-storage/async-storage` is already a dependency — see `ThemeProvider` for the usage pattern).
   - Resolution rule: stored id if it exists **and** is in the fetched list; otherwise `fams[0] ?? null`.
   - Expose `setActiveFamily(f: FamilyWithRole)` (also persists the id) and `refreshFamilies(): Promise<void>`.
   - Export a `useActiveFamily()` hook that throws if used outside the provider.
2. `App.tsx`: wrap the existing tree with `<ActiveFamilyProvider>` **inside** `AuthProvider` (it needs an authed client). Change nothing else in App.tsx.
3. `HomeScreen`: delete the local `families`/`activeFamily` state and `loadFamilies`; consume the hook. Keep `loadChildren` keyed on `activeFamily.id`. Pull-to-refresh calls `refreshFamilies()` then `loadChildren`.
4. Switcher UI on Home: when `families.length > 1`, make the family-name heading a `Pressable` (accessibilityRole `button`, label "Switch family") with a chevron-down `Ionicons` next to it; it opens a `Sheet` (existing component) listing each family as a `RowItem` — title = family name, subtitle = role via the existing role labels, right slot = `Ionicons name="checkmark"` for the active one. Selecting calls `setActiveFamily` and closes the sheet.
5. `TimelineScreen` and `SettingsScreen`: replace their local `fams[0]` logic with the hook. In Settings keep `loadFamily`'s caregiver/brand fetches, just source the family from context (re-run when `activeFamily?.id` changes).

**Acceptance:** `tsc` + `eslint` pass. With 2+ families: switching updates Home children, Timeline entries, and Settings caregiver list; the choice survives an app relaunch; a stored id for a family the user left falls back to the first family without crashing. With 1 family: heading is not pressable, no chevron shown.

---

## D4 · `InputSheet` component; retire `Alert.prompt` — **(UX-1) · M**
**Status:** DONE (2026-07-02) — executed by delegated junior agent; reviewed, refined & verified by senior agent.

**Context:** Weight update (`ChildDetailScreen.handleUpdateWeight`) and name edit (`SettingsScreen.handleEditName`) use `Alert.prompt` — unvalidated, off-brand, and iOS-only (blocks the Android plan). A mistyped weight silently produces a wrong dose, so weight entry gets validation + unit toggle.

**Files:** new `src/components/InputSheet.tsx`, `src/components/index.ts`, `src/screens/ChildDetailScreen.tsx`, `src/screens/SettingsScreen.tsx`

**Steps:**
1. Build `InputSheet` on the existing `Sheet` + `Field` + `Button` components:
   ```ts
   type InputSheetProps = {
     visible: boolean;
     title: string;
     hint?: string;
     initialValue?: string;
     placeholder?: string;
     keyboardType?: KeyboardTypeOptions;
     /** Return an error string to block submit, or null if valid. */
     validate?: (value: string) => string | null;
     submitLabel?: string;           // default 'Save'
     onSubmit: (value: string) => void | Promise<void>;
     onClose: () => void;
     /** Optional unit segmented control rendered above the field. */
     segments?: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void };
   };
   ```
   Behavior: `Field` shows the `validate` error via its existing error variant, live after first submit attempt; primary Button disabled while a passed-in async `onSubmit` is pending. Export from `src/components/index.ts`.
2. `ChildDetailScreen` — replace `handleUpdateWeight`'s `Alert.prompt` with an `InputSheet`:
   - `segments`: lb / kg (use the existing `Segmented` component), **default lb**, converting the displayed initial value when toggled (`kgFromLbs`/`lbsFromKg` already imported in this file).
   - `validate` (normative ranges — hard block outside): lb mode `4–330`; kg mode `2–150`. Non-numeric or `<= 0` → "Enter a number in {unit}." Out of range → "That doesn't look right — check the unit."
   - On submit: convert to grams (`Math.round(kgFromLbs(lb) * 1000)` or `Math.round(kg * 1000)`), call `childrenApi.recordWeight`, then `loadData()`. Keep the existing error `Alert.alert` on API failure.
3. `SettingsScreen` — replace `handleEditName`'s `Alert.prompt` with an `InputSheet` (`validate`: trimmed non-empty, max 60 chars). Keep the explanatory hint text.
4. Confirm zero remaining uses: `grep -rn "Alert.prompt" src/` must return nothing.

**Acceptance:** `tsc` + `eslint` pass; grep is clean; weight of "700" lb is blocked; kg/lb toggle round-trips correctly (22 lb ↔ ~10 kg); both sheets respect dark mode (tokens only).

---

## D5 · Timeline: day grouping + realtime + active family — **(UX-3) · M**
**Status:** DONE (2026-07-02) — executed by delegated junior agent; reviewed, refined & verified by senior agent.

**Context:** Timeline is a flat, static list of the first family's doses. Make it live, day-grouped, and family-aware.

**Files:** `src/screens/TimelineScreen.tsx`

**Steps:**
1. Consume `useActiveFamily()` (D3); drop the local `listMyFamilies` call. Reload when `activeFamily?.id` changes.
2. Day grouping: group `doses` by local calendar day of `given_at`. Section headers: `Today`, `Yesterday`, else a formatted date (check `src/lib/time.ts` for an existing day formatter before writing one; if none exists add `formatDayHeading(iso: string): string` **to `src/lib/time.ts`** with unit-testable pure logic). Render headers in `fg3`, `fontSize.xs`, uppercase, `letterSpacing: 1` — same style as the "Who's getting a dose?" label in `DoseSheetScreen`.
3. Realtime: mirror the `HomeScreen` RT-1 pattern exactly (see its `useEffect` with `realtimeApi.subscribeFamilyDoses`). Timeline needs child ids: fetch via `childrenApi.listChildrenInFamily(activeFamily.id)` once per family change. Dispose on unmount/family change.
4. Keep the existing empty/error states; empty state should reference the active family's name.

**Acceptance:** `tsc` + `eslint` pass. A dose logged on another device appears within seconds without pull-to-refresh; doses render under correct Today/Yesterday/date headers; switching family (D3) swaps the list.

---

## D6 · Jest tests: dosing engine golden cases + tag URL parsing — **(QUAL-1) · M**
**Status:** DONE (2026-07-02) — executed by delegated junior agent; reviewed, refined & verified by senior agent.

**Context:** `src/lib/dosing.ts` is safety-critical and untested. The expected values below were computed independently by the reviewing agent and are **normative**. ⚠️ **If a test fails, do NOT modify `src/lib/dosing.ts` or "fix" the expected value — mark the ticket BLOCKED and report the mismatch. A failing golden test is a finding, not a test bug.**

**Files:** `package.json` (jest config + devDeps only), new `src/lib/__tests__/dosing.test.ts`, new `src/nfc/__tests__/parseTagUrl.test.ts`

**Steps:**
1. Configure jest in `package.json` (preset already installed):
   ```json
   "jest": {
     "preset": "jest-expo",
     "transformIgnorePatterns": [
       "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))"
     ]
   }
   ```
   Set the test script to `"test": "TZ=UTC jest"` (deterministic date math).
2. `src/lib/__tests__/dosing.test.ts` — cover `computeDosing`, `resolveAgeGate`, `ageMonthsFromDob`, `doseForMedication`, `kgFromLbs`/`lbsFromKg` round-trip. **Golden table (normative):**

   | weightKg | ageMonths | gate | acet mg (recommended / display / capped / interval) | acet mL (160/5) | ibu mg (/ capped) | ibu mL 100/5 · 50/1.25 |
   |---|---|---|---|---|---|---|
   | 5 | 3 | infant | 62.5 / 63 / false / 4h | 2.0 | **null** + `ibuprofenSuppressedReason` set | — |
   | 10 | 18 | pediatric | 150 / 150 / false / 6h | 4.7 | 100 / false | 5 · 2.5 |
   | 40 | 120 | pediatric | **480 / 480 / true** / 6h (calc 600, cap 480) | 15 | **400 / false** (calc == cap → NOT capped; strict `>`) | 20 · 10 |
   | 70 | 168 | adolescent | **1000 / 1000 / true** / 6h | 31.3 | **600 / true** (calc 700, cap 600) | 30 · 15 |
   | 4 | 1 | emergency | `emergency: true`, both meds `null` | — | — | — |
   | 0 (and NaN) | 18 | — | both meds `null`, `spacingReminder === ''` | — | — | — |

   Additional assertions:
   - 40 kg pediatric `spacingReminder` contains `"480 mg"` and `"400 mg"` (both-caps message; acet capped triggers it).
   - 10 kg pediatric `spacingReminder` is the generic "Allow at least 6 hours" message.
   - `resolveAgeGate`: `0→emergency, 1→emergency, 2→infant, 5→infant, 6→pediatric, 143→pediatric, 144→adolescent`.
   - `ageMonthsFromDob` with explicit `now` (2nd arg): dob `'2024-01-15'`, now `new Date('2026-07-02T12:00:00Z')` → **29**; dob `'2024-07-02'`, same now → **24**; invalid dob `'not-a-date'` → **0**; future dob `'2027-01-01'` → **0**.
3. `src/nfc/__tests__/parseTagUrl.test.ts` — `nfcService.ts` imports `react-native-nfc-manager` at module top, so mock it first:
   ```ts
   jest.mock('react-native-nfc-manager', () => ({
     __esModule: true,
     default: { isSupported: jest.fn(), start: jest.fn(), cancelTechnologyRequest: jest.fn() },
     NfcTech: { Ndef: 'Ndef' },
     Ndef: { uri: { decodePayload: jest.fn() } },
   }));
   ```
   Cases (host default is `cappy.closedose.com`):
   - `https://cappy.closedose.com/t/04A1B2C3` → ok, uid `04A1B2C3`
   - `https://cappy.closedose.com/t/ibuprofen-child` → ok (hyphen slugs are valid — this was a live bug once)
   - trailing null bytes / whitespace: `'https://cappy.closedose.com/t/abc123\0\0'` → ok, `abc123`
   - query/fragment stripped: `/t/abc123?x=1` → `abc123`
   - wrong host `https://evil.com/t/abc123` → `ok: false`, kind `invalid_url`
   - `http://` (non-https) → invalid · empty string → invalid · uid shorter than 4 (`/t/abc`) → invalid · uid longer than 32 → invalid · uid with illegal chars (`/t/ab$c1`) → invalid
4. Run `npm test` — all green (subject to the ⚠️ rule above).

**Acceptance:** `npm test` passes; deliberately changing a cap in a scratch copy breaks the corresponding test; no modifications to `src/lib/dosing.ts` or `src/nfc/nfcService.ts`.

---

## D7 · CI for the app; retire stale root workflows — **(QUAL-2) · S**
**Status:** DONE (2026-07-02) — executed by delegated junior agent; reviewed, refined & verified by senior agent.

**Context:** Repo-root `.github/workflows/` contains foundation-kit leftovers: `ci.yml` targets a `server/` directory that no longer exists (pnpm, Postgres service), plus `deploy-prod.yml`/`deploy-staging.yml` for the same dead stack. They are misleading noise on every push.

**Files:** repo-root `.github/workflows/ci.yml` (replace), delete `deploy-prod.yml` and `deploy-staging.yml`.

**Steps:**
1. Delete `deploy-prod.yml` and `deploy-staging.yml` (git history preserves them). Note the deletion in your report for reviewer sign-off.
2. Replace `ci.yml` with:
   ```yaml
   name: CI
   on:
     pull_request:
       branches: [main]
     push:
       branches: [main]
   concurrency:
     group: ci-${{ github.ref }}
     cancel-in-progress: true
   jobs:
     app:
       name: App (typecheck, lint, test)
       runs-on: ubuntu-latest
       defaults:
         run:
           working-directory: app
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: npm
             cache-dependency-path: app/package-lock.json
         - run: npm ci
         - run: npx tsc --noEmit
         - run: npx eslint src --ext .ts,.tsx
         - run: npm test -- --ci
   ```
3. Verify locally that each command passes from a clean `npm ci` before pushing.

**Acceptance:** CI green on the branch; a deliberately broken type on a scratch commit turns it red; no workflow references `server/` anymore.

---

## Execution order

- **Wave 1 (parallel, independent):** D1 · D2 · D4 · D6
- **Wave 2:** D3 → D5 · D7 (after D6)

Reviewer (senior agent) will: audit each diff against the ticket, run the checks, exercise dark mode + accessibility on changed screens, and merge. Anything ambiguous → stop and ask; do not improvise beyond the spec.

---

## D8 · Dose-logged success moment — **(UX) · M**
**Status:** TODO · JS-only (works on reload, no rebuild)

**Context:** Logging a dose instantly `goBack()`s with only a haptic. Show a brief confirmation that closes the loop and hosts the future reminder opt-in (FLOW-2).

**Files:** `src/screens/DoseSheetScreen.tsx`, new `src/components/SuccessOverlay.tsx` (+ export in `components/index.ts`)

**Steps:**
1. `SuccessOverlay`: full-screen semi-transparent view (theme tokens only) with a checkmark `Ionicons`, title "Dose logged", and a subtitle line passed as a prop. Auto-dismiss after 2.5 s via `onDone` callback; also dismiss on tap (accessibilityRole `button`, label "Dismiss"). Respect Reduce Motion (no entrance animation if enabled — see `NfcTarget` for the pattern).
2. In `doLog` success path (both child and caregiver): instead of immediate `goBack()`, fetch the fresh `next_safe_at` you already have from the SAFE-3 re-check (or call `dosesApi.getDoseStatus` once for the override path), then show the overlay with subtitle `Next dose safe at {formatClockTime(next_safe_at)}` (omit the line if null). `goBack()` in `onDone`.
3. Add a disabled placeholder row under the subtitle: "Remind me when it's safe — coming with the next app update" (fg3, xs). FLOW-2 replaces this with a real toggle; keep the layout slot.
4. Keep the success haptic. Do not touch the safety logic above the insert.

**Acceptance:** tsc + eslint + jest pass; logging shows the overlay with the correct next-safe time, dismisses to the previous screen; VoiceOver reads it.

---

## D9 · First-run onboarding path — **(UX) · L**
**Status:** TODO · JS-only

**Context:** New users land on an empty Home with no guidance. Guide the first two minutes: create family → add child (with weight) → program/register a tag → try a scan.

**Files:** `src/screens/HomeScreen.tsx`, optionally new `src/components/OnboardingSteps.tsx`

**Steps:**
1. Derive onboarding state on Home from existing data — no new storage: `hasFamily` (families.length>0), `hasChild` (childrenList.length>0), `hasWeight` (any child weightGrams != null), `hasDose` (any child lastDoseAt != null).
2. When signed in and any of those is false, render a checklist Card at the top of Home ("Get set up" heading): four rows with checkmark/circle `Ionicons`, each incomplete row tappable → navigates to the right action (CreateFamily / AddChild / ChildDetail weight sheet / ScanTab). Completed rows get fgMuted strikethrough-free checked style.
3. Hide the card entirely once all four are true. No celebration screen (keep it quiet).
4. Copy (normative): "Create your family" / "Add your first child" / "Record a current weight — dosing depends on it" / "Log a first dose (tap a Cappy tag or use Log a dose)".
5. All rows accessible; design-system components only; minimal diff to HomeScreen (extract the card into `OnboardingSteps.tsx` taking the four booleans + nav callbacks as props).

**Acceptance:** tsc + eslint + jest pass; fresh account sees the checklist and each tap lands on the right screen; fully set-up account sees no checklist.

---

## D10 · Caregiver profile card + avatar upload — **(UX) · M**
**Status:** TODO · Mostly JS; needs one storage-RLS migration (SENIOR applies it — junior writes client only)

**Context:** Children get photo upload on ChildDetail; caregivers have no profile surface and no avatar, so dose attribution ("logged by") is text-only. Give every caregiver a durable profile.

**Steps:**
1. SENIOR (not junior): storage RLS policy allowing a user to write `avatars/profiles/{auth.uid()}.jpg` and family members to read it; `profiles.avatar_url` column already exists.
2. `src/api/avatars.ts`: add `uploadMyAvatar(base64)` mirroring `uploadChildAvatar` (path above, upsert, update `profiles.avatar_url`).
3. Settings: add a profile Card at top — `MemberAvatar` (camera badge overlay exactly like ChildDetail's `handleChangePhoto` pattern) + display name + email. Tap avatar → `pickAndCropSquareImage` → `uploadMyAvatar`.
4. Show caregiver avatars where attribution appears: Timeline "logged by" row and DoseSheet recipient picker already use `MemberAvatar` — verify they render `profiles.avatar_url` once it exists; fix any spot passing only initials.
5. Regression-check child photo upload on the new build (it shipped Phase 2 but predates today's refactors): ChildDetail → change photo → verify signed-URL render after reload.

**Acceptance:** tsc/eslint/jest pass; caregiver sets a photo in Settings; their avatar appears on doses they log; child upload still works.

---

## D12 · "Schedule" screen — dosing clock + 24h timeline — **(UX) · L**
**Status:** TODO · JS-only (`react-native-svg` 15.2.0 already installed)

**Context:** Visual answer to "when can I give the next dose?". Reference image (from founder): a 12-hour analog face where each hour position carries a stacked dual label — AM hour (e.g. `09:00`, blue) above PM hour (e.g. `21:00`, dark) — with the AM half of the field white and the PM half shaded. We adapt that design to show dose windows.

**Steps:**
1. New tab `Schedule` between Timeline and Settings (`AppNavigator` TAB_ICONS: `calendar-outline`/`calendar`); new `src/screens/ScheduleScreen.tsx`.
2. Controls (top): child picker (avatar row, same pattern as DoseSheet recipient picker, from `useActiveFamily` → `listChildrenInFamily`); med toggle `Segmented`: Tylenol / Motrin / Both (labels via `brandFor(generic, familyBrandPref).name`; values `acetaminophen` / `ibuprofen` / `both`); view toggle `Segmented`: Clock / Timeline.
3. Data per child+generic: last dose + `next_safe_at` from `dosesApi.getDoseStatus(childId, medicationId)` (resolve each generic's medication id from `nfcApi.listMedications()` — use the family's preferred brand row per generic, else the first row of that generic) + doses in last 24h from `dosesApi.listDosesForChild`.
4. **Clock view** (SVG, ~340px square): 12-hour face per the reference image — outer ring, tick marks, stacked dual hour labels (AM `HH:00` in `palette.blue[500]`-style over PM `HH:00` in `t.fg1`; use theme tokens), AM/PM halves subtly shaded (`t.bgInset` on the PM half). Overlays:
   - Dose markers: small filled dot at each logged dose's clock position (last 24h), colored by med accent (`brandFor(...).accent` — Tylenol red / Motrin blue), inner radius for AM doses, outer radius for PM doses.
   - Safe-from arc: from `next_safe_at` clockwise to the last dose's position, rendered as a thin accent-colored arc; the hour numerals falling inside the *allowed* window get the accent color + semibold, numerals in the too-early window stay muted (`t.fgMuted`). "Both" mode renders two arcs at slightly different radii.
   - Center caption: `Next {Tylenol|Motrin} dose safe at {formatClockTime(next_safe_at)}` (or "OK to give now" / "No prior dose"); "Both" shows both lines.
5. **Timeline view**: horizontal 24h bar (now-centered ±12h or midnight-to-midnight — pick midnight-to-midnight), hour gridlines every 2h with `HH` labels; logged doses as accent-colored dots with time labels; shaded accent-tinted region from each last dose to its `next_safe_at` ("too early" zone), open/clear after. One lane per med in Both mode, lane label = brand name.
6. Both views: `DoseSafetyText` disclaimer at bottom; statuses `unknown`/`max_reached` render a plain message card instead of arcs (never imply "safe"). Realtime: subscribe like Home so a new dose redraws.
7. All controls accessible; tokens only; typecheck/lint/test clean.

**Acceptance:** Schedule tab renders both views for a child with dose history; toggling meds/views works; numerals/arc match `next_safe_at` from the RPC (spot-check against the DoseSheet banner); empty/no-dose states are sensible.

---

## D13 · Import weight from Apple Health — **(feature) · M · NATIVE (next EAS build)**
**Status:** TODO · Blocked on a native module — batch with the next build

**Context:** Reduce weight-entry friction: offer "Import from Apple Health" in the weight InputSheet.

**Steps:**
1. SENIOR decision executed as spec'd: use `@kingstinct/react-native-healthkit`; `npx expo install` it; add HealthKit entitlement + `NSHealthShareUsageDescription` ("Cappy reads weight to keep dosing accurate.") via its config plugin in `app.json`; rebuild required.
2. `src/lib/health.ts`: `getLatestBodyMassKg(): Promise<{ kg: number; recordedAt: string } | null>` — request read-only `bodyMass` permission lazily, return most recent sample; null on denial/none (never throw to UI).
3. Weight InputSheet (ChildDetail): add a ghost "Import from Apple Health" button; on success prefill the field (converted to the active unit) + show sampled date as hint; user still reviews + taps Save (imports NEVER auto-save).
4. Provenance caveat in the hint: Health data on this phone is usually the *phone owner's* weight — the caregiver must confirm it is the child's before saving. Same range validation applies.
5. Graceful no-op on simulator/denied permission (button shows "Health data unavailable").

**Acceptance:** on a device with a bodyMass sample: import prefills, save works; denial path silent; child-safety caveat visible before save.
