# ADR-0009: Cross-Platform Caregiver Dose Notifications

- **Status:** Proposed
- **Date:** 2026-08-01
- **Deciders:** Dr. Nick
- **Supersedes:** none
- **Related:** ADR-0004 (Postgres triggers over service-layer calls), ADR-0006 (Supabase-only backend), ADR-0002 (typed API abstraction)

> **Editor's note on cross-references (added when filing into `/docs/adr/`).**
> The "Related" line and the body of this ADR cite ADR numbers from a
> different numbering series than the one in this repository. In
> `/docs/adr/`, ADR-0002 is *Supabase for alpha*, ADR-0003 is *Cloudflare R2
> storage*, ADR-0004 is *Native iOS and Android, not React Native*, and
> ADR-0006 is *TypeScript on Node.js with Fastify*. Two of those have since
> been superseded in practice but not on paper: the app is Expo/React Native
> (contradicting ADR-0004) and Supabase-only with no Fastify service
> (contradicting ADR-0006) — see the note at the bottom of `MANIFEST.md`.
>
> The references have been left exactly as the author wrote them rather than
> renumbered, because guessing at intent would be worse than an obvious
> mismatch. **Follow-up:** supersede ADR-0004 and ADR-0006 formally so the
> decision log matches the code. Nothing in the implementation depends on
> resolving this.

---

## Context

When a caregiver logs a dose, other caregivers in the family need to know. Today this
only propagates via the Realtime subscription, which requires the app to be open — the
exact condition that fails at 2am when the second caregiver is asleep with the app closed.

Notification scope is **awareness, not prevention**. This is the load-bearing decision
in this ADR and it constrains everything below. A push notification is a *lagging*
signal: it fires after the dose is already written. It cannot stop a caregiver who is
standing in the kitchen holding the bottle. Double-dose prevention is a scan-time
concern (see "Design Decisions → Scan sheet ordering") and is explicitly **not** the
job of this subsystem.

An earlier estimate put this work at 3–8 weeks. That estimate was for a fully
productionized notification subsystem and was wrong for a tracer bullet. At the scope
decided here — per-child opt-in, iOS and Android at parity, token hygiene — the honest
estimate is **10–16 working days**.

---

## Decision

### 1. Subscription model: per-caregiver, per-child

A caregiver receives dose notifications for a specific child only if subscribed to that
child. This is the "opted in to a given individual's dosing schedule" requirement.

```sql
create table notification_subscriptions (
  user_id     uuid not null references auth.users(id) on delete cascade,
  child_id    uuid not null references children(id)   on delete cascade,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, child_id)
);
```

RLS: a user may only read/write rows where `user_id = auth.uid()` **and** `child_id`
belongs to a family they are a member of. This is the "when applicable for the family"
constraint — it falls out of the existing family-membership RLS rather than needing new
logic.

**Default is subscribed, not unsubscribed.** When a caregiver accepts a family invite,
rows are created for every child in that family with `enabled = true`. They can mute
per child afterward.

> ⚠️ **Flagged decision — reversible, but choose deliberately.** In a medication
> context the failure mode of opt-in-by-default is *noise*, which is annoying. The
> failure mode of opt-out-by-default is *silence*, which is the dangerous one — a
> caregiver who assumed they were covered and wasn't. Defaulting to subscribed makes
> the safe state the automatic one. If you'd rather require explicit opt-in, this is a
> one-line change to the invite-acceptance Edge Function and the `enabled` default.

### 2. Delivery path: trigger → Edge Function → Expo Push

Consistent with ADR-0004 (triggers over service-layer calls):

```
dose INSERT
  → AFTER INSERT trigger on doses
  → pg_net.http_post (fire-and-forget) → Edge Function `notify-dose`
  → resolve recipients: family members WHERE subscribed AND user_id <> actor
  → fetch device tokens (skip stale)
  → POST batched to Expo Push API (≤100 messages/request)
  → record receipts, prune DeviceNotRegistered tokens
```

**The trigger must be fire-and-forget.** A failure in the notification path must never
block, delay, or roll back the dose write. Logging the dose is the critical operation;
telling people about it is best-effort. `pg_net` is asynchronous by design, which gives
us this property for free — but it must be asserted in tests, not assumed.

