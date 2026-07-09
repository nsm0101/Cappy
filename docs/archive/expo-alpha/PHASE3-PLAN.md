# Cappy! — Phase 3 Plan: Safety Correctness + Core Flows + Polish

**Generated:** 2026-07-02 (repo review by Claude)
**Baseline:** Alpha verified end-to-end on device (QA-1, 2026-06-30). App boots, NFC cold-launch works, doses sync via realtime.
**Format:** Same board conventions as `ALPHA-TASKS.md` (P0–P3 priority, S/M/L/XL complexity, self-contained tickets).

This review found the alpha functionally solid but with **three safety-logic gaps that outrank all polish work**, one missing core flow (manual dose logging), and a set of high-leverage UX upgrades. Recommended order: SAFE-* → FLOW-1 → FLOW-2 → UX batch → QUAL batch.

> **Delegation:** The mechanical tickets (SAFE-4, FLOW-3, UX-1, UX-2, UX-3, QUAL-1, QUAL-2) are specced as verbatim-executable dispatch tickets for junior agents in **`PHASE3-DISPATCH.md`** (D1–D7). SAFE-1/2/3, FLOW-1, and FLOW-2 stay with the senior agent.

---

# P0 — Dose-safety correctness

These matter more than any UI work: the app's core promise is "trust the pill on the screen."

### SAFE-1 · Enforce the 24-hour maximum-dose cap — **P0 · M · Backend + DoseSheet**
**Status:** DONE (2026-07-02) — RPC enforces max_doses_per_24h (new `max_reached` status); DoseSheet blocks with override + shows "N of M doses in 24h". Migration `20260702013000` applied to cappy-dev.
`medications.max_doses_per_24h` exists (5 for acetaminophen) and `compute_dose_status` *counts* `doses_in_last_24h` — but nothing ever **enforces** it. The RPC's status CASE ignores the count (despite its own comment claiming otherwise), and `DoseSheetScreen` receives `doses_in_last_24h` in the resolved payload and never reads it. A caregiver can log a 6th acetaminophen dose in 24h and see "OK to give now."
- In `compute_dose_status`: return a new status `max_reached` when `doses_in_last_24h >= max_doses_per_24h` (check before the interval CASE).
- In `DoseSheetScreen`: treat `max_reached` like the allergy block (red card, no log button without explicit override); also show a quiet "Dose N of M in the last 24 h" line on the recommended-dose card at all times.
- Add `max_reached` to the `DoseStatus` type, `DosePill` labels, and Home pill mapping.
**Acceptance:** Logging a dose when at the 24h cap requires an explicit destructive-confirm override; the count is visible on the dose sheet.
**Depends on:** none.

### SAFE-2 · Single source of truth for intervals (server ⇄ engine divergence) — **P0 · M · Backend + DoseSheet**
**Status:** DONE (2026-07-02) — RPC now age-aware (acetaminophen/ibuprofen ≥6 mo → ≥6h); DoseSheet consumes server status/next_safe_at (engine keeps the amount). Same migration as SAFE-1.
Two independent safety computations disagree today:
- **DB/RPC:** all acetaminophen rows seeded `min_interval_hours = 4`. `compute_dose_status` (drives Home pills + `nfc-resolve` statuses) says **due at 4h** for every age.
- **Client engine (`lib/dosing.ts`):** q4h only for infants (2–6 mo); **q6h for 6 mo–adult**.

So a 5-year-old at hour 5 shows **"Due now" on Home** and **"Too early" on the dose sheet**. For a safety app, an inconsistent answer is worse than a conservative one.
- Decide the source of truth: recommend making `compute_dose_status` age-aware (join `children.date_of_birth`, apply the same gate table as `dosing.ts`: <6 mo → 4h, otherwise 6h for acetaminophen; ibuprofen 6h).
- Have `DoseSheetScreen` **use the server's `status`/`next_safe_at` from the resolved payload** instead of recomputing from `last_dose_at` + engine interval. Keep the engine for the *amount* (mg/mL), the server for the *timing*.
- Document the gate table in one place referenced by both (`docs/dosing-rules.md`).
**Acceptance:** Home pill, resolved-tag status, and dose-sheet banner always agree for the same child/med/moment; a test proves the 5h-pediatric case shows "early" everywhere.
**Depends on:** SAFE-1 (touches the same RPC — do together).

### SAFE-3 · Re-check status at log time (the double-dose race) — **P0 · M · DoseSheet + Backend**
**Status:** DONE (2026-07-02) — doLog re-runs compute_dose_status immediately before insert; early/recent/max_reached aborts with destructive-confirm override. Live-banner realtime refresh deferred (optional hardening).
The resolved payload is a **snapshot at scan time**. The exact scenario Cappy exists to prevent — two caregivers, minutes apart — defeats it: parent A scans, sheet says "OK to give now," parent B logs a dose from their phone, parent A taps "Log now" and gets no warning.
- In `doLog`, immediately before the insert, call `compute_dose_status` fresh; if status changed to `early`/`recent`/`max_reached`, abort and show "⚠️ {Name} was given a dose {x} minutes ago by {caregiver}" with explicit override.
- Better: subscribe to `dose_events` realtime for the family while the DoseSheet is open and refresh the safety banner live (the plumbing already exists in `realtime.subscribeFamilyDoses`).
- Optional hardening: a DB trigger/constraint that stamps `dose_events` rows logged inside the interval window with a `flagged_early` marker for the timeline.
**Acceptance:** With two devices, B logs a dose while A's sheet is open → A's banner flips to "Given recently" within seconds, and A's log attempt requires override.
**Depends on:** SAFE-2 (uses the unified status).

