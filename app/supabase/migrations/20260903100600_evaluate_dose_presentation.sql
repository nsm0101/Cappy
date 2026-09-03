-- Migration: 20260903100600_evaluate_dose_presentation
--
-- The dose-presentation state machine, server-side.
--
-- This is the centre of the patent (¶[0006]):
--
--   "treating the presentation of a dose quantity as a state that is
--    suppressed by default and released only upon affirmative satisfaction of
--    each of a plurality of independent preconditions ... Failure of any
--    precondition returns the presentation state to suppression rather than to
--    a value that has been computed and then concealed, so that no numerical
--    dose volume exists in the presentation path unless every precondition has
--    cleared."
--
-- The existing `compute_dose_status` answers a narrower question — has the
-- interval elapsed — and the app computes the dose separately, in Swift,
-- before deciding whether to show it. That is the compute-then-conceal shape
-- the paragraph rules out: the number exists, and only a view modifier stands
-- between it and the screen.
--
-- Here `dose_mg` and `dose_volume_ml` are NULL in every suppressed result.
-- They are not computed and withheld; there is nothing to withhold. The
-- caller cannot render a dose it was never given, which is the property the
-- claim is about.
--
-- `compute_dose_status` is left untouched. It still backs nfc-resolve and the
-- roster badges, and this function calls the same underlying history.
--
-- Preconditions evaluated, in the order a caregiver would hit them:
--   1. medication resolves to a rule this build can dose      ¶[0006]
--   2. identification is confirmed if weakly bound            ¶[0007]
--   3. age band permits the medication at all                 ¶[0049]
--   4. no contraindicating allergy on file
--   5. body mass present and fresh                            ¶[0010] ¶[0049]
--   6. same-medication minimum interval has elapsed           ¶[0051]
--   7. cross-medication interval has elapsed                  ¶[0051]
--   8. rolling-window limit leaves room for a whole dose       ¶[0051]
--   9. the recent history is complete, or attested            ¶[0052]

begin;

-- Contraindications as data rather than a Swift dictionary, so the gate holds
-- for any client and can be corrected without a release.
create table if not exists public.medication_contraindications (
  generic_name text not null,
  allergen_key text not null,
  primary key (generic_name, allergen_key)
);

insert into public.medication_contraindications (generic_name, allergen_key) values
  ('acetaminophen', 'acetaminophen'),
  ('ibuprofen', 'ibuprofen'),
  ('ibuprofen', 'nsaid'),
  ('ibuprofen', 'aspirin'),
  ('ibuprofen', 'naproxen')
on conflict do nothing;

alter table public.medication_contraindications enable row level security;
drop policy if exists medication_contraindications_read on public.medication_contraindications;
create policy medication_contraindications_read on public.medication_contraindications
  for select to authenticated using (true);

