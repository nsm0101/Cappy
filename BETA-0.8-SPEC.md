# Cappy! — Beta 0.8 Engineering Spec

**Branch:** `beta-0.8` (cut from `swift` @ `78b590f`)
**Date:** 2026-07-29
**Codebase of record:** `/ios-native` (SwiftUI, `Cappy.xcodeproj`, team H2AGCK2WB8) + Supabase (`cappy-prod` msjmnvegjrycwoedrwym / `cappy-dev` hyfmcwswtjlnxtdspggr) + Cloudflare Worker (`cappy-aasa` on cappy.closedose.com).
**Migration source of truth:** `app/supabase/migrations/` (Expo app itself remains maintenance-only).

---

## Direction

0.6 made Cappy! a safe *single-medication* logger. 0.8 makes it a **multi-caregiver, multi-medication coordination layer**: four OTC medications with genuinely different dosing models, a per-medication PRN/scheduled distinction that drives every downstream behavior, real cross-device push when another caregiver acts, a widget the parent arranges to match their own household, and an accessibility posture that is the actual product argument against a printed Rx label.

Everything in 0.8 is a prerequisite for the Rx/pharmacy system (see `RX-PHARMACY-ARCHITECTURE.md`). Do not treat it as decoration.

---

## ⚠️ Blocking safety defect — fix before anything else

`Dosing.kind(forGeneric:)` (`ios-native/Cappy/Domain/Dosing.swift:180-182`) is:

```swift
static func kind(forGeneric genericName: String) -> MedicationKind {
    genericName.lowercased() == "ibuprofen" ? .ibuprofen : .acetaminophen
}
```

**Every string that is not `"ibuprofen"` resolves to acetaminophen.** Today that is harmless because the catalog holds exactly two medications. The moment a `cetirizine` or `diphenhydramine` row exists, this function silently computes and displays an **acetaminophen dose (15 mg/kg, up to 1000 mg) for an antihistamine**, and `Brands.cardStyle` / `Brands.visual` will paint it with acetaminophen's card. A parent taps a Benadryl sticker and is shown a Tylenol dose in a Tylenol-colored card.

The same fallback pattern exists at:

- `Brands.visual(forGeneric:)` — `Brands.swift:67`, `?? visuals[.acetaminophen]!`
- `Brands.cardStyle(forGeneric:)` — `Brands.swift:108`, `?? cardStyles[.acetaminophen]!`
- `Dosing.dose(_:for:)` — `Dosing.swift:175-177`, a two-branch ternary that cannot express a third medication

**Required change — fail closed, never fall back:**

```swift
static func kind(forGeneric genericName: String) -> MedicationKind? {
    MedicationKind(rawValue: genericName.trimmingCharacters(in: .whitespaces).lowercased())
}
```

Every call site becomes an explicit `guard` that surfaces "This medication isn't supported in this version of Cappy!" and **refuses to open the dose sheet**. A resolvable tag pointing at an unmodeled medication must be a dead end, not a guess. Add a unit test asserting `kind(forGeneric:)` returns `nil` for `""`, `"tylenol"`, `"amoxicillin"`, and `"acetaminophen "`-with-trailing-junk.

This single change is the gate on the whole release.

---

## 1. Medication model — from 2 hardcoded kinds to 4 with distinct dosing regimes

### 1.1 The modeling problem

The four medications do not share a dosing shape:

| Medication | Basis | Interval | 24h cap | Age floor |
|---|---|---|---|---|
| Acetaminophen | weight (15 mg/kg) | q4h infant / q6h | 5 doses | 2 mo |
| Ibuprofen | weight (10 mg/kg) | q6h | 4 doses | 6 mo |
| **Diphenhydramine** | **weight (~1 mg/kg)** | **q6h** | **6 doses** | **2 yr (hard), 6 yr (soft)** |
| **Cetirizine** | **age band, not weight** | **q24h** | **1 dose** | **2 yr (hard), 6 yr (soft)** |