### SAFE-4 · Never fail open to "Due now" — **P0 · S · Home**
**Status:** DONE (2026-07-02) — `unknown` status in type/DosePill/Home error paths (ticket D1). nfc-resolve fallback now returns 'unknown' too (v5 deployed to cappy-dev 2026-07-02). Fully closed.
`HomeScreen.loadChildren` catches RPC/network errors and silently defaults `status: 'due'` — a dead network renders the most permissive possible answer. Same fallback lives in `nfc-resolve` (`DUE_STATUS` on RPC error).
- Add an `unknown` status: gray pill, label "Status unavailable", tap explains why. Use it in every catch path that currently coerces to `due`.
**Acceptance:** Airplane-mode Home shows gray "Status unavailable" pills, never "Due now."
**Depends on:** none.

---

# P1 — Missing core flows

### FLOW-1 · Manual dose logging (no tag required) — **P1 · L · Screens**
**Status:** DONE (2026-07-02) — "Log a dose" on ChildDetail → medication picker → same DoseSheet via a manually built resolved payload (status from compute_dose_status, conservative 'unknown' fallback; SAFE-1/2/3 checks apply unchanged). Backdating shipped too (Now / 30m / 1h / 2h segmented picker on both recipient paths).
**The DoseSheet is only reachable through a successful NFC resolve** (`navigate('DoseSheet', { resolved })` appears once, in ScanScreen). The Scan fallback text promises "you can still log doses manually from the Home screen" — but no such path exists. Lost sticker, dead tag, NFC-less phone, or med given away from the bottle = no logging at all, and the shared record silently goes stale (a safety problem in itself).
- Refactor `DoseSheetScreen` to accept either `{ resolved }` **or** `{ childId, medicationId }`; in the second case fetch family/med/status context itself (a small `resolve-manual` RPC or client queries mirroring `nfc-resolve`).
- Entry points: a **"Log dose" button on ChildDetail** (spec'd in HOW-TO-FINISH but never built) and a med picker (family's registered meds + brand prefs) shown when no tag context exists.
- Include a **"given at" time adjuster** (default now, allow backdating up to a few hours) — critical for "I forgot to log it when I gave it," which is the main real-world manual case.
**Acceptance:** From Home → child → Log dose → pick med → same safety banner and logging as the tag flow, including SAFE-1/2/3 checks. Works on an NFC-less simulator.
**Depends on:** SAFE-2 (shared status path).

### FLOW-2 · "Next safe dose" local notification — **P1 · M · App shell**
**Status:** DONE (2026-07-02) - reminders.ts schedules a local notification at server next_safe_at per child+med; opt-in toggle on the dose-logged overlay (persisted); replaced on newer dose. Cross-device reschedule deferred to beta hardening.
The app computes `next_safe_at` and throws it away. The highest-value moment in the whole product is *knowing when the next dose is allowed* at 2 AM.
- After a successful log, offer (toggle on the success haptic moment, remember the choice): "Remind me when the next dose is safe" → schedule an `expo-notifications` local notification at `next_safe_at` ("Cole's next acetaminophen dose is now safe").
- Cancel/reschedule if a newer dose for the same child+med lands (incl. via realtime from another caregiver — the subscription already fires).
- Native module → needs the next EAS build; batch with the pending image-picker/Apple-auth rebuild.
**Acceptance:** Log a dose → opt in → notification fires at the computed time; a dose logged on device B reschedules device A's reminder.
**Depends on:** SAFE-2 (correct `next_safe_at`). Native rebuild.

### FLOW-3 · Family switcher — **P1 · S · Home/Timeline/Settings**
**Status:** DONE (2026-07-02) — ticket D3 + senior fix (re-fetch on auth change).
`Home`, `Timeline`, and `Settings` all hardcode `fams[0]`. The schema and invites support multi-family (separated parents, grandparents in two families) but the UI can't reach the second family.
- Minimal: make the family-name heading on Home a tappable menu when `families.length > 1`; persist the active family id in AsyncStorage; share it via a tiny `ActiveFamilyContext` consumed by all three screens.
**Acceptance:** A user in two families can switch and see the correct children/timeline/settings; choice survives relaunch.
**Depends on:** none.

---

# P1 — Interface polish (highest-visibility items)

