-- Migration: 20260903100000_weight_staleness_policy
--
-- Age-adaptive body-mass freshness gate. Patent ¶[0010] and ¶[0049]: a
-- body-mass value is admitted only where its age does not exceed a configured
-- threshold, and when it does the numerical dose volume is *suppressed* — not
-- computed and then hidden.
--
-- The threshold is derived rather than guessed. Dose mass is linear in body
-- mass (mg = coefficient × kg), so a fractional error in the stored weight is
-- exactly the same fractional error in the dose. A weight therefore goes stale
-- at the moment the child's *expected* growth since it was recorded would move
-- the computed dose by more than a single tolerance figure.
--
-- One tunable drives every interval. At the 10% default the thresholds land
-- near:
--     0-3 months    ~12 days       2-5 years      ~7 months
--     3-6 months    ~32 days       5-10 years     ~8 months
--     6-12 months   ~9 weeks       10-14 years    ~5 months  (pubertal spurt)
--     1-2 years     ~4.5 months    14-18 years    ~7 months
--     adult         capped at 365 days
--
-- The shape is the point: a newborn is re-weighed often because a month of
-- newborn growth really is a 20-30% dose change, while a six-year-old is asked
-- roughly twice a year. A flat 90-day rule was simultaneously far too lax for
-- infants and needlessly obtrusive for school-age children.

begin;

-- ─────────────────────────────────────────────────────────────────────
-- Tunables
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.dosing_policy (
  key           text primary key,
  numeric_value numeric not null,
  description   text not null,
  updated_at    timestamptz not null default now()
);

insert into public.dosing_policy (key, numeric_value, description) values
  ('dose_drift_tolerance', 0.10,
   'Fractional dose error tolerated from body-mass growth before a new weight is required. Dose is linear in mass, so this is also the tolerated fractional weight change.'),
  ('weight_staleness_min_days', 7,
   'Floor on the derived refresh interval. Prevents a nagging prompt in the first weeks of life where velocity is extreme.'),
  ('weight_staleness_max_days', 365,
   'Ceiling on the derived refresh interval. A weight older than a year is refused regardless of computed drift.')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- Expected growth velocity by age band
--
-- fractional_gain_per_month is expected mass gain as a fraction of current
-- mass, per month, taken at the FAST end of the normal range. Erring fast
-- means erring toward prompting sooner, which is the safe direction: the
-- failure mode of a too-frequent prompt is annoyance, and the failure mode of
-- a too-rare one is an under-dose computed from a stale weight.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.weight_growth_velocity (
  min_age_months            integer primary key,
  max_age_months            integer not null,
  fractional_gain_per_month numeric(7,6) not null check (fractional_gain_per_month >= 0),
  label                     text not null,
  source                    text not null,
  check (max_age_months > min_age_months)
);

insert into public.weight_growth_velocity
  (min_age_months, max_age_months, fractional_gain_per_month, label, source) values
  (0,   3,   0.250000, 'Newborn',            'approx. 30 g/day on a ~3.5 kg base; birth weight doubles by ~4-5 months'),
  (3,   6,   0.100000, 'Young infant',       'approx. 20 g/day on a ~6.5 kg base'),
  (6,   12,  0.045000, 'Older infant',       'approx. 12 g/day on a ~8.5 kg base; birth weight triples by 12 months'),
  (12,  24,  0.020000, 'Toddler',            'approx. 2.5 kg/year on a ~11 kg base'),
  (24,  60,  0.013000, 'Preschool',          'approx. 2 kg/year on a ~14 kg base'),
  (60,  120, 0.012000, 'School age',         'approx. 3 kg/year on a ~23 kg base'),
  (120, 168, 0.020000, 'Pubertal spurt',     'approx. 8-9 kg/year at peak velocity on a ~40 kg base'),
  (168, 216, 0.013000, 'Late adolescent',    'velocity tapering after peak; approx. 4 kg/year on a ~55 kg base'),
  (216, 1200,0.002000, 'Adult',              'weight-stable; interval governed by the 365-day ceiling')
on conflict (min_age_months) do nothing;

alter table public.dosing_policy enable row level security;
alter table public.weight_growth_velocity enable row level security;

drop policy if exists dosing_policy_read on public.dosing_policy;
create policy dosing_policy_read on public.dosing_policy
  for select to authenticated using (true);

drop policy if exists weight_growth_velocity_read on public.weight_growth_velocity;
create policy weight_growth_velocity_read on public.weight_growth_velocity
  for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────