Cetirizine breaks the existing engine in two ways: it is dosed by **age band** rather than mg/kg, and it is **once daily**, so "next dose" is tomorrow morning, not in six hours. This is precisely why the PRN/scheduled distinction in §2 is necessary rather than cosmetic.

### 1.2 Verified dosing data

Sourced from Children's Hospital Colorado pediatric dose tables (cross-checked against OTC Drug Facts labeling). Recorded here so the implementation is auditable; mirror into `ios-native/OTC-DOSING-REFERENCE.md`.

**Diphenhydramine — liquid 12.5 mg / 5 mL, weight-based, q6h, max 6 doses/24h**

| Weight (lbs) | Weight (kg) | Dose | Volume |
|---|---|---|---|
| 20–24 | 9.1–10.9 | 10 mg | 4 mL |
| 25–37 | 11.3–16.8 | 12.5 mg | 5 mL |
| 38–49 | 17.2–22.2 | 18.75 mg | 7.5 mL |
| 50–99 | 22.7–44.9 | 25 mg | 10 mL |
| 100+ | 45.4+ | 50 mg (adult) | 20 mL |

Implement as **≈1 mg/kg per dose, rounded to the nearest 1.25 mg (0.5 mL) increment, capped at 50 mg** — this reproduces the table within measurement tolerance and degrades gracefully off the ends. Round *down* at band boundaries.

**Cetirizine — liquid 5 mg / 5 mL, age-based, once daily**

| Age | Dose | Volume | 24h max |
|---|---|---|---|
| 2–5 yr | 2.5 mg | 2.5 mL | 5 mg |
| 6–11 yr | 5 mg | 5 mL | 10 mg |
| 12+ yr | 10 mg | 10 mL | 10 mg |

Weight is **ignored** for cetirizine. The dose sheet must not display a weight-derived figure for it.

### 1.3 Age gating — conservative by construction

Both antihistamines get a two-tier gate. Cappy! takes the **more restrictive** of the CHCO guidance and the OTC Drug Facts label in every case.

- **Hard block, < 24 months (both):** no dose is computed or displayed. Copy: *"Not for children under 2. Call your child's doctor."* The sheet shows the emergency/contact affordance already used by `AgeGate.emergency`, and the log button is absent — not disabled-and-tappable.
- **Soft gate, 24–71 months (both):** dose is computed but the primary action is blocked behind an explicit acknowledgment row — *"For children 2–5, ask your doctor before giving. I've spoken with my child's doctor about this medication."* Acknowledgment is persisted per `(child_id, medication_id)` in `child_medication_acks` so it is asked once per child per medication, not every dose. This is a distinct interaction from the admin passcode; do not reuse it.
- **Diphenhydramine, colds:** never surfaced as an indication. The dose sheet's indication picker offers *allergy symptoms / hives / itching* only.

Extend `AgeGate` with a `.blocked(reason:)` case rather than overloading `.emergency`, whose copy is fever-specific.

### 1.4 Type changes

```swift
enum MedicationKind: String, CaseIterable {
    case acetaminophen, ibuprofen, cetirizine, diphenhydramine

    var isAntipyretic: Bool { self == .acetaminophen || self == .ibuprofen }
    var isAntihistamine: Bool { self == .cetirizine || self == .diphenhydramine }
    /// Sedating (first-generation) antihistamine — drives the §5 warning copy.
    var isSedatingAntihistamine: Bool { self == .diphenhydramine }
    var dosingBasis: DosingBasis { self == .cetirizine ? .ageBand : .weight }
    var defaultDosingMode: DosingMode { self == .cetirizine ? .scheduled : .prn }
}
```

`DosingResult` becomes `[MedicationKind: MedDose]` keyed storage rather than two optional named fields, so adding a fifth medication is a catalog change, not a struct change.

### 1.5 Tag slugs

Extend `Tags.wellKnownSlugs` (`Domain/Tags.swift:20`):