create or replace function public.evaluate_dose_presentation(
  p_medication_id            uuid,
  p_child_id                 uuid    default null,
  p_caregiver_user_id        uuid    default null,
  p_binding_strength         binding_strength default 'strong',
  p_identification_confirmed boolean default true,
  p_history_attested         boolean default false,
  p_at                       timestamptz default now()
)
returns table (
  presentation          text,
  suppression_reasons   text[],
  status                text,
  dose_basis            text,
  dose_mg               numeric,
  dose_volume_ml        numeric,
  dose_capped           boolean,
  last_dose_at          timestamptz,
  next_safe_at          timestamptz,
  doses_in_last_24h     integer,
  window_hours          numeric,
  window_mg             numeric,
  window_limit_mg       numeric,
  window_max_doses      integer,
  weight_grams          integer,
  weight_recorded_at    timestamptz,
  weight_stale_at       timestamptz,
  weight_expected_drift numeric,
  age_months            numeric,
  min_interval_hours    numeric,
  cross_med_generic     text,
  cross_med_clear_at    timestamptz,
  history_complete      boolean,
  rule_source           text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reasons      text[] := '{}';
  v_status       text   := 'due';
  v_basis        text   := 'none';

  v_generic      text;
  v_conc         numeric;
  v_rule         public.medication_dose_rules;

  v_dob          date;
  v_age          numeric;

  v_wf           record;
  v_kg           numeric;

  v_last         timestamptz;
  v_next         timestamptz;
  v_count        integer := 0;
  v_window_mg    numeric := 0;
  v_limit_mg     numeric;
  v_oldest       timestamptz;

  v_xgen         text;
  v_xclear       timestamptz;

  v_hist_ok      boolean := true;

  v_mg           numeric;
  v_ml           numeric;
  v_capped       boolean := false;
begin
  -- A SECURITY DEFINER function runs as its owner, so RLS on the tables
  -- underneath does not protect it. Without this check any signed-in user
  -- could pass another family's id and read their data. Service-role callers
  -- (auth.uid() is null) are already trusted and are unaffected.
  if auth.uid() is not null and (
       (p_child_id is not null and not exists (
          select 1 from public.children c
          where c.id = p_child_id and public.is_family_member(c.family_id)))
       or (p_caregiver_user_id is not null and not exists (
          select 1 from public.family_caregivers a
          join public.family_caregivers b on b.family_id = a.family_id
          where a.user_id = auth.uid() and a.status = 'active'
            and b.user_id = p_caregiver_user_id and b.status = 'active'))
     ) then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  if (p_child_id is null) = (p_caregiver_user_id is null) then
    raise exception 'Provide exactly one of p_child_id or p_caregiver_user_id';
  end if;

  ---------------------------------------------------------------------
  -- 1. Medication must resolve. ¶[0006]: identification is the first
  --    precondition, and a medication this build has no rule for is an
  --    unresolved identification however cleanly the tag read.
  ---------------------------------------------------------------------
  select lower(m.generic_name), m.concentration_mg_per_ml
    into v_generic, v_conc
  from public.medications m
  where m.id = p_medication_id;

  if v_generic is null then
    return query select 'suppressed'::text, array['medication_unresolved']::text[], 'unavailable'::text, 'none'::text,
      null::numeric, null::numeric, false,
      null::timestamptz, null::timestamptz, 0,
      null::numeric, null::numeric, null::numeric, null::integer,
      null::integer, null::timestamptz, null::timestamptz, null::numeric,
      null::numeric, null::numeric, null::text, null::timestamptz, true, null::text;
    return;
  end if;

  ---------------------------------------------------------------------
  -- 2. ¶[0007]: a weakly bound identification — one read from an article a
  --    user applied, where no storage geometry maintains the association — is
  --    a candidate, not a resolution. A faultless radio read does not satisfy
  --    the precondition on its own.
  ---------------------------------------------------------------------
  if p_binding_strength = 'weak' and not coalesce(p_identification_confirmed, false) then
    v_reasons := v_reasons || 'identification_unconfirmed'::text;
  end if;

  ---------------------------------------------------------------------
  -- Recipient context
  ---------------------------------------------------------------------
  if p_child_id is not null then
    v_basis := 'weight';

    select c.date_of_birth into v_dob from public.children c where c.id = p_child_id;
    if v_dob is null then
      return query select 'suppressed'::text, array['recipient_unknown']::text[], 'unavailable'::text, 'none'::text,
        null::numeric, null::numeric, false,
        null::timestamptz, null::timestamptz, 0,
        null::numeric, null::numeric, null::numeric, null::integer,
        null::integer, null::timestamptz, null::timestamptz, null::numeric,
        null::numeric, null::numeric, null::text, null::timestamptz, true, null::text;
      return;
    end if;

    v_age := extract(epoch from (p_at - v_dob::timestamptz)) / 2629746.0;

    -- 3. Age band
    v_rule := public.dose_rule_for(v_generic, v_age);
    if v_rule.id is null then
      v_reasons := v_reasons || 'no_rule_for_age'::text;
    elsif v_rule.refuse_reason is not null then
      v_reasons := v_reasons || 'age_refused'::text;
    end if;

    -- 4. Allergy on file
    if exists (
      select 1
      from public.child_allergies ca
      join public.medication_contraindications mc
        on mc.allergen_key = ca.allergen
      where ca.child_id = p_child_id
        and mc.generic_name = v_generic
    ) then
      v_reasons := v_reasons || 'allergy_on_file'::text;
    end if;

    -- 5. Body mass, present and fresh. ¶[0049].
    select * into v_wf from public.weight_freshness(p_child_id, p_at);
    weight_grams          := v_wf.weight_grams;
    weight_recorded_at    := v_wf.recorded_at;
    weight_stale_at       := v_wf.stale_at;
    weight_expected_drift := v_wf.expected_drift;

    if v_wf.weight_grams is null then
      v_reasons := v_reasons || 'weight_missing'::text;
    elsif v_wf.is_stale then
      v_reasons := v_reasons || 'weight_stale'::text;
    else
      v_kg := v_wf.weight_grams / 1000.0;
    end if;
  else
    -- Adult caregiver recipient: the amount is entered by hand, so there is no
    -- weight-based quantity to suppress. The interval interlocks still apply.
    v_basis := 'manual';
    v_rule  := public.dose_rule_for(v_generic, 1200);
  end if;

  ---------------------------------------------------------------------
  -- 6. Same-medication minimum interval. ¶[0051].
  --    Compared on effective_at, not given_at: the late end of each event's
  --    uncertainty band, and the reconciled time where two devices collided.
  ---------------------------------------------------------------------
  select de.effective_at into v_last
  from public.dose_events de
  where de.medication_id = p_medication_id
    and de.status = 'active'
    and de.reconciliation_status <> 'merged'
    and ((p_child_id is not null and de.child_id = p_child_id)
      or (p_caregiver_user_id is not null and de.caregiver_user_id = p_caregiver_user_id))
  order by de.effective_at desc
  limit 1;

  if v_rule.id is not null and v_last is not null then
    v_next := v_last + make_interval(secs => (v_rule.min_interval_hours * 3600)::double precision);
    if p_at < v_next then
      v_reasons := v_reasons || 'same_medication_interval'::text;
      v_status  := case when p_at < v_last + interval '30 minutes' then 'recent' else 'early' end;
    elsif p_at > v_last + make_interval(secs => (v_rule.min_interval_hours * 3600 * 1.5)::double precision) then
      v_status := 'overdue';
    end if;
  end if;

  ---------------------------------------------------------------------
  -- 7. Cross-medication interval. ¶[0048], ¶[0051]. Asymmetric by design:
  --    a 24-hour agent taken before a 6-hour one is not the same problem as
  --    the reverse.
  ---------------------------------------------------------------------
  select x.other_generic, x.clear_at into v_xgen, v_xclear
  from (
    select
      case when mi.generic_a = v_generic then mi.generic_b else mi.generic_a end as other_generic,
      max(de.effective_at) + make_interval(secs =>
        ((case when mi.generic_a = v_generic then mi.a_after_b_hours else mi.b_after_a_hours end) * 3600)::double precision
      ) as clear_at
    from public.medication_interactions mi
    join public.medications om
      on lower(om.generic_name) = case when mi.generic_a = v_generic then mi.generic_b else mi.generic_a end
    join public.dose_events de
      on de.medication_id = om.id
     and de.status = 'active'
     and de.reconciliation_status <> 'merged'
     and ((p_child_id is not null and de.child_id = p_child_id)
       or (p_caregiver_user_id is not null and de.caregiver_user_id = p_caregiver_user_id))
    where v_generic in (mi.generic_a, mi.generic_b)
      and mi.severity = 'block'
    group by 1, mi.generic_a, mi.a_after_b_hours, mi.b_after_a_hours
  ) x
  where x.clear_at > p_at
  order by x.clear_at desc
  limit 1;

  if v_xclear is not null then
    v_reasons := v_reasons || 'cross_medication_interval'::text;
    if v_status = 'due' then v_status := 'blocked'; end if;
  end if;

  ---------------------------------------------------------------------
  -- 8. Rolling window. ¶[0051]: "determines cumulative dose mass in a rolling
  --    time window" — a count of doses is a proxy for that, not the thing
  --    itself, and it is the wrong proxy the moment two different-sized doses
  --    are given in a day.
  ---------------------------------------------------------------------
  if v_rule.id is not null then
    select count(*)::integer, coalesce(sum(de.amount_mg), 0), min(de.effective_at)
      into v_count, v_window_mg, v_oldest
    from public.dose_events de
    where de.medication_id = p_medication_id
      and de.status = 'active'
      and de.reconciliation_status <> 'merged'
      and de.effective_at > p_at - make_interval(secs => (v_rule.rolling_window_hours * 3600)::double precision)
      and ((p_child_id is not null and de.child_id = p_child_id)
        or (p_caregiver_user_id is not null and de.caregiver_user_id = p_caregiver_user_id));

    v_limit_mg := least(
      coalesce(v_rule.rolling_window_max_mg_per_kg * v_kg, 'infinity'::numeric),
      coalesce(v_rule.rolling_window_max_mg, 'infinity'::numeric));
    if v_limit_mg = 'infinity'::numeric then v_limit_mg := null; end if;

    if v_rule.rolling_window_max_doses is not null
       and v_count >= v_rule.rolling_window_max_doses then
      v_reasons := v_reasons || 'rolling_window_doses'::text;
      v_status  := 'max_reached';
      v_next    := v_oldest + make_interval(secs => (v_rule.rolling_window_hours * 3600)::double precision);
    end if;
  end if;

  ---------------------------------------------------------------------
  -- 9. ¶[0052]: a gap in the record is not an affirmative finding that no
  --    dose was given. An unanswered "did you give this?" prompt that has
  --    already expired is a known gap, and the caregiver is asked to close it
  --    rather than being handed a number computed from a history the app
  --    knows is short.
  ---------------------------------------------------------------------
  v_hist_ok := not exists (
    select 1 from public.scan_intents si
    where si.medication_id = p_medication_id
      and si.resolved_at is null
      and si.dismissed_at is null
      and si.remind_at <= p_at
      and si.opened_at > p_at - interval '24 hours'
      and ((p_child_id is not null and si.child_id = p_child_id)
        or (p_caregiver_user_id is not null and si.caregiver_user_id = p_caregiver_user_id))
  );

  if not v_hist_ok and not coalesce(p_history_attested, false) then
    v_reasons := v_reasons || 'history_incomplete'::text;
  end if;

  ---------------------------------------------------------------------
  -- Release, or don't. The dose is computed only here, inside the branch
  -- where every precondition has already cleared.
  ---------------------------------------------------------------------
  if array_length(v_reasons, 1) is null then
    if v_basis = 'weight' and v_kg is not null and v_rule.dose_coefficient_mg_per_kg is not null then
      v_mg := v_rule.dose_coefficient_mg_per_kg * v_kg;
      if v_rule.single_dose_max_mg is not null and v_mg > v_rule.single_dose_max_mg then
        v_mg := v_rule.single_dose_max_mg;
        v_capped := true;
      end if;

      -- A window that cannot fit a whole dose does not get a partial one. A
      -- half dose presented as the dose is a worse answer than no dose.
      if v_limit_mg is not null and v_window_mg + v_mg > v_limit_mg then
        v_reasons := v_reasons || 'rolling_window_mass'::text;
        v_status  := 'max_reached';
        v_mg := null; v_capped := false;
        v_next := coalesce(v_oldest, p_at)
                  + make_interval(secs => (v_rule.rolling_window_hours * 3600)::double precision);
      elsif v_conc > 0 then
        v_ml := round(v_mg / v_conc, 1);
      end if;
    elsif v_basis = 'weight' then
      v_reasons := v_reasons || 'no_rule_for_age'::text;
    end if;
  end if;

  if array_length(v_reasons, 1) is not null and v_status = 'due' then
    v_status := 'blocked';
  end if;

  return query select
    (case when array_length(v_reasons, 1) is null then 'released' else 'suppressed' end)::text,
    v_reasons,
    v_status,
    v_basis,
    case when array_length(v_reasons, 1) is null then v_mg end,
    case when array_length(v_reasons, 1) is null then v_ml end,
    case when array_length(v_reasons, 1) is null then v_capped else false end,
    v_last,
    v_next,
    v_count,
    v_rule.rolling_window_hours,
    v_window_mg,
    v_limit_mg,
    v_rule.rolling_window_max_doses,
    weight_grams,
    weight_recorded_at,
    weight_stale_at,
    weight_expected_drift,
    round(v_age, 2),
    v_rule.min_interval_hours,
    v_xgen,
    v_xclear,
    v_hist_ok,
    v_rule.source;
end;
$$;

grant execute on function public.evaluate_dose_presentation(
  uuid, uuid, uuid, binding_strength, boolean, boolean, timestamptz) to authenticated;

commit;
