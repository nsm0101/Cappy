# Cappy 90-Day Alpha Plan

**Strategic goal:** Ship a closed alpha to 10-25 design-partner families by
day 90, demonstrating end-to-end NFC-tap-to-shared-dose-log on iOS, with
HIPAA-aligned architecture in place even though the formal audit will come
later.

**Definition of "alpha shipped":**
1. iOS app installable via TestFlight to invited families
2. NFC tap on a programmed NTAG215 sticker opens the app to the right
   medication+child quick-action screen in <1 second
3. A caregiver can log an acetaminophen dose; all other authorized caregivers
   in the family see the update within 5 seconds
4. Per-family roles (admin / caregiver / read-only) work and are enforced
5. Families can be created, caregivers invited via a 6-digit code, and access
   revoked
6. Audit log captures every dose event with attribution
7. PHI fields are encrypted at rest with envelope encryption
8. Privacy Policy and Terms of Service are published (drafted by us, reviewed
   by an attorney before any real family onboards)
9. We have at least one committed design-partner family ready to install

## Scope discipline — what is OUT of alpha

Document these clearly so we do not creep into them:

- Android app (deferred to month 4)
- Prescription medications (deferred; alpha is OTC acetaminophen only)
- Multiple medications per family (alpha supports the one-medication case)
- Notifications (push notifications deferred to beta — alpha relies on
  WebSocket realtime when app is open)
- Weight-based dosing recommendations (deferred — alpha shows weight, does
  not calculate doses)
- Medication catalog (alpha hardcodes acetaminophen variants; full catalog
  is post-alpha)
- Multi-family per user (alpha = one family per user)
- The de-identified analytics pipeline (post-alpha — needs material data
  volume to be useful)
- Custom NFC tag manufacturing (alpha uses generic NTAG215 stickers we
  program manually)
- The admin web console (CLI scripts suffice for alpha-stage operations)
- Notifications, ibuprofen, multi-med — explicitly deferred
- SOC 2 audit (deferred until post-funding)

## Milestones

### Milestone 0 — Foundation (days 1-7)

**Goal:** Repo is set up, vendors are chosen, BAAs are in flight, the
development loop works.

Deliverables:
- This repository fully populated from the foundation kit
- Supabase project created (Pro tier, BAA requested)
- Cloudflare R2 bucket for object storage (or AWS S3, see ADR-0003)
- GitHub repository with branch protection on `main`
- CI pipeline running on every PR (lint, typecheck, test, security scan)
- Apple Developer account active
- Postmark or Resend account (BAA tier)
- Sentry account (HIPAA tier)
- Local dev environment runs `pnpm dev` and serves a healthcheck endpoint
- Founder has scheduled an initial healthcare attorney consult

Exit criteria: Orchestrator can dispatch a ticket end-to-end through CI
to a deployed staging environment, with all logs and monitoring visible.

### Milestone 1 — Backend core (days 8-28)

**Goal:** Backend implements the data model, identity, family/caregiver
management, and dose event logging with full audit trail.

Deliverables:
- Postgres schema migrated, including all tables in `/contracts/schema/`
- Identity service: signup, login, MFA enrollment (TOTP), session management
- Family service: create family, invite caregiver via code, accept invite,
  list members, revoke access
- Authorization service (OPA-style policy in code, not yet a separate
  process): role × family × child × action checks
- Children service: add child, update weight, list children
- Medication catalog (hardcoded acetaminophen variants — infant drops, child
  suspension, chewable)
- NFC resolver: given a tag UID, return medication + family context
- Dose event service: log dose, list timeline, correct dose
- Audit service: every state change emits an audit row
- Realtime channel publication on dose events
- Field-level encryption for PHI
- 80%+ test coverage on safety-critical paths

Exit criteria: Postman collection exercises every endpoint successfully
against the staging environment.

### Milestone 2 — iOS app skeleton (days 22-49, overlaps Milestone 1)

**Goal:** iOS app exists, handles auth, displays a family/child/medication
hierarchy, and reads NFC tags.

Deliverables:
- Xcode project at `/ios/`, builds clean
- SwiftUI app with navigation: signup → home → family → child → dose timeline
- Sign-in / sign-up flows wired to backend
- NFC reading implemented (Core NFC, NDEF tag reading)
- Local persistence with Core Data for offline cache
- API client generated from OpenAPI spec
- WebSocket client subscribes to family channel
- Light and dark mode supported
- Basic VoiceOver labels

Exit criteria: founder can install on a real device via Xcode, sign up,
create a family, add a child, and read an NFC tag UID.

### Milestone 3 — Critical path integration (days 50-70)

**Goal:** The whole NFC tap → quick screen → dose log → realtime fanout
journey works end-to-end with two real devices.

Deliverables:
- NFC tag programming utility (CLI script that prints a tag with a UID
  and registers it with backend)
- Quick-action screen renders in <1 second after tap
- Dose logging flow with confirmation
- Realtime sync verified: device A logs, device B sees within 5 seconds
- Conflict handling: simultaneous logs on two devices both succeed,
  both visible in timeline, no double-counting
- Offline log queue: log a dose in airplane mode, verify it syncs on
  reconnection
- Caregiver invite flow tested end-to-end with two real Apple IDs

Exit criteria: founder demonstrates the full journey on two devices to
themselves; records a screen capture for investor decks.

### Milestone 4 — Alpha hardening and family onboarding (days 71-90)

**Goal:** Ready to put in real families' hands.

Deliverables:
- Privacy Policy and Terms of Service drafted, attorney-reviewed,
  published in app and on a marketing site
- Caregiver consent flow on first launch
- TestFlight build distributed to internal testers (founder + 2-3 trusted)
- Bugfix sprint based on internal testing
- TestFlight invitation sent to 10-25 design-partner families
- Onboarding email sequence (1 welcome, 1 day-3 check-in, 1 day-14 feedback)
- Founder feedback intake form (Tally or Typeform)
- Sentry monitoring confirmed working with PHI redaction verified
- Backup restore tested at least once
- Incident response runbook in place
- BAA register complete for every vendor in the production data path

Exit criteria: at least one real family completes a real dose-tracking
session and provides feedback.

## Risk register (top 5)

| # | Risk | Mitigation |
|---|------|-----------|
| 1 | NFC behavior on iOS is fussier than expected; tap-to-screen takes >2s | Build the NFC spike in week 1 of Milestone 2, not last |
| 2 | Supabase BAA approval slow or denied | Have Plan B ready: AWS RDS + Supabase OSS self-hosted, or Neon |
| 3 | Attorney engagement slow, blocking publication of legal docs | Schedule attorney intro call in week 1; draft docs in parallel |
| 4 | Founder bandwidth — too many simultaneous specialist outputs to review | Cap parallelism at 3 tickets; daily briefing format keeps surface area small |
| 5 | Real family finds critical safety bug post-launch | Internal-only testing for full week before family invites; explicit "this is alpha software" consent screen |

## How this plan is updated

The Orchestrator updates this file at the end of every week with: what
shipped, what slipped, what changed in the plan. Material changes to
milestones require founder approval. Cosmetic edits do not.
