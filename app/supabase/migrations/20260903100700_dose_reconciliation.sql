-- Migration: 20260903100700_dose_reconciliation
--
-- Reconciling administration events created by devices with intermittent
-- connectivity. Patent ¶[0054]-[0058].
--
-- The situation: both parents are in the room. Mom gives the dose and logs it
-- on a phone with no signal. Dad, not sure whether she logged it, logs it too.
-- Two rows arrive describing one administration, minutes apart, with clocks
-- that were never synchronised to each other.
--
-- The rule is the interesting part, and ¶[0057] is emphatic that it is not a
-- general-purpose merge:
--
--   "A general-purpose scheme resolves a conflict ... by selecting the entry
--    judged most likely to be correct ... The rule described here does not
--    select for likely correctness. It selects the later asserted
--    administration-event time irrespective of which entry was recorded first,
--    which entry was received first, and which device originated either entry,
--    because the two available errors are not symmetric in consequence.
--    Treating an administration as having occurred earlier than it did
--    advances the next permissible administration and can cause a dose to be
--    presented before the applicable interval has elapsed. Treating an
--    administration as having occurred later than it did only delays a
--    subsequent dose."
--
-- So: last-write-wins is wrong here, and so is trusting the better clock. The
-- canonical event takes the LATEST effective time in the group, always.
--
-- Two structural guarantees, both enforced below rather than by convention:
--
--   * Monotonic non-advancement. The canonical effective_at is a `greatest()`
--     over the group, and the BEFORE UPDATE trigger from
--     20260903100200 refuses to lower an effective_at that already exists.
--     Together those mean the next permissible administration cannot move
--     earlier than either entry would have produced alone — "irrespective of
--     the order in which the entries are received and irrespective of the
--     order in which reconciliation is performed" (¶[0057]).
--
--   * Nothing is destroyed. A merged entry keeps its own asserted time, its
--     own device, its own logger; it is marked merged and excluded from
--     eligibility, and the link is recorded. ¶[0058]: "an audit representation
--     can preserve the original local event records without presenting
--     duplicate administrations as independent doses."

begin;

insert into public.dosing_policy (key, numeric_value, description) values
  ('dose_collision_minutes', 60,
   'Two entries for the same recipient and active ingredient closer together than this are candidates for being one administration double-logged. Bounded by the medication''s own minimum interval, per ¶[0054].'),
  ('dose_collision_amount_tolerance', 0.25,
   'Fractional difference in recorded amount still consistent with a single administration. Beyond it the entries describe different doses and both are kept.'),
  ('dose_collision_interval_fraction', 0.25,
   'Collision window as a fraction of the medication''s minimum interval. The window is the smaller of this and dose_collision_minutes. Two genuine administrations cannot be closer than the interval, so anything inside a quarter of it is far more likely one event seen twice.')
on conflict (key) do nothing;

-- Provenance of every merge, kept separately from the events themselves.
create table if not exists public.dose_event_reconciliations (
  id                  uuid primary key default gen_random_uuid(),
  canonical_event_id  uuid not null references public.dose_events(id) on delete cascade,
  merged_event_id     uuid not null references public.dose_events(id) on delete cascade,
  reconciled_at       timestamptz not null default now(),
  -- What the group looked like at the moment of the decision, so the outcome
  -- is explicable months later without replaying the whole table.
  canonical_effective_at timestamptz not null,
  merged_effective_at    timestamptz not null,
  merged_given_at        timestamptz not null,
  merged_device_id       text,
  merged_logged_by       uuid,
  separation_seconds     numeric not null,
  unique (merged_event_id)
);

create index if not exists dose_event_reconciliations_canonical_idx
  on public.dose_event_reconciliations (canonical_event_id);

alter table public.dose_event_reconciliations enable row level security;

