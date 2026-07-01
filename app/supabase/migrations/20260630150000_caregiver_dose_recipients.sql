-- Migration: caregiver_dose_recipients
--
-- Lets a dose_events row record a dose given to an adult caregiver, not
-- just a child — e.g. a parent logging their own acetaminophen via the
-- same NFC-tag-tap flow, visible to every admin in the family. A dose
-- always belongs to exactly one of (child, caregiver), enforced by the XOR
-- check below.
--
-- `family_id` is added directly on dose_events (denormalized from
-- children.family_id for existing child-dose rows) so RLS and the
-- family-wide timeline don't need to special-case which recipient type a
-- row has, and so a caregiver-only dose has a family to scope to at all
-- (a profile can belong to more than one family).
--
-- While generalizing compute_dose_status this surfaced a pre-existing bug
-- in the original (2-arg) version: its RETURNS TABLE declares an OUT
-- parameter named `status`, which shadows dose_events.status inside the
-- function body, so its unqualified `where ... and status = 'active'`
-- raised "column reference \"status\" is ambiguous" (42702) on every call.
-- The only caller, supabase/functions/nfc-resolve/index.ts, swallows RPC
-- errors and falls back to `status: 'due'` — so every NFC tap has been
-- silently showing "due" instead of the real safe/early/recent/overdue
-- status, with no visible error. Fixed here by qualifying every column
-- reference inside the function with the `de` table alias.

begin;

alter table public.dose_events
  add column family_id uuid references public.families(id),
  add column caregiver_user_id uuid;

update public.dose_events de
set family_id = c.family_id
from public.children c
where c.id = de.child_id
  and de.family_id is null;

alter table public.dose_events
  alter column family_id set not null,
  alter column child_id drop not null,
  add constraint dose_events_caregiver_user_id_fkey
    foreign key (caregiver_user_id) references public.profiles(id),
  add constraint dose_events_recipient_xor
    check ((child_id is not null) <> (caregiver_user_id is not null));

create index dose_events_family_given_idx
  on public.dose_events (family_id, given_at desc);
create index dose_events_caregiver_given_idx
  on public.dose_events (caregiver_user_id, given_at desc)
  where caregiver_user_id is not null;

-- ─────────────────────────────────────────────────────────────────────
-- Authorization: who can log a dose for a caregiver recipient.
-- Mirrors can_log_dose_for_child's role list (admin/caregiver/guest;
-- readonly cannot log), but the target just needs to be an active
-- caregiver of the same family — no per-member access-grant table exists
-- for adults the way caregiver_child_access exists for children, because
-- every adult here already has a family_caregivers row.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.can_log_dose_for_caregiver(
  target_user_id uuid,
  family_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_family_member(family_uuid, array['admin', 'caregiver', 'guest']::caregiver_role[])
    and exists (
      select 1
      from public.family_caregivers fc
      where fc.family_id = family_uuid
        and fc.user_id = target_user_id
        and fc.status = 'active'
        and (fc.expires_at is null or fc.expires_at > now())
    );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- RLS: replace the children-join policies with family_id-based ones now
-- that family_id lives on the row directly.
-- ─────────────────────────────────────────────────────────────────────

drop policy "dose_events: family members read" on public.dose_events;
create policy "dose_events: family members read"
  on public.dose_events for select
  using (public.is_family_member(family_id));

drop policy "dose_events: caregivers log" on public.dose_events;
create policy "dose_events: caregivers log"
  on public.dose_events for insert
  with check (
    logged_by = auth.uid()
    and (
      (child_id is not null and public.can_log_dose_for_child(child_id))
      or
      (caregiver_user_id is not null and public.can_log_dose_for_caregiver(caregiver_user_id, family_id))
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- compute_dose_status: generalize to accept either recipient. Existing
-- callers always pass named { child_uuid, medication_uuid } args, so this
-- stays backward compatible; the new caregiver call site passes
-- { caregiver_uuid, medication_uuid } instead.
-- ─────────────────────────────────────────────────────────────────────

drop function if exists public.compute_dose_status(uuid, uuid);

create function public.compute_dose_status(
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
  v_min_interval interval;
  v_last_dose timestamptz;
  v_doses_24h integer;
  v_next_safe timestamptz;
  v_now timestamptz := now();
begin
  if (child_uuid is null) = (caregiver_uuid is null) then
    raise exception 'Exactly one of child_uuid or caregiver_uuid is required' using errcode = 'invalid_parameter_value';
  end if;

  select make_interval(hours => min_interval_hours)
    into v_min_interval
  from public.medications
  where id = medication_uuid;

  if v_min_interval is null then
    raise exception 'Medication not found' using errcode = 'no_data_found';
  end if;

  -- `de.` qualifiers matter here: this function's RETURNS TABLE declares an
  -- OUT parameter named `status`, which shadows dose_events.status as a
  -- plpgsql variable. An unqualified `status = 'active'` is ambiguous and
  -- raises 42702 at call time (this bit the original 2-arg version of this
  -- function too — see commit message).
  select de.given_at
    into v_last_dose
  from public.dose_events de
  where de.medication_id = medication_uuid
    and de.status = 'active'
    and (
      (child_uuid is not null and de.child_id = child_uuid)
      or (caregiver_uuid is not null and de.caregiver_user_id = caregiver_uuid)
    )
  order by de.given_at desc
  limit 1;

  select count(*)::integer
    into v_doses_24h
  from public.dose_events de
  where de.medication_id = medication_uuid
    and de.status = 'active'
    and de.given_at > v_now - interval '24 hours'
    and (
      (child_uuid is not null and de.child_id = child_uuid)
      or (caregiver_uuid is not null and de.caregiver_user_id = caregiver_uuid)
    );

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

grant execute on function public.compute_dose_status(uuid, uuid, uuid) to authenticated;

commit;
