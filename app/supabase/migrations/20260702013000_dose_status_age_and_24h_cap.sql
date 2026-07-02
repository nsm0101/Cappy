-- SAFE-1 + SAFE-2 (applied to cappy-dev 2026-07-02 via MCP): enforce
-- max_doses_per_24h and make the child interval age-aware, matching
-- src/lib/dosing.ts (acetaminophen q4h only <6 months, q6h from 6 months;
-- ibuprofen q6h). Adults keep the label interval.
-- New status value: 'max_reached' (blocks before the interval check).

create or replace function public.compute_dose_status(
  medication_uuid uuid,
  child_uuid uuid default null,
  caregiver_uuid uuid default null
)
returns table (
  status text,
  last_dose_at timestamptz,
  next_safe_at timestamptz,
  doses_in_last_24h integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_min_hours integer;
  v_max_24h integer;
  v_generic text;
  v_interval interval;
  v_dob date;
  v_age_months integer;
  v_last timestamptz;
  v_count integer;
  v_oldest timestamptz;
  v_next timestamptz;
  v_now timestamptz := now();
begin
  if (child_uuid is null) = (caregiver_uuid is null) then
    raise exception 'Provide exactly one of child_uuid or caregiver_uuid';
  end if;

  select m.min_interval_hours, m.max_doses_per_24h, m.generic_name
    into v_min_hours, v_max_24h, v_generic
  from public.medications m
  where m.id = medication_uuid;

  if v_min_hours is null then
    raise exception 'Medication not found' using errcode = 'no_data_found';
  end if;

  if child_uuid is not null then
    select c.date_of_birth into v_dob from public.children c where c.id = child_uuid;
    v_age_months := coalesce(
      (extract(year from age(v_now::date, v_dob)) * 12
       + extract(month from age(v_now::date, v_dob)))::integer,
      0);
    if lower(v_generic) in ('acetaminophen', 'ibuprofen') and v_age_months >= 6 then
      v_interval := make_interval(hours => greatest(v_min_hours, 6));
    else
      v_interval := make_interval(hours => v_min_hours);
    end if;
  else
    v_interval := make_interval(hours => v_min_hours);
  end if;

  select de.given_at into v_last
  from public.dose_events de
  where de.medication_id = medication_uuid
    and de.status = 'active'
    and ((child_uuid is not null and de.child_id = child_uuid)
      or (caregiver_uuid is not null and de.caregiver_user_id = caregiver_uuid))
  order by de.given_at desc
  limit 1;

  select count(*)::integer, min(de.given_at)
    into v_count, v_oldest
  from public.dose_events de
  where de.medication_id = medication_uuid
    and de.status = 'active'
    and de.given_at > v_now - interval '24 hours'
    and ((child_uuid is not null and de.child_id = child_uuid)
      or (caregiver_uuid is not null and de.caregiver_user_id = caregiver_uuid));

  -- SAFE-1: 24h cap wins over everything else.
  if v_count >= v_max_24h then
    return query select 'max_reached'::text, v_last, v_oldest + interval '24 hours', v_count;
    return;
  end if;

  if v_last is null then
    return query select 'due'::text, null::timestamptz, null::timestamptz, 0;
    return;
  end if;

  v_next := v_last + v_interval;
  return query
  select
    case
      when v_now > v_last + v_interval * 1.5 then 'overdue'
      when v_now < v_last + interval '30 minutes' then 'recent'
      when v_now < v_next then 'early'
      else 'due'
    end::text,
    v_last,
    v_next,
    v_count;
end;
$$;

grant execute on function public.compute_dose_status(uuid, uuid, uuid) to authenticated;
