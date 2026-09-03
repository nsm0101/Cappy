-- Migration: 20260903100500_notification_prefs
--
-- Cross-caregiver notifications, opt-in per caregiver.
--
-- What exists today is one boolean in UserDefaults driving a local
-- UNCalendarNotificationTrigger. A local notification cannot fire on Dad's
-- phone because Mom logged a dose, which is precisely the coordination the
-- shared record is for (¶[0053]: the event "is propagated to a second handheld
-- computing device through the shared record").
--
-- Three design commitments, all of which shape the schema:
--
-- 1. Opt-in is per caregiver, per event type, and optionally per medication.
--    Households differ: one parent wants every dose, another wants only the
--    ones that matter at 3 AM. A single global switch forces the second parent
--    to choose between noise and silence, and they will choose silence.
--
-- 2. Two event types are not disableable. An interaction warning and a 24-hour
--    maximum are not notifications about someone else's activity; they are the
--    interlocks in ¶[0051] reaching a caregiver who is about to act on stale
--    information. `is_suppressible` marks them in data so the UI can render
--    them as locked with a reason rather than as a switch that looks broken.
--
-- 3. The payload carries no PHI. "Sam logged a dose for Ava" — never the drug,
--    the amount, or the reason. These render on a locked screen in public.

begin;

do $$ begin
  create type notification_event as enum (
    'dose_logged_by_other',    -- another caregiver logged a dose
    'dose_window_open',        -- the next dose is now permissible
    'unlogged_dose_reminder',  -- tapped, never logged
    'weight_update_needed',    -- body-mass datum has gone stale
    'interaction_warning',     -- cross-medication interval breached
    'max_reached'              -- rolling-window limit reached
  );
exception when duplicate_object then null; end $$;

create table if not exists public.notification_event_catalog (
  event_type      notification_event primary key,
  title           text not null,
  explanation     text not null,
  default_enabled boolean not null,
  is_suppressible boolean not null,
  respects_quiet_hours boolean not null,
  sort_order      integer not null
);

insert into public.notification_event_catalog
  (event_type, title, explanation, default_enabled, is_suppressible, respects_quiet_hours, sort_order) values
  ('dose_logged_by_other', 'Doses given by someone else',
   'When another caregiver logs a dose for one of your children.', true, true, true, 10),
  ('dose_window_open', 'Next dose window opens',
   'When enough time has passed that the next dose would be permissible. Off by default — most families would rather not be prompted to medicate.', false, true, true, 20),
  ('unlogged_dose_reminder', 'Doses you may not have logged',
   'When you opened a dose but never logged it, so the record stays complete.', true, true, true, 30),
  ('weight_update_needed', 'Time for a new weight',
   'When a child''s weight is old enough that the calculated dose would be meaningfully off.', true, true, true, 40),
  ('interaction_warning', 'Medication interaction',
   'When a dose was given too close to a different medication that overlaps with it.', true, false, false, 50),
  ('max_reached', '24-hour maximum reached',
   'When a child has reached the daily limit for a medication.', true, false, false, 60)
on conflict (event_type) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- Per-caregiver preference grid.
--
-- medication_id null means "every medication". Postgres will not take a
-- coalesce() in a primary key, so the nullable column is mirrored into a
-- generated one and the key is built on that.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.caregiver_notification_prefs (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  family_id      uuid not null references public.families(id) on delete cascade,
  medication_id  uuid references public.medications(id) on delete cascade,
  medication_key uuid generated always as
    (coalesce(medication_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  event_type     notification_event not null,
  enabled        boolean not null default true,
  updated_at     timestamptz not null default now(),
  primary key (user_id, family_id, medication_key, event_type)
);

create index if not exists caregiver_notification_prefs_lookup_idx
  on public.caregiver_notification_prefs (family_id, event_type, user_id);

-- ─────────────────────────────────────────────────────────────────────
-- Quiet hours. Stored per caregiver with their own zone, because a household
-- can straddle two of them and the whole point is not waking someone.
-- ─────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists quiet_hours_start time,
  add column if not exists quiet_hours_end   time,
  add column if not exists time_zone         text;

-- ─────────────────────────────────────────────────────────────────────
-- APNs device registry. One row per (user, device token).
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.device_push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  token        text not null,
  platform     text not null default 'ios' check (platform in ('ios')),
  environment  text not null default 'production' check (environment in ('sandbox', 'production')),
  device_id    text,
  app_version  text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Set when APNs answers 410 Gone. Kept rather than deleted so a device that
  -- comes back gets the same row instead of accumulating duplicates.
  disabled_at  timestamptz,
  disabled_reason text,
  unique (token)
);

create index if not exists device_push_tokens_user_idx
  on public.device_push_tokens (user_id) where disabled_at is null;

alter table public.notification_event_catalog   enable row level security;
alter table public.caregiver_notification_prefs enable row level security;
alter table public.device_push_tokens           enable row level security;

drop policy if exists notification_event_catalog_read on public.notification_event_catalog;
create policy notification_event_catalog_read on public.notification_event_catalog
  for select to authenticated using (true);

drop policy if exists caregiver_notification_prefs_own on public.caregiver_notification_prefs;
create policy caregiver_notification_prefs_own on public.caregiver_notification_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_family_member(family_id));

drop policy if exists device_push_tokens_own on public.device_push_tokens;
create policy device_push_tokens_own on public.device_push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- notification_enabled — the resolution order in one place.
--
-- exact (user, family, medication, event)
--   → (user, family, any medication, event)
--     → the catalog default
--
-- A non-suppressible event short-circuits to true before any of that, so no
-- stored row and no client bug can turn a safety interlock off.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.notification_enabled(
  p_user_id       uuid,
  p_family_id     uuid,
  p_medication_id uuid,
  p_event_type    notification_event
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_suppressible boolean;
  v_default      boolean;
  v_pref         boolean;
begin
  -- Another caregiver's preferences are theirs. The push Edge Function
  -- reaches this as service role, which has no auth.uid() and is unaffected.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  select is_suppressible, default_enabled
    into v_suppressible, v_default
  from public.notification_event_catalog
  where event_type = p_event_type;

  if v_suppressible is false then
    return true;
  end if;

  select enabled into v_pref
  from public.caregiver_notification_prefs
  where user_id = p_user_id
    and family_id = p_family_id
    and medication_key = coalesce(p_medication_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and event_type = p_event_type;

  if found then
    return v_pref;
  end if;

  select enabled into v_pref
  from public.caregiver_notification_prefs
  where user_id = p_user_id
    and family_id = p_family_id
    and medication_key = '00000000-0000-0000-0000-000000000000'::uuid
    and event_type = p_event_type;

  if found then
    return v_pref;
  end if;

  return coalesce(v_default, false);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- in_quiet_hours — true when this caregiver should not be woken.
-- Windows that cross midnight (22:00-07:00) are the normal case, so the
-- comparison is written for them rather than for the simple case.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.in_quiet_hours(
  p_user_id uuid,
  at_time   timestamptz default now()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start time;
  v_end   time;
  v_zone  text;
  v_local time;
begin
  -- Someone else's sleep schedule is not public information.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  select quiet_hours_start, quiet_hours_end, coalesce(time_zone, 'UTC')
    into v_start, v_end, v_zone
  from public.profiles where id = p_user_id;

  if v_start is null or v_end is null then
    return false;
  end if;

  begin
    v_local := (at_time at time zone v_zone)::time;
  exception when others then
    v_local := (at_time at time zone 'UTC')::time;
  end;

  if v_start = v_end then
    return false;
  elsif v_start < v_end then
    return v_local >= v_start and v_local < v_end;
  else
    return v_local >= v_start or v_local < v_end;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- push_recipients_for_dose — who gets told, resolved entirely in the database
-- so the Edge Function holds no policy of its own.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.push_recipients_for_dose(
  p_dose_event_id uuid,
  p_event_type    notification_event default 'dose_logged_by_other'
)
returns table (
  user_id     uuid,
  token       text,
  environment text,
  quiet       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select fc.user_id, t.token, t.environment,
         public.in_quiet_hours(fc.user_id) as quiet
  from public.dose_events de
  join public.family_caregivers fc
    on fc.family_id = de.family_id
   and fc.status = 'active'
   and fc.user_id <> de.logged_by
  join public.device_push_tokens t
    on t.user_id = fc.user_id
   and t.disabled_at is null
  where de.id = p_dose_event_id
    and public.notification_enabled(fc.user_id, de.family_id, de.medication_id, p_event_type);
$$;

grant execute on function public.notification_enabled(uuid, uuid, uuid, notification_event) to authenticated;
grant execute on function public.in_quiet_hours(uuid, timestamptz) to authenticated;
revoke execute on function public.push_recipients_for_dose(uuid, notification_event) from authenticated, anon;

commit;