-- expected_weight_drift(age at record, months elapsed)
--
-- Cumulative expected fractional mass gain, integrated across every band the
-- child passed through in the interval. Integrating matters: a weight taken at
-- 2 months and read at 8 months spans the steepest part of the curve, and a
-- single band lookup at either endpoint gets it badly wrong in one direction
-- or the other.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.expected_weight_drift(
  age_months_at_record numeric,
  elapsed_months       numeric
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_age       numeric := greatest(coalesce(age_months_at_record, 0), 0);
  v_remaining numeric := coalesce(elapsed_months, 0);
  v_factor    numeric := 1.0;
  v_band      public.weight_growth_velocity%rowtype;
  v_span      numeric;
begin
  if v_remaining <= 0 then
    return 0;
  end if;

  while v_remaining > 0 loop
    select * into v_band
    from public.weight_growth_velocity v
    where v_age >= v.min_age_months and v_age < v.max_age_months
    order by v.min_age_months
    limit 1;

    if not found then
      -- Past the last band: the final rate carries the remainder.
      select * into v_band
      from public.weight_growth_velocity
      order by min_age_months desc
      limit 1;
      v_span := v_remaining;
    else
      v_span := least(v_remaining, v_band.max_age_months - v_age);
    end if;

    exit when v_span <= 0;

    v_factor    := v_factor * power(1 + v_band.fractional_gain_per_month, v_span);
    v_remaining := v_remaining - v_span;
    v_age       := v_age + v_span;
  end loop;

  return v_factor - 1;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- weight_staleness_months(age at record) — months until drift hits tolerance
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.weight_staleness_months(
  age_months_at_record numeric,
  tolerance            numeric default null
)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_tol    numeric := coalesce(tolerance,
                        (select numeric_value from public.dosing_policy
                          where key = 'dose_drift_tolerance'), 0.10);
  v_age    numeric := greatest(coalesce(age_months_at_record, 0), 0);
  v_factor numeric := 1.0;
  v_months numeric := 0;
  v_band   public.weight_growth_velocity%rowtype;
  v_span   numeric;
  v_needed numeric;
begin
  loop
    select * into v_band
    from public.weight_growth_velocity v
    where v_age >= v.min_age_months and v_age < v.max_age_months
    order by v.min_age_months
    limit 1;

    if not found then
      select * into v_band
      from public.weight_growth_velocity
      order by min_age_months desc
      limit 1;
      v_span := null;                    -- unbounded: the last rate carries on
    else
      v_span := v_band.max_age_months - v_age;
    end if;

    -- A zero-velocity band never reaches the tolerance; the day ceiling
    -- applied by the caller is what bounds the interval there.
    if v_band.fractional_gain_per_month <= 0 then
      return 1200;
    end if;

    v_needed := ln((1 + v_tol) / v_factor) / ln(1 + v_band.fractional_gain_per_month);

    if v_span is null or v_needed <= v_span then
      return v_months + greatest(v_needed, 0);
    end if;

    v_factor := v_factor * power(1 + v_band.fractional_gain_per_month, v_span);
    v_months := v_months + v_span;
    v_age    := v_age + v_span;

    if v_months >= 1200 then
      return 1200;
    end if;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- weight_freshness(child) — the gate itself
--
-- `is_stale` is true when there is no weight on file at all. Absence is not
-- freshness: a missing body mass suppresses the dose exactly as an expired one
-- does (¶[0049], "the suppression state is distinct from merely hiding a value
-- that was otherwise calculated").
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.weight_freshness(
  child_uuid uuid,
  at_time    timestamptz default now()
)
returns table (
  weight_grams          integer,
  recorded_at           timestamptz,
  age_months_at_record  numeric,
  elapsed_months        numeric,
  expected_drift        numeric,
  tolerance             numeric,
  threshold_days        numeric,
  stale_at              timestamptz,
  is_stale              boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dob        date;
  v_grams      integer;
  v_recorded   timestamptz;
  v_age        numeric;
  v_elapsed    numeric;
  v_tol        numeric;
  v_months     numeric;
  v_days       numeric;
  v_min_days   numeric;
  v_max_days   numeric;
begin
  -- A SECURITY DEFINER function runs as its owner, so RLS on the tables
  -- underneath does not protect it. Without this check any signed-in user
  -- could pass another family's id and read their data. Service-role callers
  -- (auth.uid() is null) are already trusted and are unaffected.
  if auth.uid() is not null and not exists (
    select 1 from public.children c
    where c.id = child_uuid and public.is_family_member(c.family_id)
  ) then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  select numeric_value into v_tol      from public.dosing_policy where key = 'dose_drift_tolerance';
  select numeric_value into v_min_days from public.dosing_policy where key = 'weight_staleness_min_days';
  select numeric_value into v_max_days from public.dosing_policy where key = 'weight_staleness_max_days';
  v_tol      := coalesce(v_tol, 0.10);
  v_min_days := coalesce(v_min_days, 7);
  v_max_days := coalesce(v_max_days, 365);

  select c.date_of_birth into v_dob from public.children c where c.id = child_uuid;

  select w.value_grams, w.recorded_at
    into v_grams, v_recorded
  from public.weight_records w
  where w.child_id = child_uuid
  order by w.recorded_at desc
  limit 1;

  if v_grams is null then
    return query select null::integer, null::timestamptz, null::numeric, null::numeric,
                        null::numeric, v_tol, null::numeric, null::timestamptz, true;
    return;
  end if;

  v_age := coalesce(
    extract(epoch from (v_recorded - v_dob::timestamptz)) / 2629746.0,  -- mean month
    0);
  v_elapsed := greatest(extract(epoch from (at_time - v_recorded)) / 2629746.0, 0);

  v_months := public.weight_staleness_months(v_age, v_tol);
  v_days   := least(greatest(v_months * 30.436875, v_min_days), v_max_days);

  return query select
    v_grams,
    v_recorded,
    round(v_age, 2),
    round(v_elapsed, 3),
    round(public.expected_weight_drift(v_age, v_elapsed), 5),
    v_tol,
    round(v_days, 1),
    v_recorded + make_interval(secs => (v_days * 86400)::double precision),
    (at_time >= v_recorded + make_interval(secs => (v_days * 86400)::double precision));
end;
$$;

grant execute on function public.expected_weight_drift(numeric, numeric) to authenticated;
grant execute on function public.weight_staleness_months(numeric, numeric) to authenticated;
grant execute on function public.weight_freshness(uuid, timestamptz) to authenticated;

commit;