### 3. Send adapter stays behind an interface

Expo's push service is what makes Android nearly free — one token type, one API, both
platforms. It is also a third-party dependency in the delivery path, which cuts against
the vendor-lock-in posture in ADR-0002.

Mitigation: `notify-dose` calls a `PushSender` interface with a single `send(messages)`
method. The Expo implementation is one file. Swapping to direct APNs + FCM later
touches that file and nothing else.

**Migration signals** — move off Expo Push when any two of these are true:

1. Delivery latency p95 exceeds 30s
2. We need APNs features Expo doesn't proxy (e.g. Critical Alerts, custom collapse IDs)
3. Volume makes Expo's rate limits a live constraint
4. We need delivery telemetry richer than Expo's receipt API
5. A compliance posture change (Posture C → A) requires a documented direct path
6. Expo's pricing or ToS changes materially for health-adjacent apps

### 4. Device token lifecycle

```sql
create table device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,
  platform    text not null check (platform in ('ios','android')),
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
```

Token is upserted on every app foreground, not just first launch — tokens rotate.
`DeviceNotRegistered` in an Expo receipt deletes the row. Tokens unseen for 90 days are
pruned by a scheduled job.

### 5. Interruption level: Time Sensitive, not Critical Alerts

iOS: `interruptionLevel: "time-sensitive"` breaks through Focus and Do Not Disturb. It
requires only the `com.apple.developer.usernotifications.time-sensitive` entitlement,
which is self-service — no Apple review.

**Critical Alerts is explicitly rejected for alpha.** It requires an Apple entitlement
request with a review process measured in weeks, and it bypasses the ringer/silent
switch — a level of intrusion that a dose *log* (as opposed to a dose *emergency*) does
not warrant. This was the single genuine multi-week item in the original 3–8 week
estimate, and removing it removes most of the calendar risk.

Android equivalent: a `dose-activity` notification channel at `IMPORTANCE_HIGH` with
category `msg`. Different mechanism, same intent. Android has no Time Sensitive concept
and should not be made to fake one.

---

## Design Decisions

### Scan sheet ordering (the actual safety mechanism)

Because push is awareness-only, the burden of preventing a double-dose sits entirely on
the scan-time sheet. Required ordering in `cap-sheet` after an NFC tap:

1. Child identity (`cap-avatar` + name)
2. **Last dose: amount, who gave it, how long ago** — `dose-pill` status
3. `dose-safety` line
4. *then* the suggested dose and the Log button

The last-dose block must be above the fold and above the primary action. If a caregiver
can tap Log without having read the last-dose state, the design has failed regardless
of how good the notifications are. This is an ordering change to an existing component,
not new work — but it is the highest-value item in this ADR.

### Notification copy

Format: **actor + amount + child + time.**

> Sarah logged 5 mL Tylenol for Emma at 2:14 PM

Never a clinical claim. Specifically forbidden: "Emma is due for a dose," "Time for
Emma's medication," or any phrasing that presents timing as medical guidance. This
follows the existing design-system intent note — *dose colors are guidance, not clinical
certainty* — and applies with more force in a push, which arrives stripped of the
`dose-safety` line that provides context in-app.

Body carries the same content on both platforms. Presentation follows each platform's
native conventions; content does not diverge.

### Permission priming

The OS permission dialog is never fired cold — there is exactly one chance at it per
install, and a cold prompt wastes it.

Priming sheet (`cap-scrim` + `cap-sheet`), shown after the first successful dose log
rather than at onboarding, so the value is concrete: *"Get told when another caregiver
logs a dose for Emma — even when Cappy is closed."* Accept → OS prompt. Decline → no OS
prompt, ask again after the next dose log by a different caregiver.

### Settings surface

Per-child toggles live on a Notifications screen, reachable from the tab bar. Structure:
`cap-card` containing one `cap-row-item` per child (`cap-avatar` + name + switch).

**Design-system gap:** there is no Switch/Toggle among the 13 existing components. This
is the one net-new component required by this ADR. It needs the standard 44px
(`--tap-min`) target, `--brand` teal in the on state, and a disabled appearance for the
permission-denied case below.

### Permission-denied state