```swift
"ace-child": .acetaminophen,
"ibu-child": .ibuprofen,
"cet-child": .cetirizine,      // https://cappy.closedose.com/t/cet-child
"dip-child": .diphenhydramine  // https://cappy.closedose.com/t/dip-child
```

The existing parser already accepts full URL / `cappy://` / bare-slug forms and the 4–32 char pattern, so no parser change is needed. **`aasa-worker.js` must be updated** to serve the branded fallback page for the two new slugs — a tag that resolves in-app but 404s on the web is a broken first-run experience for anyone who taps before installing.

### 1.6 Card styling

Two new imagesets are already installed at `Cappy/Resources/Assets.xcassets/`:

- `MedLogoCetirizine.imageset` (540×307 @3x)
- `MedLogoDiphenhydramine.imageset` (540×171 @3x)

Both were background-keyed to transparent and use **`original` rendering intent**, not `template` — unlike the existing two, these lockups are multi-color and must not be tinted.

Proposed `MedCardStyle` entries (tune after a visual pass on device):

```swift
.cetirizine: MedCardStyle(displayName: "Cetirizine",
                          band: Color(cappy: "#C0341F"),   // deep red-orange
                          bandText: .white,
                          panel: Color(cappy: "#EDF3E0"),  // pale green
                          uppercased: false,
                          logoAsset: "MedLogoCetirizine",
                          logoHeight: 56),
.diphenhydramine: MedCardStyle(displayName: "Diphenhydramine",
                               band: Color(cappy: "#D8447E"),   // magenta
                               bandText: .white,
                               panel: Color(cappy: "#E6ECF7"),  // pale blue
                               uppercased: false,
                               logoAsset: "MedLogoDiphenhydramine",
                               logoHeight: 40)
```

Rationale: each band is chosen to *contrast* its lockup rather than match it, because the lockups carry their own color. The cetirizine leaf reads against red-orange; the navy diphenhydramine capsule reads against magenta. Verify both at the largest Dynamic Type size before locking.

> **Trade dress note.** `Brands.swift:5-7` already records the standing rule: accent colors and generic names only, no third-party logos or trade dress. These two lockups are closer to the reference products' visual identity than the existing acetaminophen/ibuprofen treatments are. Distinctive packaging color and layout can be protected as trade dress independent of the word mark, and the risk is *higher*, not lower, when the product is commercialized and IP-forward. Have counsel clear both lockups in the same engagement as the provisional. This is a business decision, flagged rather than made here.

### 1.7 Catalog migration

`20260729120000_seed_antihistamines.sql` — insert into `public.medications`:

| generic_name | concentration_label | mg_per_ml | formulation | min_age_months | min_interval_hours | max_doses_per_24h |
|---|---|---|---|---|---|---|
| cetirizine | 5 mg / 5 mL | 1.0 | liquid_suspension | 24 | 24 | 1 |
| diphenhydramine | 12.5 mg / 5 mL | 2.5 | liquid_suspension | 24 | 6 | 6 |

Also add chewable rows (cetirizine 5 mg, diphenhydramine 12.5 mg) — `formulation = 'chewable'`, matching the existing ibuprofen product pattern in `20260702040000_seed_ibuprofen_products.sql`.

**Verified against `20260702013000_dose_status_age_and_24h_cap.sql`:** `compute_dose_status` reads `min_interval_hours` and `max_doses_per_24h` off the medication row, so the q24h / 1-dose cetirizine rule and the q6h / 6-dose diphenhydramine rule **enforce server-side with no RPC change**. Confirm with a live test anyway (§9).

One wrinkle worth knowing before you touch it — the RPC hardcodes a generic-name allowlist:

```sql
if lower(v_generic) in ('acetaminophen', 'ibuprofen') and v_age_months >= 6 then
  v_interval := make_interval(hours => greatest(v_min_hours, 6));
else
  v_interval := make_interval(hours => v_min_hours);
end if;
```

