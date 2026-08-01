# Retrospective: ADR-0009 — cross-platform caregiver dose notifications

**Date:** 2026-08-01
**Agent role:** Orchestrator, with four specialists dispatched in parallel
**Ticket:** ADR-0009 tickets 1–11 (`docs/adr/0009-cross-platform-caregiver-dose-notifications.md`)
**Outcome:** Tickets 1–10 Done (code complete, unrun) · ticket 11 Done as a plan, not a run

Per AGENTS.md §5 this covers the ADR as one unit rather than eleven files;
each ticket is called out by number where its outcome differs.

## What went well

- **Strict file ownership made parallelism safe.** Four specialists ran
  concurrently with zero merge conflicts, because each was given an explicit
  owned-file list and `src/navigation/**` was withheld from all of them and
  wired by the orchestrator afterwards. The two agents that would otherwise
  have collided (settings UI and dose sheet) both needed route registration;
  neither touched it.
- **Capturing a verification baseline before dispatch paid for itself.**
  `typecheck` clean, `lint` clean, 37 tests at `HEAD`. Every later claim of
  "clean" was measured against that instead of asserted. It also caught that
  `node_modules` was absent — without installing it first, all four agents
  would have reported "could not verify."
- **The ADR's own priority call was correct.** Ticket 8 (scan-sheet
  reordering) is half a day and is the only thing in the ADR that actually
  prevents a double dose. It was dispatched in the first wave rather than
  last, and it landed.
- Three of four agents independently flagged the same PHI conflict without
  being told the others had. Convergent flagging from independent readers is
  a strong signal a spec problem is real and not a misreading.

## What was harder than expected

- **The ADR was written against a schema that does not exist.** It assumes a
  `doses` table; the real one is `dose_events`, with a client-generated UUID
  primary key and a recipient XOR (`child_id` **or** `caregiver_user_id`).
  Every agent brief had to carry a "schema reality vs the ADR" section. The
  ADR's estimate of 10–16 days assumed none of this reconciliation.
- **ADR-0009's cross-references point at a different ADR series** than
  `/docs/adr/` contains. Left as written with an editor's note rather than
  renumbered — see the note in the ADR itself.
- **`NotificationsScreen` shipped with no way back.** The app stack sets
  `headerShown: false` globally, so a screen that renders no header of its own
  strands the user. Not the agent's error so much as a gap in the brief: file
  ownership boundaries meant the agent that built the screen never saw how it
  would be mounted.

## What I had to invent or assume

- **Adult-recipient doses do not notify.** `dose_events` permits a dose whose
  recipient is an adult caregiver; ADR-0009's subscription model is per-child
  only and silent on this. Asked the founder; no answer came back, so the
  ADR-faithful reading was taken and the trigger skips those rows. Recorded in
  `app/QA-NOTIFICATIONS.md` as a known gap so it is not filed as a bug later.
- **Repo-only migrations.** Nothing in this session was applied to a live
  Supabase project. `cappy-dev` is paused and `cappy-prod` is live; applying
  schema to either is the founder's call, not a side effect of a build task.
- **`undetermined` permission state.** The ADR specifies granted and denied
  only. Its denied-state copy ("turned off in your device settings") is
  factually wrong before the OS prompt has ever been shown, so a third state
  was added with different copy and a CTA that opens the priming sheet rather
  than firing the dialog cold.
- **503 over a placeholder fingerprint.** `assetlinks.json` fails loudly until
  `ANDROID_CERT_SHA256` is set. A wrong fingerprint breaks App Links
  verification exactly as hard as a missing file but looks correct to anyone
  who curls it.

## Tech debt or follow-ups created

- **[high] AGENTS.md §3 and ADR-0009 directly contradict each other.** The
  constitution says never put PHI in a push notification payload. The ADR
  mandates "Sarah logged 5 mL Tylenol for Emma at 2:14 PM" — child's name,
  medication, amount. Both cannot hold. The ADR is the newer and more specific
  founder decision and the feature is pointless without recognisable content,
  so it was implemented, with PHI kept out of the `data` payload and out of
  server logs, and Android's channel set to `lockscreenVisibility: PRIVATE`.
  **This needs a founder decision in one document or the other.** iOS has no
  equivalent mitigation applied.
- **[high] Nothing in this ADR has ever run.** No migration was applied, no
  function deployed, no notification delivered. The tracer bullet is code
  complete and unproven.
- **[medium] No family timezone.** `notify-dose` formats the dose time in UTC
  because there is no per-family timezone anywhere in the schema. A caregiver
  in UTC-5 reads "7:14 PM" for a 2:14 PM dose. The fix is a timezone column on
  `families`, which is outside this ADR.
- **[medium] Adult-recipient dose notifications** — see above.
- **[medium] iOS Time Sensitive entitlement not added.** ADR decision 5 needs
  `com.apple.developer.usernotifications.time-sensitive`. Adding it can fail an
  iOS build if the capability is not enabled on the App ID, so it was left as
  an explicit decision rather than a silent build break.
- **[medium] No `expo-notifications` config plugin.** Needs a monochrome 96×96
  notification icon that does not exist in `src/assets/`, and its iOS side
  writes `aps-environment` into entitlements — a signing decision that should
  not be a side effect of a notification ticket. Consequence: no FCM
  default-channel fallback, so every Android message **must** carry
  `channelId: "dose-activity"`.
- **[low] ADR-0004 and ADR-0006 are superseded in practice but not on paper**
  (the app is Expo/React Native with no Fastify service). Worth formally
  superseding so the decision log matches the code.
- **[low] No render tests for `Switch`.** `@testing-library/react-native` is
  not a dependency; adding one was judged scope expansion. The copy guard is
  source-level instead.

## Honest accounting: what did not get done

The **scan-sheet agent (tickets 7, 8) was terminated mid-run by a monthly
spend limit** and never filed a report. Its output was verified directly
instead of on its word: `LastDoseBlock` renders ahead of both the
recommended-dose card and both Log buttons, `DoseDetailScreen` loads and
renders read-only, and typecheck, lint and the full suite are green. The work
is complete; the *reporting* is what was lost.

The **backend agent (tickets 1, 3, 4, 10) died on dispatch** — 116 bytes of
output, no files, and no failure notification ever arrived. It was written by
the orchestrator directly instead. Those four tickets are the tracer bullet:
the migration, the trigger, the `notify-dose` Edge Function and token hygiene.

**The Edge Function code is not covered by any tooling in this environment.**
`tsconfig.json` excludes `supabase/functions` (it is Deno, not React Native),
and Deno is not installed here, so `notify-dose`, `pushSender.ts` and the
`accept-invite` change were verified by reading, not by running. The SQL is in
the same position — there is no database in this session. The repo's existing
Edge Functions have always been in this position, so this is the established
convention rather than a new gap, but it means the first real test of the
tracer bullet is `supabase db push` + `functions deploy` against `cappy-dev`.

One bug was caught this way and fixed before it shipped: the migration
originally read `create extension pg_net with schema extensions`, which would
have failed outright — pg_net is not relocatable and its control file pins it
to the `net` schema.

## Suggested change to my own system prompt

When dispatching parallel specialists, give each one the *mounting context*
for what it builds, not just its own file list — the `NotificationsScreen`
back-navigation gap came from an agent that correctly never looked outside its
boundary. A one-line "here is how your screen will be reached" in the brief
would have caught it before integration.

## Time spent

Roughly 30 minutes of orchestrator time; four specialists at ~10 minutes each
wall-clock, run concurrently. Two did not run to completion.
