-- Migration: 20260101000300_rpc
-- RPC functions exposed to the client via supabase.rpc().
--
-- compute_dose_status(child_id, medication_id) returns the safety
-- status for the next dose:
--   - 'due'      : minimum interval has elapsed and we're not yet at
--                  max doses/24h
--   - 'early'    : interval has not yet elapsed
--   - 'recent'   : within ~30 min of the last dose (sub-status of early)
--   - 'overdue'  : significantly past expected next-dose time
--                  (interval × 1.5 or more)
--
-- Returns plain text. Empty result if there's no prior dose.

begin;

create or replace function public.compute_dose_status(
  child_uuid uuid,
  medication_uuid uuid
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
  v_min_interval interval;
  v_last_dose timestamptz;
  v_doses_24h integer;
  v_next_safe timestamptz;
  v_now timestamptz := now();
begin
  -- Look up medication's minimum interval
  select make_interval(hours => min_interval_hours)
    into v_min_interval
  from public.medications
  where id = medication_uuid;

  if v_min_interval is null then
    raise exception 'Medication not found' using errcode = 'no_data_found';
  end if;

  -- Last active dose for this child of this medication
  select given_at
    into v_last_dose
  from public.dose_events
  where child_id = child_uuid
    and medication_id = medication_uuid
    and status = 'active'
  order by given_at desc
  limit 1;

  -- Doses in last 24h (active only)
  select count(*)::integer
    into v_doses_24h
  from public.dose_events
  where child_id = child_uuid
    and medication_id = medication_uuid
    and status = 'active'
    and given_at > v_now - interval '24 hours';

  if v_last_dose is null then
    return query select 'due'::text, null::timestamptz, null::timestamptz, 0;
    return;
  end if;

  v_next_safe := v_last_dose + v_min_interval;

  return query
  select
    case
      when v_now > v_last_dose + v_min_interval * 1.5 then 'overdue'
      when v_now < v_last_dose + interval '30 minutes' then 'recent'
      when v_now < v_next_safe then 'early'
      else 'due'
    end::text,
    v_last_dose,
    v_next_safe,
    v_doses_24h;
end;
$$;

grant execute on function public.compute_dose_status(uuid, uuid) to authenticated;

commit;