If OS permission is denied, every toggle on the settings screen is a lie. In that state
the screen shows a `cap-card--inset` banner above the list — *"Notifications are turned
off for Cappy in your device settings"* — with a button deep-linking to OS settings, and
renders the toggles disabled. Toggles must never appear functional when nothing can be
delivered.

### Tap destination

Deep link to the logged dose in a read-only `cap-sheet` — same component as the log
flow, without the Log action. Reuses the existing Universal Link infrastructure
(`cappy.closedose.com`); Android needs `assetlinks.json` published at
`/.well-known/assetlinks.json` for App Links to resolve without a chooser dialog.

---

## Android Parity

Android is a **build target, not a port** — the RN/Expo pivot (ADR-0003) already means
one codebase. The delta is platform plumbing only:

| Item | Work |
|---|---|
| FCM v1 credentials via `eas credentials` | ~2h |
| Notification channel (`dose-activity`, IMPORTANCE_HIGH) | ~2h |
| `POST_NOTIFICATIONS` runtime permission (Android 13+) | ~3h |
| App Links — `assetlinks.json` on `cappy.closedose.com` | ~3h |
| NFC divergence (Android foreground dispatch differs from iOS) | ~4h |
| QA pass on physical Android hardware | ~1d |

No separate app, no separate design, no mirrored codebase.

---

## Non-Goals

Explicitly out of scope, with the reasoning that keeps them out:

- **Quiet hours / digest mode** — dose events are low-volume by nature. Add when a real
  user complains about volume, not before.
- **Critical Alerts** — see decision 5.
- **Web push** — `cappy-web` (Vite/vanilla) would need VAPID + a service worker, and on
  iOS Safari requires the user to install the PWA to their home screen first. That's a
  significant UX ask for a surface that isn't the primary product. Separate ADR if it
  becomes a requirement.
- **Notification-driven double-dose prevention** — see Context. Any future work here
  belongs in the scan flow (an intent lock claiming a child for ~60s), not in push.
- **Read receipts / "who saw what when"** — genuinely valuable for a medication product
  and a likely Posture A requirement later, but it is an audit feature, not a
  notification feature. Track separately.

---

## Consequences

**Positive**

- Caregivers get app-closed awareness, closing the gap Realtime can't cover
- Per-child opt-in generalizes cleanly to future notification types (refill reminders,
  schedule changes) without schema change
- One codebase covers both platforms; Android costs days, not weeks
- Trigger-based delivery matches the existing architecture rather than introducing a
  service layer

**Negative / accepted risk**

- Expo Push is a third-party in the delivery path — mitigated by the adapter interface
  and six documented migration signals
- Best-effort delivery means a dropped notification is silent; this is acceptable
  *precisely because* push is not the safety mechanism, and is unacceptable the moment
  anyone starts treating it as one
- One net-new design-system component (Switch)
- Physical devices on both platforms are now required for QA — the simulator cannot
  receive push

---

## Ticket Breakdown

| # | Ticket | Est. |
|---|---|---|
| 1 | Migration: `device_tokens`, `notification_subscriptions`, RLS policies | 1d |
| 2 | Token capture + upsert-on-foreground in `src/api/notifications` | 1d |
| 3 | `notify-dose` Edge Function + `PushSender` adapter + trigger | 2d |
| 4 | Auto-subscribe on invite acceptance (extend existing Edge Function) | 0.5d |
| 5 | Switch component + Notifications settings screen | 1.5d |
| 6 | Permission priming sheet + denied-state banner | 1d |
| 7 | Deep link → read-only dose sheet (iOS Universal Links) | 1d |
| 8 | Scan sheet reordering — last-dose block above Log | 0.5d |
| 9 | Android: FCM, channel, POST_NOTIFICATIONS, App Links | 1.5d |
| 10 | Token hygiene: receipts, `DeviceNotRegistered` pruning, 60s dedup | 1.5d |
| 11 | Cross-platform QA matrix (2 devices × 2 platforms × 3 app states) | 2d |

**Total: 13.5 days** (range 10–16 depending on credential and device friction)

Tickets 1–3 are the tracer bullet — once those land, a dose logged on one device
notifies another, and everything after is scope and hardening. Ticket 8 is the smallest
item on the list and the most important one for user safety; it should not wait for the
rest.