Both new medications fall to the `else` branch and use `min_interval_hours` verbatim, which is correct. But this is a **second location where medication knowledge is hardcoded**, alongside the Swift defect in §0. Leave the branch alone for 0.8 — changing it risks the antipyretic path — and file a follow-up to drive the age-aware floor from a `medications` column instead of a SQL string list.

---

## 2. PRN vs scheduled

### 2.1 Semantics

A per-`(family, medication)` mode, defaulting from `MedicationKind.defaultDosingMode`, overridable by an admin, stored server-side so every caregiver device agrees.

**PRN (as needed)** — the med is given in response to a symptom.
- Widget shows *time until next dose is safe*, counting down.
- No proactive "it's time" notification. A PRN notification would be telling a parent to medicate a child who may be fine.
- Notification on window-open is **opt-in per medication** and framed as permission, not instruction: *"Ava's next ibuprofen can be given now if she still needs it."*
- Dashboard shows it under **Recently given** (§4) while inside its interval.

**Scheduled** — the med is given on a clock regardless of symptoms.
- Widget shows *time until next dose is due*.
- Proactive reminder at the due time, **on by default** for that medication.
- Missed-dose state after a grace window (default 2h, per-medication configurable): *"Ava's cetirizine was due at 8:00 AM."*
- Dashboard shows it under **Today's schedule**.

The two modes must produce visibly different widget and dashboard language. If a parent cannot tell them apart at a glance, the setting is doing nothing.

### 2.2 Schema

```sql
-- 20260729121000_dosing_mode.sql
create type dosing_mode as enum ('prn', 'scheduled');

create table public.family_medication_settings (
  family_id       uuid not null references public.families(id) on delete cascade,
  medication_id   uuid not null references public.medications(id),
  dosing_mode     dosing_mode not null default 'prn',
  scheduled_times time[]      not null default '{}',   -- local wall-clock, e.g. {08:00}
  grace_minutes   integer     not null default 120,
  updated_by      uuid        not null references public.profiles(id),
  updated_at      timestamptz not null default now(),
  primary key (family_id, medication_id)
);
```

RLS: family members select; admins insert/update. Follow the `family_med_brands` policy shape (`20260630134022`) exactly — it is the closest existing analogue and is already reviewed.

`scheduled_times` is wall-clock, not timestamptz, deliberately: an 8 AM daily antihistamine should stay at 8 AM across a DST boundary and across travel. Resolve against the family's timezone at notification time.

**Verified: `families` has no `timezone` column** — no migration in `app/supabase/migrations/` defines one. This migration must add it:

```sql
alter table public.families add column timezone text not null default 'America/New_York';
```

Backfill from the creating device's `TimeZone.current.identifier` on next app launch, and expose it in Family settings. Without this, scheduled reminders fire in the wrong hour for every family outside US Eastern.

### 2.3 UI

Family → Medications. One row per medication in the family's catalog: segmented PRN / Scheduled, and when Scheduled, a time-of-day list with add/remove. Reuse `SegmentedControl` and the `brandCard` layout in `FamilyDashboardView.swift:142`. Changing the mode is an audited event (`audit_events`, action `medication_mode_changed`) — it changes what the app will and won't tell a caregiver.

---

## 3. Cross-caregiver notifications

### 3.1 What exists vs what's needed

`ReminderService` (`Services/Notifications/ReminderService.swift`) schedules **local** `UNCalendarNotificationTrigger`s only, and `ReminderService.isEnabled` is one global on/off boolean in `UserDefaults`. A local notification cannot fire on Dad's phone because Mom logged a dose. `RealtimeService` gives live updates only while the app is foregrounded.

**0.8 requires real APNs push.** This is the single largest piece of new infrastructure in the release.

### 3.2 Architecture

```
dose_events INSERT
  → AFTER INSERT trigger (notify_dose_logged)
  → pg_net async POST → Edge Function `push-dose-logged`
      ├─ load family caregivers, minus the logger
      ├─ filter by caregiver_notification_prefs for (medication, event_type)
      ├─ suppress if a matching push went out < 60s ago (idempotency)
      └─ APNs HTTP/2, token auth (.p8), per-device
  → device_push_tokens (invalid tokens pruned on 410 Gone)
```

