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

Cetirizine breaks the existing engine in two ways: it is dosed by **age band** rather than mg/kg, and it is **once daily**, so "next dose" is tomorrow morning, not in six hours. This is precisely why the regimen model in §2 is necessary rather than cosmetic.

A fourth medication, **PEG 3350**, is added in §2.8 as the first `caregiver_specified` entry — Cappy! computes nothing for it and records what a prescriber ordered. It is included in 0.8 specifically to prove the general case, because a scheduled-medication system that only handles medications Cappy! can compute is not a scheduled-medication system.

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
enum DoseBasis: String { case weightBased, ageBand, caregiverSpecified }
enum DosingMode: String { case prn, scheduled }

enum MedicationKind: String, CaseIterable {
    case acetaminophen, ibuprofen, cetirizine, diphenhydramine, peg3350

    var isAntipyretic: Bool { self == .acetaminophen || self == .ibuprofen }
    var isAntihistamine: Bool { self == .cetirizine || self == .diphenhydramine }
    /// Sedating (first-generation) antihistamine — drives the §5 warning copy.
    var isSedatingAntihistamine: Bool { self == .diphenhydramine }

    var doseBasis: DoseBasis {
        switch self {
        case .acetaminophen, .ibuprofen, .diphenhydramine: return .weightBased
        case .cetirizine:                                  return .ageBand
        case .peg3350:                                     return .caregiverSpecified
        }
    }
    /// Suggested default when a caregiver creates a regimen; always overridable.
    var defaultDosingMode: DosingMode {
        switch self {
        case .cetirizine, .peg3350: return .scheduled
        default:                    return .prn
        }
    }
}
```

`doseBasis` is mirrored on the `medications` row (§2.4) so the server can enforce it independently. The Swift enum is a convenience for the client, **not** the authority — a client that computes a dose for a `caregiverSpecified` medication must be rejected server-side, not merely discouraged.

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

## 2. Regimens — PRN vs scheduled, and scheduled-medication tracking

This section replaces the earlier family-level `dosing_mode` design. **The mode belongs to the child, not the family.** Ava takes cetirizine daily at 8 AM; Noah does not. A family-level toggle cannot express that, and it was wrong.

### 2.1 Two orthogonal axes

A medication has a **dose basis** (how much) and a regimen has a **mode** (when). They are independent, and conflating them is what makes medication apps brittle.

**Dose basis — a property of the medication, in the catalog:**

| Basis | Input | Medications |
|---|---|---|
| `weight_based` | weight × mg/kg, capped | acetaminophen, ibuprofen, diphenhydramine |
| `age_band` | date of birth → band → fixed mg | **cetirizine** |
| `caregiver_specified` | **Cappy computes nothing**; the caregiver records what was prescribed | PEG 3350, vitamins, every future Rx |

**Mode — a property of the regimen, per child:**

| Mode | Meaning |
|---|---|
| `prn` | given in response to a symptom |
| `scheduled` | given on a clock regardless of symptoms |

Cetirizine ships as `age_band` + `scheduled`. Diphenhydramine is `weight_based` + `prn`. PEG 3350 is `caregiver_specified` + `scheduled`. Nothing about the design assumes those pairings, which is the point.

### 2.2 Cetirizine: dose from date of birth, zero extra data entry

**Verified: `children.date_of_birth` is `date not null`** (`20260101000000_init.sql`) — captured at child creation and already required. Cetirizine's dose is therefore fully determined by data the app has on day one. No weight, no caregiver input, no setup step.

```swift
static func cetirizineDose(ageMonths: Int) -> MedDose? {
    switch ageMonths {
    case ..<24:   return nil            // hard block — §1.3
    case 24..<72: return band(mg: 2.5, mL: 2.5, max24h: 5)
    case 72..<144: return band(mg: 5,  mL: 5,   max24h: 10)
    default:      return band(mg: 10,  mL: 10,  max24h: 10)
    }
}
```

**The band must be re-evaluated at every occurrence, never frozen at regimen creation.** A child on daily cetirizine will cross the 6-year and 12-year boundaries while the regimen is active. A dose captured once and stored is a dose that silently becomes wrong on a birthday.

This produces a genuinely good product moment, and it should be built deliberately rather than fallen into:

> **Ava turned 6.** Her daily cetirizine dose increases from 2.5 mg (2.5 mL) to 5 mg (5 mL). Cappy! has updated her schedule.

Fire it as a `regimen_dose_changed` notification to all caregivers on the first occurrence after the boundary, and record it in `audit_events`. The dose on the card changed by itself — the caregivers need to be told why, or the app looks broken at best and untrustworthy at worst.

### 2.3 PEG 3350 and the `caregiver_specified` mode

**Cappy! must never compute a PEG 3350 dose.** MiraLAX and its generics are OTC-labeled for **17 years and older**; the label reads "ask a doctor" for 16 and under. Pediatric use is off-label, under physician supervision, typically 0.5–1.5 g/kg/day titrated to effect with a 17 g/day ceiling — and the titration is the prescriber's clinical judgment about *this* child's response, not arithmetic.

Any app that renders a computed pediatric PEG 3350 number is (a) giving off-label dosing guidance it is not qualified to give and (b) inviting exactly the liability the coordination-aid framing exists to avoid.

So the third mode does something different and more honest: **Cappy! records and tracks what someone else decided.**

Regimen creation for a `caregiver_specified` medication captures:

- Amount and unit as free entry with a unit picker (`17 g`, `1 capful`, `half capful`, `8.5 g`)
- Schedule times
- **Provenance, required:** "As directed by ___" — prescriber name, or "our pediatrician", or "the product label"

Every dose card for that medication then displays the amount **with its provenance attached** and no Cappy!-computed figure anywhere on the surface:

```
PEG 3350                          Ava
17 g  ·  once daily, 8:00 AM
As directed by Dr. Okafor
Cappy! does not calculate this dose.
```

That last line is not boilerplate — it is the visible difference between the two kinds of card, and a caregiver should be able to tell at a glance whether the number in front of them came from Cappy! or from their doctor.

This mode is also the **forward compatibility hook for the entire Rx system**: a prescription regimen is a `caregiver_specified` regimen whose provenance is the pharmacy's sig rather than a caregiver's typing. Building it now means `RX-PHARMACY-ARCHITECTURE.md` §7 has somewhere to land.

### 2.4 Schema

```sql
-- 20260729121000_regimens.sql
create type dosing_mode as enum ('prn', 'scheduled');
create type dose_basis  as enum ('weight_based', 'age_band', 'caregiver_specified');

