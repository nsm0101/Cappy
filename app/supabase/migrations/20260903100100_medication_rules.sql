-- Migration: 20260903100100_medication_rules
--
-- Patent ¶[0048]: "a medication record may include an active ingredient,
-- concentration, dose coefficient, per-dose bounds, same-medication minimum
-- interval, cross-medication interval, rolling-window limit, and
-- source/version data."
--
-- Today those values live in two places and neither is the medication record:
-- the coefficients and per-dose caps are hardcoded in Swift
-- (ios-native/Cappy/Domain/Dosing.swift) and the interval is a single integer
-- column that cannot express an age-dependent rule. A dose coefficient that
-- ships inside the binary cannot be corrected without an App Store release,
-- and the same figure existing in two languages is a divergence waiting to
-- happen.
--
-- This migration moves the rule set into data:
--   * medication_dose_rules   — coefficient, per-dose bound, same-medication
--                               interval and rolling-window limit, per age band
--   * medication_interactions — the cross-medication interval
--
-- Both are age-banded because the clinical rule is: acetaminophen is
-- 12.5 mg/kg q4h under six months and 15 mg/kg q6h from six months, with a
-- per-dose ceiling that steps 160 -> 480 -> 1000 mg. One row per band states
-- that plainly; a single column cannot state it at all.
--
-- The system does not originate any of these figures. Every row carries the
-- source it came from, per ¶[0048]: "these values may originate from a
-- clinician, manufacturer, pharmacy, authoritative formulary, or configuration
-- under appropriate oversight. The system need not independently establish a
-- clinical rule."

begin;

create table if not exists public.medication_dose_rules (
  id                          uuid primary key default gen_random_uuid(),
  generic_name                text not null,
  min_age_months              integer not null,
  max_age_months              integer not null,
  -- null coefficient = not a weight-based medication (fixed or age-band dose)
  dose_coefficient_mg_per_kg  numeric(8,4),
  fixed_dose_mg               numeric(8,3),
  single_dose_max_mg          numeric(8,3),
  min_interval_hours          numeric(5,2) not null,
  rolling_window_hours        numeric(5,2) not null default 24,
  rolling_window_max_mg_per_kg numeric(8,3),
  rolling_window_max_mg       numeric(9,3),
  rolling_window_max_doses    integer,
  -- A band that refuses to dose at all (e.g. ibuprofen under six months).
  refuse_reason               text,
  source                      text not null,
  created_at                  timestamptz not null default now(),
  check (max_age_months > min_age_months),
  unique (generic_name, min_age_months)
);

create index if not exists medication_dose_rules_lookup_idx
  on public.medication_dose_rules (generic_name, min_age_months, max_age_months);

-- Age bands mirror Dosing.swift exactly: <2 mo emergency, 2-<6 mo infant,
-- 6 mo-<12 yr pediatric, >=12 yr adolescent.
insert into public.medication_dose_rules
  (generic_name, min_age_months, max_age_months, dose_coefficient_mg_per_kg,
   single_dose_max_mg, min_interval_hours, rolling_window_hours,
   rolling_window_max_mg_per_kg, rolling_window_max_mg, rolling_window_max_doses,
   refuse_reason, source)
values
  ('acetaminophen', 0, 2, null, null, 4, 24, null, null, null,
   'Under two months — fever at this age needs assessment, not an antipyretic.',
   'Cappy age gate (Dosing.swift resolveAgeGate); AAP guidance on fever under 2 months'),
  ('acetaminophen', 2, 6, 12.5, 160, 4, 24, 75, 640, 5, null,
   'US OTC pediatric labeling; 12.5 mg/kg q4h, max 5 doses/24h, 75 mg/kg/day'),
  ('acetaminophen', 6, 144, 15, 480, 6, 24, 75, 2400, 5, null,
   'US OTC pediatric labeling; 15 mg/kg q6h in Cappy''s conservative q6h posture'),
  ('acetaminophen', 144, 1200, 15, 1000, 6, 24, 75, 4000, 5, null,
   'US OTC adult labeling; 1000 mg per dose, 4000 mg/24h ceiling'),

  ('ibuprofen', 0, 6, null, null, 6, 24, null, null, null,
   'Ibuprofen is not recommended for infants under six months. Consult your pediatrician.',
   'US OTC labeling contraindication under 6 months'),
  ('ibuprofen', 6, 144, 10, 400, 6, 24, 40, 1200, 4, null,
   'US OTC pediatric labeling; 10 mg/kg q6h, 40 mg/kg/day, 4 doses/24h'),
  ('ibuprofen', 144, 1200, 10, 600, 6, 24, 40, 1200, 4, null,
   'US OTC adult labeling; 1200 mg/24h OTC ceiling')
on conflict (generic_name, min_age_months) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- Cross-medication interval (¶[0048], ¶[0051])
--
-- Distinct from the same-medication interval: it constrains one medication
-- against the administration history of a *different* one. Acetaminophen and
-- ibuprofen are deliberately alternated and are therefore absent from this
-- table — the rule exists to catch pairs that duplicate an effect, most of all
-- two H1 antagonists given close together.
--
-- Stored unordered: a row constrains B-after-A and A-after-B alike, and the
-- windows are allowed to differ in each direction because the pharmacokinetics
-- do (a 24-hour agent taken after a 6-hour one is not the same problem as the
-- reverse).
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.medication_interactions (
  id                     uuid primary key default gen_random_uuid(),
  generic_a              text not null,
  generic_b              text not null,
  -- hours of separation required before giving B when A was the prior dose
  b_after_a_hours        numeric(5,2) not null,
  -- ...and before giving A when B was the prior dose
  a_after_b_hours        numeric(5,2) not null,
  severity               text not null check (severity in ('block', 'warn')),
  rationale              text not null,
  source                 text not null,
  created_at             timestamptz not null default now(),
  check (generic_a < generic_b),
  unique (generic_a, generic_b)
);

insert into public.medication_interactions
  (generic_a, generic_b, b_after_a_hours, a_after_b_hours, severity, rationale, source)
values
  ('cetirizine', 'diphenhydramine', 24, 6, 'warn',
   'Both are H1 antagonists. Cetirizine''s effect persists about 24 hours, so diphenhydramine given after it duplicates the block for most of a day; the reverse only needs diphenhydramine''s ~6-hour window to clear.',
   'Product labeling for both agents; asymmetric windows follow the difference in duration of action')
on conflict (generic_a, generic_b) do nothing;

alter table public.medication_dose_rules  enable row level security;
alter table public.medication_interactions enable row level security;

drop policy if exists medication_dose_rules_read on public.medication_dose_rules;
create policy medication_dose_rules_read on public.medication_dose_rules
  for select to authenticated using (true);

drop policy if exists medication_interactions_read on public.medication_interactions;
create policy medication_interactions_read on public.medication_interactions
  for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────
-- Resolve the rule in force for a medication at a given age.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.dose_rule_for(
  generic    text,
  age_months numeric
)
returns public.medication_dose_rules
language sql
stable
set search_path = public
as $$
  select r.*
  from public.medication_dose_rules r
  where lower(r.generic_name) = lower(generic)
    and age_months >= r.min_age_months
    and age_months <  r.max_age_months
  order by r.min_age_months desc
  limit 1;
$$;

grant execute on function public.dose_rule_for(text, numeric) to authenticated;

commit;