Decisions:

- **APNs token auth (.p8)**, not certificates — no annual expiry.
- **Edge Function, not a queue.** At beta volume a direct `pg_net` call is right. Revisit only if p99 latency exceeds ~5s.
- **Payload carries no PHI.** `"Ryan logged a dose for Ava"` — never the medication, dose, or condition. Notifications render on a locked screen in public. The medication name lives behind the tap, inside the authenticated app. This is both a HIPAA posture and a plain-decency call; it also keeps the notification path out of scope for a lot of compliance review.
- **`apns-collapse-id`** per `(child_id, medication_id, event_type)` so a flurry of corrections collapses to one banner.
- **Dose logged offline and synced later** must not fire a "just now" push. Trigger compares `given_at` to `now()`; skip push if the dose is more than 15 minutes stale, since the coordination value has expired.

### 3.3 Preference matrix

Replace the single global boolean with a per-caregiver, per-medication, per-event-type grid:

```sql
-- 20260729122000_notification_prefs.sql
create type notification_event as enum (
  'dose_logged_by_other',   -- another caregiver logged a dose
  'dose_window_open',       -- PRN: next dose is now safe
  'dose_due',               -- scheduled: it's time
  'dose_missed',            -- scheduled: past grace window
  'interaction_warning',    -- §5 antihistamine overlap
  'max_reached'             -- 24h cap hit
);

create table public.caregiver_notification_prefs (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  family_id     uuid not null references public.families(id) on delete cascade,
  medication_id uuid references public.medications(id),  -- null = applies to all
  event_type    notification_event not null,
  enabled       boolean not null default true,
  primary key (user_id, family_id, coalesce(medication_id, '00000000-0000-0000-0000-000000000000'::uuid), event_type)
);
```