alter table public.medications add column dose_basis dose_basis not null default 'weight_based';

alter table public.families add column timezone text not null default 'America/New_York';

create table public.medication_regimens (
  id                 uuid primary key default gen_random_uuid(),
  child_id           uuid not null references public.children(id) on delete cascade,
  medication_id      uuid not null references public.medications(id),
  mode               dosing_mode not null,
  scheduled_times    time[]      not null default '{}',  -- local wall-clock
  days_of_week       smallint[]  not null default '{0,1,2,3,4,5,6}',
  -- caregiver_specified only; null for computed medications
  specified_amount   numeric(8,3),
  specified_unit     text,
  specified_by       text,                                -- provenance, required when amount is set
  grace_minutes      integer     not null default 120,
  starts_on          date        not null default current_date,
  ends_on            date,                                -- null = ongoing
  active             boolean     not null default true,
  created_by         uuid        not null references public.profiles(id),
  created_at         timestamptz not null default now(),
  constraint specified_needs_provenance
    check (specified_amount is null or (specified_unit is not null and specified_by is not null)),
  constraint scheduled_needs_times
    check (mode <> 'scheduled' or cardinality(scheduled_times) > 0)
);
create unique index on public.medication_regimens (child_id, medication_id) where active;

-- Sparse: holds ONLY deviations. A given dose is a dose_event; a normal
-- day has no row here at all.
create table public.regimen_exceptions (
  regimen_id   uuid not null references public.medication_regimens(id) on delete cascade,
  occurrence_at timestamptz not null,   -- the resolved scheduled instant
  kind         text not null check (kind in ('skipped', 'held', 'missed_ack')),
  note         text,
  recorded_by  uuid not null references public.profiles(id),
  recorded_at  timestamptz not null default now(),
  primary key (regimen_id, occurrence_at)
);

