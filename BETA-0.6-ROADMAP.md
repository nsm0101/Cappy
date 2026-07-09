# Cappy! — Beta 0.6 Roadmap

**Generated:** 2026-07-09
**Codebase of record:** `/ios-native` (SwiftUI, `Cappy.xcodeproj`, team H2AGCK2WB8) + Supabase (`cappy-prod` msjmnvegjrycwoedrwym / `cappy-dev` hyfmcwswtjlnxtdspggr) + Cloudflare Worker (`cappy-aasa` on cappy.closedose.com).
**Expo app status:** `/app` is maintenance-only; its Supabase functions/migrations remain the deployment source of truth. Expo-era planning docs archived at `docs/archive/expo-alpha/`.

---

## Direction

Beta 0.6 turns Cappy! from a "log a dose safely" tool into the **family
medication command center for sick days**: multiple kids, multiple
caregivers, multiple medications — one coordinated, safety-checked picture.
The differentiators to sharpen: (1) physical-first entry (NFC cap taps and
QR stickers that work from a cold start every time), (2) per-child
safety rails that never fail open, and (3) glanceable time-to-next-dose
everywhere the parent already looks (lock screen, widget, watch, tracker).

---

## Shipped in the 0.6 work-up (2026-07-09)

- ✅ **Tag resolution end-to-end** — `cappy.closedose.com/t/{slug}` now serves a
  branded fallback page (Open in Cappy! + store link + auto deep-link) instead
  of dead plain text; in-app parser accepts full URLs, `cappy://` links, and
  bare slugs so every sticker printing resolves. (`aasa-worker.js`, `Tags.swift`)
- ✅ **Manual dose log fixed** — the admin passcode moved from the admin's
  local Keychain to a hashed server-side `family_settings` row (RLS: members
  read, admins write), so every caregiver device can verify it; offline
  Keychain fallback retained.
- ✅ **Keyboard always collapsable** — global "Done" accessory over every
  keyboard + drag-to-dismiss on all scrolling screens.
- ✅ **Wordmark masthead** — larger, centered Cappy! lockup on Home.
- ✅ **10 themes** — Classic, Calm, Neon, Midnight, Sunset, Lavender, Forest,
  Ocean, Rose, Mono; swatch picker in Settings; dose-status colors are
  intentionally identical across themes (safety semantics).
- ✅ **Log a dose for another caregiver** — from Family menu, per-caregiver
  "Log dose" (acetaminophen/ibuprofen) opens the dose sheet preselected.
- ✅ **Medication Tracker** (Schedule → Medication Tracker), per patient:
  - 24h left-to-right timeline, stacked per-medication rows with legend
    toggles, semi-transparent minimum-interval band from the last dose,
    optional 24-hour clock.
  - 3-day / 72h three-column view, top-to-bottom day timelines with
    color-coded dose markers.
  - Weekly 7-day strip: per medication, one checkbox per allowed daily dose,
    checked off by logged doses.
  - Monthly 4-week calendar with per-day per-med completion checks.
- ✅ **Symptom tracker at log time** — optional expandable entry on the
  success overlay (quick chips + free text), shown alongside the reminder
  ask; saved via the narrow `set_dose_note` RPC (logger-only, 1-hour window,
  append-only table preserved); notes surface in the Timeline.
- ✅ **Multi-select family dosing** — "Select multiple" in the dose sheet;
  per-child weight-based doses, per-child block reasons (allergy, age gate,
  interval, 24h max, missing weight), SAFE-3 race re-check per child, one
  button logs all safe doses.

### Deploy checklist for the above
- [ ] `wrangler deploy` from repo root (updated worker) — set the real
      TestFlight/App Store URL in `aasa-worker.js` (`STORE_URL`, currently a
      placeholder).
