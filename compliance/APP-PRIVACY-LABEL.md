# App Store Privacy "Nutrition Label" — Cappy! (draft 2026-07-04)

Draft answers for App Store Connect → App Privacy. Consumer posture (Posture C). Review with counsel alongside LEG-1. Update if D13 (HealthKit weight import) ships in the submitted build.

## Data collection summary

Cappy collects data that IS linked to identity (accounts exist), and does NOT use data for tracking (no ads, no third-party ad SDKs, no data brokers).

## Data types collected

**Contact Info**
- Email address — app functionality (account/auth). Linked to user. Not used for tracking.
- Name — app functionality (caregiver first/last name, child display name; dose attribution). Linked. Not tracking.

**Health & Fitness**
- Health — app functionality (dose logs: medication, amount, timestamps; child weight for weight-based dose ranges; allergies). Linked. Not tracking.
- If D13 ships: HealthKit weight import — app functionality only; HealthKit data never used for marketing/ads (Apple requirement) and never shared with third parties.

**Sensitive Info**
- Date of birth (caregiver + child) — app functionality (age-aware dosing intervals, age display). Linked. Not tracking. *(Declare under "Other Data Types" or Sensitive Info per current ASC categories.)*

**User Content**
- Photos — app functionality (child/caregiver avatars, optional). Linked. Not tracking.
- Other user content — family names, invite codes. Linked. Not tracking.

**Identifiers**
- User ID — app functionality (Supabase auth UUID). Linked. Not tracking.

**Diagnostics** (once Sentry is active in build 3+)
- Crash data & performance data — app functionality/analytics. NOT linked (PII scrubbed in `src/lib/monitoring.ts` — verify breadcrumb scrubbing before declaring "not linked"). Not tracking.

## Not collected

Location, browsing history, search history, contacts, financial info, messages, audio, purchase history, advertising identifiers.

## Third parties receiving data

- Supabase (hosting/database/auth) — service provider.
- Sentry (crash reporting, once active) — service provider, PII scrubbed.
- Apple (Sign in with Apple, HealthKit if enabled) — platform.
No sale of data. No sharing for advertising.

## Kids' data note (COPPA)

Child profiles (name, DOB, weight, photo, dose logs) are entered by the parent/guardian caregiver — parental consent is inherent to account flow, captured via `consent_accepted_at`/`consent_version`. App is rated for adults (caregivers); not directed at children. Confirm framing with counsel.

## Open items before submission

1. Counsel review with LEG-1 docs.
2. Confirm Sentry "not linked" claim after verifying scrubbing.
3. Re-check ASC category names at submission time (they shift).
4. If D13 ships: add Health & Fitness → Health "read" disclosure + HealthKit usage strings.