*(Postgres will not accept `coalesce` in a PK — implement as a generated column `medication_key uuid generated always as (coalesce(medication_id, '000…0'::uuid)) stored` and key on that. Noted here so the implementer doesn't discover it at `psql` time.)*

Resolution order: exact `(user, family, medication, event)` → `(user, family, null, event)` → the event type's default. Defaults: `dose_logged_by_other` **on**, `dose_due`/`dose_missed` **on**, `interaction_warning` and `max_reached` **on and not disableable** (safety events), `dose_window_open` **off** (opt-in per §2.1).

### 3.4 Quiet hours

Per-caregiver quiet-hours window in `caregiver_notification_prefs`' sibling table or `profiles`. Safety events (`interaction_warning`, `max_reached`) ignore quiet hours and use a critical-alert-adjacent presentation. Everything else is held until the window closes, or dropped if it has gone stale — a 3 AM dose notification delivered at 7 AM is noise.

### 3.5 Settings UI

`SettingsView` gets a Notifications screen: master toggle → per-event-type rows → per-medication disclosure under each. Safety rows render with a lock affordance and an explanatory footnote rather than a disabled switch that looks broken.

---

## 4. Dashboard — remove status tags, show recent activity

### 4.1 Remove

`HomeView.swift:172` currently renders `DosePill(label: item.status.homeLabel, status: item.status)` on every child row — "Due now" / "Too early" / "Given recently". Delete this.

The reasoning is worth recording: on a **PRN** medication, "Due now" is wrong in the way that matters. Nothing is due. The child may be perfectly well. A standing green "Due now" badge on a healthy child's row nudges toward unnecessary medication, and it is the single most likely thing in the current UI to cause a dose that shouldn't have happened.

### 4.2 Replace with

Each child row gains a **RecentMedsStrip** — a compact horizontal run of chips, one per OTC PRN medication given inside its active window:

```
Ava    [🔴 Acet 2h 10m]  [🩷 Diphen 4h 55m]
Noah   no medications in the last 24h
```

- Chip = medication's `band` color at low opacity + its `MedVisual.letter` + **time remaining until the next dose is safe**, counting down.
- Chips disappear when the interval expires. An empty strip is the resting state and reads as "nothing on board" — which is the information a parent actually wants at a glance.
- Sorted soonest-expiring first, capped at 3 with a `+N` overflow chip.
- Scheduled medications appear in a separate, visually quieter line: `Cetirizine · daily 8:00 AM · given today`.

Status semantics do **not** disappear — they move to the dose sheet, at the moment of decision, where `DoseStatus.caregiverLabel` already lives and where a "Too early" is actionable. This is a relocation, not a removal.

### 4.3 Same component in the widget

`RecentMedsStrip` is designed once and used in `HomeView` and `NextDoseWidget`, so it lives in `Shared/`.

**Verified in `ios-native/project.yml`:** both `Cappy` and `CappyWidgetExtension` list `- path: Shared` as a source root, so the whole directory compiles into both targets. Dropping a file into `Shared/` is sufficient — no target-membership edit. Because XcodeGen enumerates the folder, **run `xcodegen generate` after adding it**, or the committed `Cappy.xcodeproj` won't see the file.

Constraint: `Shared/` code compiles into an app extension, so keep `RecentMedsStrip` free of `AppModel`, the theme environment, and anything UIKit-app-only. Pass a value type in.

---

## 5. Antihistamine interaction warning

### 5.1 Rule

When a caregiver opens the dose sheet for **cetirizine** and the child has an active **diphenhydramine** dose within the last 6 hours — or opens **diphenhydramine** with an active **cetirizine** dose within the last 24 hours — show a blocking-but-overridable interstitial before the log action.

Asymmetric windows are deliberate: cetirizine's duration of action is ~24h, diphenhydramine's ~4–6h.

### 5.2 Copy

> **Two antihistamines**
> Ava was given diphenhydramine 2 hours ago. Giving cetirizine now means two antihistamines at once, which increases drowsiness and side effects without adding benefit.
> Talk to your pharmacist or your child's doctor before giving this.
>
> [ Don't give ] [ I've been advised to give both ]

Secondary action requires an explicit tap, is recorded in `audit_events` with action `interaction_override`, and fires an `interaction_warning` push to other caregivers. Not disableable in settings.

### 5.3 Generalize the mechanism

Do not hardcode the pair. Add a small table so the next interaction is a data change:

```sql
-- 20260729123000_med_interactions.sql
create table public.medication_interactions (
  id            uuid primary key default gen_random_uuid(),
  class_a       text not null,     -- 'antihistamine'
  class_b       text not null,
  window_a_hours integer not null, -- lookback for a dose of class_a
  window_b_hours integer not null,
  severity      text not null default 'warn' check (severity in ('warn','block')),
  title         text not null,
  body          text not null
);
alter table public.medications add column med_class text;  -- 'antipyretic' | 'antihistamine'
```

Seed the antihistamine–antihistamine pair. Duplicate-generic (two acetaminophen products) is already covered by `compute_dose_status`; this table is for *cross-generic* conflicts.

`med_class` also gives §4's chip grouping and the Rx system a place to hang class-level rules later.

---

## 6. Widget — customization and reordering

Per the decision on approach: **in-app ordering persisted to the App Group**, not `AppIntentConfiguration`.

To be clear about the tradeoff — the deployment target is **iOS 17.0** (`project.yml`), so `AppIntentConfiguration` is available and was not ruled out on compatibility grounds. It was ruled out on UX grounds: Apple's widget-configuration sheet has no drag-to-reorder affordance, and reordering is the actual ask. In-app ordering also gives one household order shared by every widget instance, which matches how a family reasons about it. Revisit if users start asking for two differently-scoped widgets on one home screen.

### 6.1 Snapshot v2

`SharedDoseSnapshot` (`Shared/AppGroup.swift`) is currently `[Child(id, name, statusRaw, nextSafeAt)]` — one status per child, no medication dimension. It cannot express "Ava: acetaminophen 2h10m, diphenhydramine 4h55m."

```swift
struct SharedDoseSnapshot: Codable {
    struct Row: Codable, Identifiable {
        let id: String            // "\(childId):\(medicationId)"
        let memberId: String
        let memberName: String
        let medicationKey: String // MedicationKind raw value
        let medicationLabel: String
        let modeRaw: String       // "prn" | "scheduled"
        let statusRaw: String
        let nextSafeAt: String?
        let lastGivenAt: String?
        let bandHex: String       // widget can't reach the app's Brands table
    }
    var familyName: String
    var rows: [Row]               // already in the user's chosen order
    var updatedAt: Date
    var schemaVersion: Int = 2
}
```

`schemaVersion` matters: a widget from the previous build will be alive on a home screen when the app updates. Decode failure must render the "Open Cappy!" empty state, never crash the widget extension.

### 6.2 Ordering UI

Settings → Widget. A `List` of `(member × medication)` rows with `.onMove` and per-row visibility toggles, `EditButton` for reorder mode. Persist an ordered `[String]` of row IDs to the App Group; the app sorts `rows` by it on every write, so the widget stays a dumb renderer. Rows not in the saved order append at the end in catalog order — new medications appear rather than vanishing.

`WidgetCenter.shared.reloadAllTimelines()` on every save. `HomeView.publishWidget()` (`HomeView.swift:212`) is the existing hook; extend rather than duplicate.

### 6.3 Rendering

- **Small:** family name + top 2 rows.
- **Medium:** up to 4 rows, member avatar initial + med chip + countdown.
- **Large (new):** grouped by member, all visible rows, scheduled section separated.

Countdowns use `Text(date, style: .timer)` so they tick without a timeline reload. The 15-minute refresh cadence at `NextDoseWidget.swift:32` stays as the backstop for status transitions.

---

## 7. Accessibility

The pitch is that a bright, large, high-contrast phone screen beats a small-print Rx label. That claim has to survive an audit, so this is a graded workstream, not a pass with the inspector.

**Target: WCAG 2.2 AA, plus the platform affordances an Apple review will look for.**

1. **Dynamic Type to AX5, no truncation.** Every `CappyFont` size scales; `DosePill`, `RecentMedsStrip` chips, and dose-sheet numerals reflow to vertical stacks past `.accessibilityLarge`. Audit each screen at AX5 — the dose card band and the new chips are the likeliest breakages.
2. **Contrast.** All 10 themes audited for 4.5:1 body / 3:1 large and UI. Dose-status colors are already theme-invariant for safety (0.6 decision) — verify the two new card palettes in §1.6 pass against `bandText` in every theme, and honor `.accessibilityIncreasedContrast` with a higher-contrast variant set.
3. **VoiceOver.** Every dose figure gets an explicit `accessibilityLabel` that spells out units: `"7.5 milliliters, 18.75 milligrams"` — not `"7.5 mL"`, which VoiceOver reads as "7.5 em ell". Chips combine into one element: `"Ava, acetaminophen, next dose safe in 2 hours 10 minutes"`. Custom rotor for jumping between children. Full pass with the screen curtain on, not just the accessibility inspector.
4. **Never color-alone.** Every dose-status color pairs with text and an SF Symbol. ~8% of men have a color vision deficiency; a red/green safe-vs-unsafe distinction is the exact failure case.
5. **Reduce Motion.** `SuccessOverlay` and the dose-clock animation respect `.accessibilityReduceMotion` with a cross-fade path.
6. **Tap targets ≥ 44pt.** `Space.tapMin` exists — enforce it in a snapshot test rather than by inspection.
7. **A one-handed, dark-adapted 2 AM mode.** Not a WCAG item, the real use case: primary actions in the bottom third, a Settings option to cap widget/dose-sheet brightness and shift to warm tones so the screen doesn't wake the child being dosed.
8. **VoiceOver-navigable NFC scan.** The scan screen is the entry point; if it isn't operable by a blind caregiver the rest doesn't matter. Test the full cold-launch → tag → dose sheet → log path under VoiceOver.
9. **Speak the dose.** An explicit "Read this dose aloud" button using `AVSpeechSynthesizer`, independent of VoiceOver being enabled — for low-vision caregivers, caregivers without reading glasses at 2 AM, and low-literacy caregivers. This is the feature that most directly substantiates the accessibility claim in the disclosure, and it is small.

Adopt `xclaude-plugin:accessibility-testing` for the automated portion and add an AX5 + contrast gate to CI.

---

## 8. Phasing

| Phase | Contents | Gate |
|---|---|---|
| **0.8.0-a** | §0 safety fix + `MedicationKind` refactor + tests | No behavior change; the refactor lands clean |
| **0.8.0-b** | Migrations (meds, dosing_mode, prefs, interactions) on `cappy-dev` | `compute_dose_status` verified against a q24h medication |
| **0.8.0-c** | Cetirizine + diphenhydramine end-to-end: slugs, dosing, cards, age gates, aasa-worker | Physical tag tap → correct card → correct dose |
| **0.8.0-d** | Interaction warning + override audit | Both directions, both windows |
| **0.8.1** | PRN/scheduled modes + Family → Medications UI | Modes visibly change dashboard + widget language |
| **0.8.2** | APNs infra, device tokens, Edge Function, preference matrix | Dose on device A → push on device B < 5s |
| **0.8.3** | Dashboard RecentMedsStrip + widget v2 + ordering UI | Snapshot v1 → v2 upgrade doesn't crash a live widget |
| **0.8.4** | Accessibility program + CI gates | AX5 clean, VoiceOver path complete |

`0.8.0-a` and `0.8.0-b` are prerequisites for everything. `0.8.2` and `0.8.3` are independent and can run in parallel.

---

## 9. Verification

Before merge:

- [ ] `kind(forGeneric:)` returns `nil` for unknown input; no call site falls back to a medication (unit + a grep asserting no `?? .acetaminophen` remains)
- [ ] A tag resolving to an unmodeled medication shows an error and **cannot** open the dose sheet
- [ ] `compute_dose_status` enforces `min_interval_hours = 24, max_doses_per_24h = 1` for cetirizine — **tested directly against the RPC, not assumed from reading the SQL**
- [ ] Under-24-month child: no dose computed, no log affordance, for both antihistamines
- [ ] 24–71 month child: acknowledgment required once, then persisted
- [ ] Dosing outputs match the §1.2 tables at every band boundary and 1 lb either side
- [ ] Interaction warning fires in both directions at the correct asymmetric windows; override is audited and pushes
- [ ] Offline dose synced 2h later does not fire a "just now" push
- [ ] Push payloads contain no medication name, dose, or condition
- [ ] Widget built against snapshot v1 renders the empty state (not a crash) after upgrade to v2
- [ ] Every screen at AX5 with no truncation or overlap; VoiceOver cold-launch → log path complete
- [ ] `aasa-worker.js` serves `cet-child` and `dip-child`

**Not-medical-advice disclaimer** must remain on every surface that displays a computed dose, including the two new cards and any spoken output.

---

## Sources

Pediatric dosing verified 2026-07-29 against:

- [Diphenhydramine (Benadryl) Dose Table — Children's Hospital Colorado](https://www.childrenscolorado.org/conditions-and-advice/conditions-and-symptoms/dosagetables/pediatric/diphenhydramine-benadryl-dose-table/)
- [Cetirizine (Zyrtec) Dose Table — Children's Hospital Colorado](https://www.childrenscolorado.org/conditions-and-advice/conditions-and-symptoms/dosagetables/pediatric/cetirizine-zyrtec-dose-table/)
- [ZYRTEC® Dosing Guide](https://www.zyrtec.com/products/zyrtec-dosage-guide)
- [BENADRYL® Dosing Guide](https://www.benadryl.com/benadryl-dosing-guide)