- [x] `family_settings` migration applied to cappy-prod + cappy-dev.
- [x] `set_dose_note` RPC applied to cappy-prod + cappy-dev (grants re-applied).
- [ ] `xcodegen generate` in `/ios-native` (new files: Themes.swift,
      FamilySettingsRepository.swift, Tracker/*), then build + device QA.
- [ ] Print-shop check: confirm new QR/NFC batches encode the full
      `https://cappy.closedose.com/t/…` URL (in-app parser now tolerates bare
      slugs, but the full URL is what makes Camera-app scans work).

---

## Beta 0.6 to-do board

Priorities: P0 must ship · P1 should ship · P2 stretch. Complexity S/M/L.

### A. Reliability & safety
- [ ] **P0/S — Device QA pass on the 0.6 work-up**: NFC tap (cold + warm),
      Camera-app QR → Universal Link, in-app QR, manual log on a second
      caregiver device, multi-select log, symptom note, each tracker view.
- [ ] **P0/S — AASA validation**: `swcutil` / Apple CDN check after worker
      deploy; confirm associated-domains entitlement on TestFlight build.
- [ ] **P0/M — Unit tests**: Tags.parseTagUrl variants (URL/scheme/bare slug),
      multi-select eligibility matrix, passcode hash round-trip,
      tracker day-bucketing (DST boundaries!).
- [ ] **P1/S — Timezone hardening in Tracker**: verify day buckets and the
      24h axis around DST transitions and travel.
- [ ] **P1/M — Offline queue**: cache a dose log made with no connectivity,
      sync + re-run safety check on reconnect, conflict UX.
- [ ] **P2/M — `nfc_tags` UID registration flow polish** (family-bound
      hardware tags): register/retire UI in Family menu.

### B. Caregiver UX innovations (this cycle's focus)
- [ ] **P0/M — Sick Mode**: a per-child toggle that pins a "sick card" to the
      top of Home (temp trend, last dose, next-safe countdown, symptom notes),
      auto-expires after 48h quiet. One glance at 3 AM.
- [ ] **P0/M — Lock-screen widget + Dynamic Island countdown**: extend the
      existing Live Activity to a WidgetKit lock-screen family; countdown to
      next-safe per child, tap → dose sheet. (CappyWidget target exists.)
- [ ] **P1/M — Temperature quick-log**: number pad + °F/°C on the symptom
      sheet; plot on the Tracker 24h/3-day views as a thin overlay line;
      optional HealthKit write.
- [ ] **P1/M — App Shortcuts / Siri**: "Log Tylenol for Ava",
      "When can Ava have ibuprofen?" via AppIntents (reuses slug pipeline).
- [ ] **P1/S — Double-dose guard push**: when a dose is logged, notify other
      *active-that-hour* caregivers ("Nick just gave Ava acetaminophen") to
      kill the classic both-parents-dosed failure.
- [ ] **P1/S — Bottle barcode scan**: scan the OTC package UPC to pick the
      exact product/concentration when registering or logging manually.
- [ ] **P1/M — Pediatrician export**: shareable PDF of a child's dose +
      symptom history (last 7/30 days), from Tracker.
- [ ] **P2/S — Refill radar**: estimate remaining mL from logged volumes per
      family bottle; nudge when ~4 doses remain.
- [ ] **P2/M — Caregiver shift notes**: lightweight "handoff" note pinned to
      the family for the day ("gave ibu 2:40, fever 101.2 at 4pm, ped called").
- [ ] **P2/M — Apple Watch app**: next-safe glance + one-tap log confirm.
- [ ] **P2/S — Symptom note on multi-select logs**: today the note attaches
      to the last dose in the batch; allow per-child or all-children notes.

### C. Platform & operations
- [ ] **P0/S — TestFlight build 0.6** with release notes; replace worker
      STORE_URL placeholder.
- [ ] **P1/M — Android direction decision**: native Kotlin (mirrors ADR-0004)
      vs. reviving `/app` Expo for Android only. Decide by end of July.
- [ ] **P1/S — Supabase advisors pass** (`get_advisors`) on prod after the two
      new migrations; fix anything security-level.
- [ ] **P1/S — Crash/analytics**: wire Sentry (staged in Expo era) into the
      native app; add dose-funnel analytics (scan → resolve → log).
- [ ] **P2/S — CI for ios-native**: xcodegen + xcodebuild test on PR.

### D. Product/business (tracking only)
- [ ] **Prior-art review** — Izick (patent counsel) reviewing existing IP
      around NFC/QR-triggered dose-safety logging + multi-caregiver
      coordination; outcome gates a provisional filing decision.
      Engineering support: keep an invention log (dated commits + this
      roadmap help establish conception/reduction-to-practice dates).
- [ ] **Sticker supply chain**: NTAG215 batch #2 with full-URL NDEF payloads
      (see ADR-0008) + QR sheet printing vendor.
- [ ] **Design-partner feedback loop**: 5 sick-season families, weekly.

---

## Milestones

| Milestone | Target | Contents |
|---|---|---|
| **0.6.0-beta.1** | +1 week | Deploy checklist done, device QA green, TestFlight |
| **0.6.0-beta.2** | +3 weeks | Sick Mode, lock-screen widget, double-dose guard, tests |
| **0.6.0** | +5 weeks | Temperature log, Siri shortcuts, pediatrician export, advisors clean |
| **0.7 planning** | +6 weeks | Android decision executed, watch app spike, IP decision |