drop policy if exists dose_event_reconciliations_read on public.dose_event_reconciliations;
-- `canonical_event_id` MUST be qualified with the table name. dose_events has
-- a column of the same name, so an unqualified reference inside this subquery
-- binds to the INNER table and Postgres stores the predicate as
-- `de.id = de.canonical_event_id` — false for every canonical row, which makes
-- the whole audit trail silently unreadable by every client. Found 2026-09-04
-- only by actually querying it as a signed-in user.
create policy dose_event_reconciliations_read on public.dose_event_reconciliations
  for select to authenticated
  using (exists (
    select 1 from public.dose_events de
    where de.id = dose_event_reconciliations.canonical_event_id
      and public.is_family_member(de.family_id)
  ));

-- ─────────────────────────────────────────────────────────────────────
-- reconcile_dose_event(new event) -> canonical event id
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.reconcile_dose_event(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new        public.dose_events;
  v_generic    text;
  v_min_hours  numeric;
  v_fraction   numeric;
  v_window     interval;
  v_tol        numeric;
  v_canonical  public.dose_events;
  v_member     public.dose_events;
  v_group      uuid[];
  v_latest     timestamptz;
begin
  select * into v_new from public.dose_events where id = p_event_id;
  if not found or v_new.status <> 'active' then
    return null;
  end if;

  -- A correction is a new row describing the same administration as the one it
  -- replaces, minutes later, at a similar amount — which to the collision
  -- detector looks exactly like the offline double-log it exists to merge.
  --
  -- Merging them is unsafe in a specific way. `supersede_original_dose` marks
  -- the original superseded, and every eligibility query filters on
  -- status = 'active'. If the original had been chosen canonical, the
  -- correction would sit merged behind a row that is no longer active and BOTH
  -- would drop out of the 24-hour totals — a dose that was really given
  -- becomes invisible to the interlocks. The trigger cannot consult
  -- dose_corrections, because that row is written after this one, so the
  -- correction declares itself on the event.
  if v_new.corrects_dose_event_id is not null then
    return null;
  end if;

  select lower(m.generic_name) into v_generic
  from public.medications m where m.id = v_new.medication_id;

  select min(r.min_interval_hours) into v_min_hours
  from public.medication_dose_rules r
  where lower(r.generic_name) = v_generic;

  -- ¶[0054]: "limited to events separated by less than a collision interval
  -- derived from or no greater than the minimum administration interval."
  --
  -- A quarter of the interval, not the whole of it. Two genuine
  -- administrations cannot legitimately be closer together than the minimum
  -- interval, so entries inside a quarter of it are far more likely one event
  -- recorded twice — and a window sized to the full interval merged four real
  -- hourly doses in testing, which under-reports the 24-hour total. That is a
  -- failure in the unsafe direction, so the window errs narrow.
  v_fraction := coalesce(
    (select numeric_value from public.dosing_policy where key = 'dose_collision_interval_fraction'), 0.25);

  v_window := least(
    make_interval(mins => coalesce(
      (select numeric_value::integer from public.dosing_policy where key = 'dose_collision_minutes'), 60)),
    make_interval(secs => (coalesce(v_min_hours, 6) * 3600 * v_fraction)::double precision));

  v_tol := coalesce(
    (select numeric_value from public.dosing_policy where key = 'dose_collision_amount_tolerance'), 0.25);

  -- Candidate collisions: same recipient, same ACTIVE INGREDIENT (two products
  -- of one generic are one administration, not two), inside the window, and
  -- describing a comparable amount.
  select array_agg(de.id) into v_group
  from public.dose_events de
  join public.medications m on m.id = de.medication_id
  where de.id <> v_new.id
    and de.status = 'active'
    and de.reconciliation_status <> 'merged'
    and lower(m.generic_name) = v_generic
    -- Never take a correction, or a row that has since been corrected, as a
    -- collision candidate.
    and de.corrects_dose_event_id is null
    and not exists (select 1 from public.dose_events x
                     where x.corrects_dose_event_id = de.id)
    and de.child_id is not distinct from v_new.child_id
    and de.caregiver_user_id is not distinct from v_new.caregiver_user_id
    -- Strictly inside the window, not on its edge: ¶[0054] says "separated by
    -- LESS than a collision interval".
    and de.effective_at > v_new.effective_at - v_window
    and de.effective_at < v_new.effective_at + v_window
    -- A collision is two SOURCES describing one administration. Two entries
    -- from the same device by the same caregiver are a person deliberately
    -- logging twice — a second dose, or a correction — and merging those
    -- erases a real administration from the interval history. ¶[0054] licenses
    -- exactly this check: "source reliability and corroborating metadata may
    -- be evaluated before an event is treated as credible."
    and (de.logged_by <> v_new.logged_by
         or (de.device_id is not null and v_new.device_id is not null
             and de.device_id <> v_new.device_id))
    and (
      v_new.amount_mg = 0 or de.amount_mg = 0
      or abs(de.amount_mg - v_new.amount_mg)
         <= v_tol * greatest(de.amount_mg, v_new.amount_mg)
    );

  if v_group is null or array_length(v_group, 1) = 0 then
    return null;
  end if;

  -- Identify the canonical event: one already canonical in this group, else
  -- the earliest *recorded* entry. Which entry is canonical is arbitrary and
  -- deliberately so — the identity of the canonical row carries no safety
  -- meaning, because its effective time is a greatest() over the whole group
  -- either way.
  select * into v_canonical
  from public.dose_events de
  where de.id = any (v_group)
    and de.reconciliation_status = 'canonical'
  order by de.logged_at
  limit 1;

  if not found then
    select * into v_canonical
    from public.dose_events de
    where de.id = any (v_group)
    order by de.logged_at, de.id
    limit 1;
  end if;

  -- ¶[0056]: the canonical event uses the LATER administration-event time.
  select max(de.effective_at) into v_latest
  from public.dose_events de
  where de.id = any (v_group || v_new.id);

  update public.dose_events
     set effective_at = greatest(effective_at, v_latest),
         reconciliation_status = 'canonical',
         canonical_event_id = null
   where id = v_canonical.id;

  -- Everything else in the group, plus the arriving entry, becomes a merged
  -- source. Their own asserted times are left exactly as recorded.
  for v_member in
    select * from public.dose_events
    where id = any (v_group || v_new.id) and id <> v_canonical.id
  loop
    update public.dose_events
       set reconciliation_status = 'merged',
           canonical_event_id = v_canonical.id
     where id = v_member.id;

    insert into public.dose_event_reconciliations
      (canonical_event_id, merged_event_id, canonical_effective_at,
       merged_effective_at, merged_given_at, merged_device_id, merged_logged_by,
       separation_seconds)
    values
      (v_canonical.id, v_member.id, v_latest,
       v_member.effective_at, v_member.given_at, v_member.device_id, v_member.logged_by,
       abs(extract(epoch from (v_member.effective_at - v_latest))))
    on conflict (merged_event_id) do update
      set canonical_event_id = excluded.canonical_event_id,
          canonical_effective_at = excluded.canonical_effective_at,
          reconciled_at = now();
  end loop;

  return v_canonical.id;
end;
$$;

create or replace function public.dose_events_reconcile_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.reconcile_dose_event(new.id);
  return null;
end;
$$;

drop trigger if exists dose_events_reconcile on public.dose_events;
create trigger dose_events_reconcile
  after insert on public.dose_events
  for each row execute function public.dose_events_reconcile_trigger();

-- ─────────────────────────────────────────────────────────────────────
-- ¶[0058]: what the timeline needs to mark a reconciled entry while still
-- showing the time used for safety calculations.
-- ─────────────────────────────────────────────────────────────────────

create or replace view public.dose_events_reconciled
with (security_invoker = true) as
select
  de.*,
  case
    when de.reconciliation_status = 'merged' then can.effective_at
    else de.effective_at
  end as safety_time,
  can.logged_by as canonical_logged_by,
  (select count(*) from public.dose_event_reconciliations r
    where r.canonical_event_id = de.id) as merged_source_count
from public.dose_events de
left join public.dose_events can on can.id = de.canonical_event_id;

grant select on public.dose_events_reconciled to authenticated;
revoke execute on function public.reconcile_dose_event(uuid) from authenticated, anon;

commit;