### UX-1 · Replace `Alert.prompt` with design-system sheets — **P1 · M · Screens**
**Status:** DONE (2026-07-02) — ticket D4 (InputSheet; Alert.prompt gone).
Weight update (ChildDetail) and caregiver-name edit (Settings) use `Alert.prompt` — visually jarring against the polished token system, no validation affordance, and iOS-only (blocks the month-4 Android plan).
- Build a small `InputSheet` on the existing `Sheet` + `Field` components (title, hint, validation, primary/cancel).
- Weight sheet: lb/kg segmented toggle (`Segmented` exists), previous value shown, sanity range check (2–150 kg) with a confirm on outliers — a mistyped weight silently produces a wrong dose today.
**Acceptance:** No `Alert.prompt` anywhere; weight entry validates range and unit.
**Depends on:** none.

### UX-2 · Home header + greeting polish — **P1 · S · Home**
**Status:** DONE (2026-07-02) — ticket D2.
- Greeting shows the **email prefix** (`user.email.split('@')[0]`) even though `profiles.display_name` is captured at sign-up and editable in Settings. Use the display name.
- Add the family-switcher affordance (FLOW-3) and a subtle "last synced/live" indicator so caregivers trust the realtime claim.
**Acceptance:** "Welcome back, Nick." from profiles; header feels intentional.
**Depends on:** FLOW-3 for the switcher.

### UX-3 · Timeline upgrades — **P1 · M · Timeline**
**Status:** DONE (2026-07-02) — ticket D5 (day grouping + realtime).
Currently a flat list, no realtime, hardcoded first family.
- Group by day ("Today", "Yesterday", date headers); subscribe to `subscribeFamilyDoses` like Home so it's live; respect the active family (FLOW-3); optional child filter chips.
**Acceptance:** Timeline updates live and reads as a day-grouped history.
**Depends on:** FLOW-3.

### UX-4 · ChildDetail completeness — **P1 · M · ChildDetail**
**Status:** DONE (2026-07-02) - age/DOB + live status pill on ChildDetail; admin-gated name editing (RLS-aware); Log-a-dose entry shipped with FLOW-1.
- Show DOB/age (dosing is age-gated; age isn't visible anywhere).
- **"Log dose" primary button** (entry to FLOW-1).
- Edit name; day-grouped dose history; show the child's current dose status pill in the header card (same RPC as Home).
**Acceptance:** A caregiver can answer "how old, how heavy, allergic to what, what's been given, can I dose now, log one" from this one screen.
**Depends on:** FLOW-1.

---

# P2 — Quality & release hygiene

### QUAL-1 · Tests for the dosing engine + RPC — **P2 · M · Quality**
**Status:** DONE (2026-07-02) — ticket D6: 32 tests green (dosing golden table + parseTagUrl).
`lib/dosing.ts` is safety-critical and has **zero tests**. Golden cases (the 6 verified manually + boundary ages 2 mo/6 mo/12 yr, cap crossovers), property checks (dose never exceeds cap; monotone in weight), `ageMonthsFromDob` edge dates, `parseTagUrl` variants, and a pgTAP or scripted test for `compute_dose_status` (incl. SAFE-1/2 behavior).
**Acceptance:** `npm test` green; a deliberate cap change breaks a test.

### QUAL-2 · CI — **P2 · S · Quality**
**Status:** DONE (2026-07-02) — ticket D7: app CI at repo root; stale server workflows deleted.

### QUAL-3 · Expo SDK upgrade — **P2 · L · Platform**
**Status:** TODO
SDK 51 / RN 0.74 is ~a year old (mid-2026). Apple's yearly SDK requirements and expo-notifications (FLOW-2) argue for upgrading to the current SDK **before** beta, batched with the pending native rebuild. Don't block P0/P1 on it.

### QUAL-4 · Legal docs before external testers — **P2 · L · Legal**
**Status:** TODO (LEG-1) — unchanged; required before TestFlight external testing. Pair with in-app consent capture (`profiles.consent_accepted_at`).

---

# P3 — Nice-to-have polish

- **Skeleton loaders** instead of bare spinners on Home/Timeline/ChildDetail.
- **Dose-logged success moment** — brief confirmation overlay ("Logged · next safe at 3:40 PM") instead of instant `goBack()`; reinforces the reminder offer (FLOW-2).
- **Empty-state illustrations** using the capybara mark (currently generic Ionicons).
- **Sign in with Apple** finish-line (capability + Supabase provider config — code shipped in Phase 2).
- **Per-product volume display** — engine already computes both ibuprofen concentrations; show the alternate product line on the dose card.
- Commit-message hygiene (`yeehaw`, `ok`) once collaborators/agents share the repo.

---

## Suggested execution order

1. **SAFE-1 + SAFE-2** (one PR — same RPC + DoseSheet surface) → **SAFE-4** (trivial) → **SAFE-3**
2. **FLOW-1** (manual logging) → **UX-4** (its ChildDetail entry point)
3. **FLOW-3 → UX-2 → UX-3** (family context + header + timeline, small combined batch)
4. **UX-1** (input sheets)
5. **FLOW-2** batched with the next native build (+ Apple sign-in config)
6. **QUAL-1 → QUAL-2**, then **QUAL-3/QUAL-4** on the beta runway
