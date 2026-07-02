# Cappy! — Roadmap to Production (v1.0 App Store release)

**Generated:** 2026-07-02, immediately after the Phase 3 sprint.
**Where we are:** All P0 safety items shipped and live (24h cap, age-aware intervals, log-time race check, no fail-open). Manual logging + backdating, family switcher, Schedule tab (clock + 24h timeline), caregiver profiles/avatars, photo upload fixed at the root (audit-trigger bug), realtime multi-screen, timeline med colors, validated inputs, 32 tests, CI. Device-verified through tonight's build.

**Progress (2026-07-02, end of day):** M1 ✅ COMPLETE (D8/D9/FLOW-2/UX-4 shipped + device-QA'd). M2 ✅ code-complete — SDK 57/RN 0.86 migration green (tsc/eslint/jest), HealthKit + Sentry staged, build 3 submitted to EAS. M3 ✅ infra ready — cappy-prod live (ref msjmnvegjrycwoedrwym), prod env wired in eas.json; remaining: PROD-RUNBOOK.md steps (db push, functions deploy, dashboard checklist, SEC-1 rotation). M4 in flight — guideline 1.4.2 verified; counsel next.

Milestones are ordered; each has an exit criterion. Bracketed owners: [You] = founder actions, [Claude] = agent work sessions, [Counsel] = lawyer.

---

## M1 · Stabilize what just shipped (next session, JS-only)

- Execute **D8** (dose-logged success moment) and **D9** (onboarding checklist) — specced, junior-agent ready. [Claude]
- **FLOW-2**: real "next dose is safe" local notification wired into D8's placeholder (expo-notifications is baked into the current binary). Cancel/reschedule on realtime dose events. [Claude]
- **UX-4 remainder**: DOB/age + live status pill on ChildDetail, child name editing (now safe — the audit-trigger fix unblocked children updates). [Claude]
- Device QA of D10/D12 visuals: clock geometry, dark mode, photo replacement, Schedule realtime redraw. [You]

**Exit:** a caregiver can go scan → log → "next safe at 3:40 PM" → get a reminder at 3:40, and a brand-new user self-onboards without guidance.

## M2 · Native build 3 (one EAS build, batched)

- **D13** Apple Health weight import (native module + entitlement). [Claude spec'd → You build]
- **Sign in with Apple** finish-line: App ID capability + Supabase Apple provider (code shipped in Phase 2). App Store REQUIRES it if any third-party login exists; with email+password only it's optional — decide before submission. [You: 2 dashboard steps]
- **QUAL-3** Expo SDK upgrade (51 → current). Do it in this build so beta runs on the SDK you'll ship. [Claude, then You build]
- Push-notification groundwork (APNs key in EAS) if cross-caregiver push is wanted for v1 — otherwise local-only reminders ship fine. [You decide]

**Exit:** build 3 on your phone; HealthKit import works; SDK current.

## M3 · Production infrastructure

- **New Supabase project `cappy-prod`**: apply the tracked migrations from scratch (they're complete now — this was the point of keeping them honest), deploy edge functions, seed medications, enable leaked-password protection + PITR/backups, rotate and vault all secrets (incl. the long-deferred SEC-1 password rotation — non-negotiable before real families' data). [Claude can drive via MCP + You for secrets]
- **Environment switching**: `.env.production` → prod URL/key; EAS production profile builds against prod; dev stays on cappy-dev. [Claude]
- **Crash/error reporting**: add Sentry (`sentry-expo`) — you cannot run a medication app in production blind. Scrub PII from breadcrumbs. [Claude, native → fold into M2 build if timing allows]
- **AASA/domain**: confirm cappy.closedose.com worker + universal links against the production bundle/team (already live for dev — re-verify). [You]

**Exit:** a production build signs into cappy-prod, cold-launches from a tag, and errors land in Sentry.

## M4 · Legal & compliance (start NOW — longest lead time)

- **LEG-1**: privacy policy, terms of service, caregiver consent drafts (consumer posture, COPPA notice, bold non-medical-advice disclaimer) + in-app consent capture (`consent_accepted_at`/`consent_version` at sign-up). [Claude drafts → Counsel reviews]
- **⚠️ App Review risk — dosage calculators (VERIFIED 2026-07-02, guideline 1.4.2):** Current text: "Drug dosage calculators must come from the drug manufacturer, a hospital, university, health insurance company, pharmacy or other approved entity, or receive approval by the FDA or one of its international counterparts." (1.4.1 separately requires medical apps to remind users to consult a doctor - Cappy's disclaimers already do.) Two viable paths: qualify as an approved entity (operate under/partner with a pharmacy, health system, or university) or the FDA route (assess whether Cappy fits FDA non-device Clinical Decision Support criteria or needs clearance). Cappy computes weight-based doses. Mitigations to discuss with counsel before submission: physician-founder credentials, framing as an OTC label-consistent logging/coordination tool, citing the label ranges, or an approved-entity partnership. **This is the single biggest external risk to shipping — research it first, not after a rejection.** [You + Counsel; Claude can research the current guideline text]
- App Privacy "nutrition label" inventory: what's collected (email, names, DOB, weight, photos, dose logs), purposes, no tracking/ads. Health data disclosures if D13 ships. [Claude drafts]

**Exit:** counsel-approved docs hosted at closedose.com, consent captured in-app, App Review strategy decided.

## M5 · Beta (TestFlight)

- Internal TestFlight (you + family) on the production stack, 1–2 weeks of real use.
- External TestFlight: 5–10 design-partner families. Feedback channel (in-app "report a bug" mailto exists — consider a lightweight form). Watch Sentry + Supabase logs weekly.
- Hardening from feedback + the deferred items: live-updating dose-sheet banner, Home per-child query batching (N+1), accessibility/VoiceOver + Dynamic Type audit, empty-state polish. [Claude]
- **DOC-1** while beta runs: root README, posture doc, migration/audit docs — so any future dev or agent onboards from the repo alone. [Claude]

**Exit:** ≥2 weeks external beta, no P0/P1 bugs open, crash-free rate >99%.

## M6 · App Store submission (v1.0)

- Production EAS build + `eas submit`; App Store Connect listing: screenshots (Home, DoseSheet, Schedule clock, Timeline), description leading with coordination/logging (per M4 strategy), support URL, privacy policy URL, age rating, medical disclaimer in the description. [You + Claude for assets/copy]
- Review notes for Apple: demo account with seeded family, an explanation of NFC usage, dosing-source citations. Expect at least one review round-trip; budget 1–2 weeks.
- Launch checklist: OTA update channel configured (expo-updates) for JS hotfixes without review; support email monitored; DB backups verified.

**Exit:** approved, live on the App Store.

## M7 · Post-launch (first 90 days)

- Weekly: Sentry triage, advisor sweep, dependency patching. OTA hotfix muscle.
- v1.1 candidates by observed usage: cross-caregiver push ("Sarah just gave Cole ibuprofen"), Rx medications support, dose export/PDF for pediatrician visits, widgets/Live Activities for next-safe countdown, additional OTC meds (diphenhydramine, cetirizine) — each requires the same dosing-engine rigor as the antipyretics.
- **Android** (original month-4 plan): the RN codebase is ready; needs NFC intent testing, Play data-safety forms, and the same dosage-calculator policy check on Google Play.

---

## Sequencing summary

```
M1 (JS sprint) ──► M2 (native build 3) ──► M3 (prod infra) ──► M5 (beta) ──► M6 (submit) ──► M7
        M4 (legal + Apple-policy research) runs in parallel from TODAY — longest pole in the tent
```

Realistic calendar with current velocity: M1–M3 within ~1–2 weeks, M4 gated on counsel (~2–4 weeks), M5 ~3 weeks, M6 ~2 weeks → **production in roughly 8–10 weeks**, with Apple's dosage-calculator policy as the main variable worth de-risking in week 1.