-- Freezes the occurrence a dose was logged against, at log time.
alter table public.dose_events add column scheduled_for timestamptz;
```

RLS: caregivers with access to the child may select; caregivers and admins may write; read-only and guest roles select only. Follow the `caregiver_child_access` policy shape in `20260101000100_rls.sql` — regimens are child-scoped, so family-scoped policies like `family_med_brands` are the wrong template here.

`scheduled_times` is wall-clock, not `timestamptz`, deliberately: an 8 AM daily antihistamine stays at 8 AM across a DST boundary and across travel. Resolve against `families.timezone` at notification time. Backfill that column from the creating device's `TimeZone.current.identifier` on next launch and surface it in Family settings — without it, every family outside US Eastern gets reminders in the wrong hour.

### 2.5 Adherence tracking without a materialization job

The obvious design — a nightly job that materializes a row per scheduled dose per child — is the wrong one. It needs a scheduler, it drifts when a regimen changes, it accumulates rows forever, and it fails silently.

**Occurrences are computed, not stored.** For any `(regimen, date range)`, expand `scheduled_times × days_of_week` against `families.timezone`. Then:

| State | Derivation |
|---|---|
| **Given** | a `dose_events` row whose `scheduled_for` equals the occurrence |
| **Skipped / held** | a `regimen_exceptions` row for the occurrence |
| **Due** | occurrence is now, within grace, nothing recorded |
| **Missed** | occurrence is past grace, nothing recorded |
| **Upcoming** | occurrence is in the future |

Nothing is written for a normal day. `dose_events` already carries the givens; exceptions are rare by construction. Storage is proportional to *deviation*, not to time.

**Why `dose_events.scheduled_for` is written at log time and never re-derived:** if a caregiver moves the schedule from 8 AM to 9 AM in March, re-deriving history would retroactively mark every February dose as an hour late. Freezing the association at log time means changing a schedule changes the future and leaves the record alone. Match rule at log time: nearest occurrence within ±`grace_minutes` on the same local day, else `null` (an off-schedule dose, which is legitimate and should display as such).

**Views to expose:**

- `regimen_adherence(regimen_id, from, to)` → given / missed / skipped counts and a percentage
- `child_schedule_today(child_id)` → today's occurrences with state, powering the dashboard and widget

Show adherence as **counts before percentages** — "given 24 of 28 days" is honest and actionable; "86%" invites a parent to feel graded. Offer a date-ranged export (CSV/PDF) for appointments; a parent handing a GI specialist eight weeks of PEG 3350 adherence data is the concrete payoff for tracking at all.

### 2.6 Behavior by mode

**PRN** — no proactive "it's time." A PRN notification tells a parent to medicate a child who may be fine.
- Widget: *time until next dose is safe*, counting down
- Window-open notification is **opt-in per medication**, framed as permission: *"Ava's next ibuprofen can be given now if she still needs it."*
- Dashboard: under **Recently given** (§4), while inside its interval
- No adherence tracking — there is nothing to adhere to

**Scheduled** — proactive by default.
- Widget: *time until next dose is due*
- Reminder at the due time, **on by default**
- Missed state after grace: *"Ava's cetirizine was due at 8:00 AM."* Sent once, not repeatedly
- Dashboard: under **Today's schedule**, with a **Skip** affordance — a caregiver who deliberately holds a dose must be able to say so, or "missed" becomes noise and the adherence number becomes a lie
- Full adherence history

The two modes must read differently at a glance. If a parent can't tell them apart, the distinction is doing no work.

### 2.7 UI

**Child detail → Medications.** The regimen list lives on the child, next to weight and allergies, because that is where a caregiver already goes to answer "what does Ava take?"

- Each row: medication card styling, mode chip, dose (computed or specified + provenance), schedule summary, adherence sparkline for scheduled meds
- **Add medication** → pick from catalog → mode → dose (auto-filled and read-only for `weight_based` / `age_band`; required entry with provenance for `caregiver_specified`) → times → confirm
- Editing a regimen is audited (`audit_events`, action `regimen_changed`) and notifies other caregivers. Changing what the app will and won't tell someone about a child's medication is not a silent preference change

Reuse `SegmentedControl` for mode and the `brandCard` layout at `FamilyDashboardView.swift:142` for the row treatment.

### 2.8 Catalog addition: PEG 3350

`20260729124000_seed_peg3350.sql`:

| generic_name | concentration_label | formulation | dose_basis | min_age_months | min_interval_hours | max_doses_per_24h |
|---|---|---|---|---|---|---|
| peg3350 | 17 g / capful | powder | caregiver_specified | 0 | 24 | 1 |

`medication_formulation` has no `powder` value — the enum needs extending (`alter type medication_formulation add value 'powder'`). Note that adding an enum value cannot run inside a transaction block in older Postgres; check the Supabase migration runner's behavior before assuming it works.

`min_age_months = 0` is deliberate: the age gate for an off-label medication is the prescriber's, not Cappy!'s, and a hard block would prevent a caregiver from tracking a dose their doctor actually ordered. The card carries the provenance line instead. This is the one place where the conservative default is *not* to block — because here, blocking would be the app substituting its judgment for a physician's.

An asset for the med card exists at `Cappy Design System_6.29.26/assets/Components/PEG3350.png`, alongside `Loratidine.png` and `Fexofenadine.png` — the obvious next two `age_band` antihistamines once this lands.

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
| **0.8.1a** | Regimen model: `medication_regimens`, `regimen_exceptions`, `dose_events.scheduled_for`, `dose_basis`, `families.timezone` | Cetirizine daily regimen created from DOB with zero extra entry |
| **0.8.1b** | Scheduled tracking: computed occurrences, adherence views, skip/hold, Child → Medications UI | Adherence over a 30-day window matches a hand-checked ledger, including a DST boundary |
| **0.8.1c** | PEG 3350 + `caregiver_specified` path + age-band-change notification | No computed number renders for PEG 3350; band change at a simulated 6th birthday notifies and updates |
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
- [ ] Cetirizine regimen created with **no input beyond picking the medication** — dose derives from `children.date_of_birth`
- [ ] Age-band boundary: a child simulated across their 6th and 12th birthdays gets the new dose on the next occurrence, plus a `regimen_dose_changed` notification
- [ ] **No Cappy!-computed number renders anywhere for a `caregiver_specified` medication** — client and server; a client-supplied computed amount is rejected by the API, not just hidden in the UI
- [ ] Adherence over 30 days matches a hand-checked ledger, including a DST transition and a day with a skip
- [ ] Changing a regimen's scheduled time does **not** retroactively alter historical adherence (`scheduled_for` frozen at log time)
- [ ] A dose logged well off-schedule records `scheduled_for = null` and displays as off-schedule rather than being force-matched
- [ ] Missed-dose notification fires once per occurrence, not repeatedly
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
- [MiraLAX (polyethylene glycol 3350) — Drugs.com](https://www.drugs.com/miralax.html) · [Polyethylene glycol 3350 oral route — Mayo Clinic](https://www.mayoclinic.org/drugs-supplements/polyethylene-glycol-3350-oral-route/description/drg-20523233) — OTC label is 17+; "ask a doctor" at 16 and under. Pediatric use is off-label under physician supervision, which is why §2.3 computes nothing.
