-- Migration: 20260801100000_dose_notifications
--
-- ADR-0009: cross-platform caregiver dose notifications.
--
-- When one caregiver logs a dose, the others need to know. Realtime already
-- covers this while the app is open — which is exactly the condition that
-- fails at 2am with the app closed. This adds the app-closed path:
--
--   dose_events INSERT
--     → AFTER INSERT trigger (this file)
--     → net.http_post, fire-and-forget → Edge Function `notify-dose`
--     → resolve subscribed family members, minus the actor
--     → Expo Push
--
-- Scope note, deliberate: notifications are AWARENESS, not prevention. A push
-- is a lagging signal — it fires after the dose is already written and cannot
-- stop a caregiver standing in the kitchen holding the bottle. Double-dose
-- prevention is a scan-time concern and lives in the dose sheet's ordering
-- (last dose above the Log button), not here. If anyone starts treating a
-- delivered notification as the thing that prevents a double dose, that
-- assumption is the bug.
--
-- ─────────────────────────────────────────────────────────────────────
-- REQUIRED CONFIGURATION — the trigger is inert until these are set.
--
-- The function URL and the shared secret must NOT be committed. They are read
-- at trigger time from Vault, which is already enabled on this project
-- (supabase_vault 0.3.1). Set them once per environment:
--
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co/functions/v1/notify-dose',
--     'notify_dose_url',
--     'ADR-0009 notify-dose Edge Function endpoint');
--
--   select vault.create_secret(
--     '<a long random string>',
--     'notify_dose_secret',
--     'ADR-0009 shared secret; must equal the NOTIFY_DOSE_SECRET env var
--      on the notify-dose Edge Function');
--
-- Then set the same value as a secret on the function itself:
--
--   supabase secrets set NOTIFY_DOSE_SECRET='<the same long random string>'
--
-- To rotate, update both sides. Until both exist the trigger silently does
-- nothing — which is the correct failure mode, because a dose write must
-- never depend on notification configuration being present.
-- ─────────────────────────────────────────────────────────────────────

begin;

-- pg_net is available on this project (0.20.3) but not installed. It is the
-- asynchronous HTTP client; `net.http_post` queues a request and returns
-- immediately rather than blocking the transaction. That asynchrony is what
-- gives us fire-and-forget for free — but see the exception handler in
-- notify_on_dose_logged, which does not assume it.
--
-- No `with schema` clause on purpose: pg_net is NOT relocatable — its control
-- file pins it to the `net` schema — so naming any other schema here fails
-- the whole migration.
create extension if not exists pg_net;

-- ─────────────────────────────────────────────────────────────────────
-- device_tokens
--
-- One row per (device, account). `token` is unique on its own rather than
-- per-user: an Expo push token identifies a physical device+install, so if
-- account B signs in on a phone that previously held account A's token, the
-- upsert must MOVE the row, not create a second one. A duplicate would push
-- one family's dose to the wrong household.
-- ─────────────────────────────────────────────────────────────────────

create table public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null unique,
  platform    text not null check (platform in ('ios', 'android')),
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index device_tokens_user_id_idx on public.device_tokens (user_id);
-- Serves the 90-day prune.
create index device_tokens_last_seen_idx on public.device_tokens (last_seen);

alter table public.device_tokens enable row level security;

-- A user may only ever see or touch their own device rows. Note there is
-- deliberately no policy letting family members read each other's tokens —
-- recipient resolution happens in the Edge Function under the service role.
create policy "device_tokens: own rows, select"
  on public.device_tokens for select
  using (user_id = auth.uid());

create policy "device_tokens: own rows, insert"
  on public.device_tokens for insert
  with check (user_id = auth.uid());

create policy "device_tokens: own rows, update"
  on public.device_tokens for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "device_tokens: own rows, delete"
  on public.device_tokens for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- notification_subscriptions
--
-- Per-caregiver, per-child. A caregiver hears about a child only if
-- subscribed to that child.
--
-- Default is SUBSCRIBED, not unsubscribed (ADR-0009 decision 1). In a
-- medication context the failure mode of opt-in-by-default is noise, which is
-- annoying; the failure mode of opt-out-by-default is silence, which is the
-- dangerous one — a caregiver who assumed they were covered and wasn't.
-- Defaulting to subscribed makes the safe state the automatic one.
-- ─────────────────────────────────────────────────────────────────────

create table public.notification_subscriptions (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  child_id    uuid not null references public.children(id) on delete cascade,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, child_id)
);

-- Recipient resolution reads by child and filters on enabled.
create index notification_subscriptions_child_enabled_idx
  on public.notification_subscriptions (child_id) where enabled;

create trigger notification_subscriptions_updated_at
  before update on public.notification_subscriptions
  for each row execute procedure public.touch_updated_at();

alter table public.notification_subscriptions enable row level security;

-- Own rows only, AND the child must belong to a family the user is an active
-- member of. The family constraint composes the existing helper rather than
-- reimplementing membership — `is_family_member` already handles status and
-- role, and a second copy of that logic is a second place to get it wrong.
create policy "notification_subscriptions: own rows in own families, select"
  on public.notification_subscriptions for select
  using (user_id = auth.uid());

create policy "notification_subscriptions: own rows in own families, insert"
  on public.notification_subscriptions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.children c
      where c.id = child_id
        and c.deleted_at is null
        and public.is_family_member(c.family_id)
    )
  );

create policy "notification_subscriptions: own rows in own families, update"
  on public.notification_subscriptions for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.children c
      where c.id = child_id
        and public.is_family_member(c.family_id)
    )
  );

create policy "notification_subscriptions: own rows, delete"
  on public.notification_subscriptions for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- Backfill: existing families are covered on upgrade.
--
-- Without this, every caregiver already in a family would be silently
-- unsubscribed after deploy — the exact "assumed they were covered and
-- weren't" failure the default-on decision exists to prevent.
-- ─────────────────────────────────────────────────────────────────────

insert into public.notification_subscriptions (user_id, child_id, enabled)
select fc.user_id, c.id, true
from public.family_caregivers fc
join public.children c on c.family_id = fc.family_id
where fc.status = 'active'
  and c.deleted_at is null
on conflict (user_id, child_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- notification_sends
--
-- Dedup ledger and receipt store. One row per (dose, recipient).
--
-- On the dedup key: dose_events.id is a CLIENT-generated UUID and is already
-- the idempotency mechanism for the write itself, so a network retry of the
-- same log re-uses the same id and never reaches the trigger twice. What this
-- table guards is the other case — the trigger firing twice for one row, or
-- the Edge Function being invoked twice for one dose — so the key is
-- (dose_event_id, user_id) and the ADR's "60s dedup" falls out of the unique
-- constraint rather than needing a time window at all. A time window would be
-- strictly worse here: it would also suppress a genuine second dose logged
-- inside 60 seconds, which is precisely the event caregivers most need to
-- hear about.
-- ─────────────────────────────────────────────────────────────────────

create table public.notification_sends (
  dose_event_id  uuid not null references public.dose_events(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  sent_at        timestamptz not null default now(),
  receipt_id     text,
  primary key (dose_event_id, user_id)
);

create index notification_sends_sent_at_idx on public.notification_sends (sent_at);

-- No policies: this table is written and read only by the service role from
-- the Edge Function. RLS on with zero policies denies all authenticated
-- access, which is the intent — it is delivery bookkeeping, not user data.
alter table public.notification_sends enable row level security;

-- ─────────────────────────────────────────────────────────────────────
-- The trigger
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.notify_on_dose_logged()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_url text;
  v_secret text;
begin
  -- Only active child doses notify.
  --
  -- `caregiver_user_id is not null` means the recipient is an adult, and
  -- ADR-0009's subscription model is per-child only — it says nothing about
  -- adult recipients, so those are skipped rather than guessed at. This is a
  -- known, documented gap (see app/QA-NOTIFICATIONS.md), not an oversight:
  -- logging a dose for an adult currently notifies nobody.
  if new.child_id is null or new.status <> 'active' then
    return new;
  end if;

  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'notify_dose_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'notify_dose_secret';

    if v_url is null or v_secret is null then
      return new;
    end if;

    -- Only the dose id crosses this boundary. No child name, no medication,
    -- no amount — the Edge Function re-reads what it needs under the service
    -- role. Keeping PHI out of the queued request body means it is not
    -- sitting in net._http_response for the retention window.
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notify-secret', v_secret
      ),
      body    := jsonb_build_object('doseEventId', new.id),
      timeout_milliseconds := 5000
    );
  exception
    when others then
      -- Swallow everything. Logging the dose is the critical operation;
      -- telling people about it is best-effort. pg_net is asynchronous by
      -- design so this should not be reachable — but "should not be" is not
      -- an argument for letting a notification failure roll back a parent's
      -- record of what their child was given. Deliberately not re-raised and
      -- deliberately not logged: the error could carry row context, and
      -- audit/PHI rules say that does not go to the application log.
      null;
  end;

  return new;
end;
$$;

-- AFTER INSERT, so it runs after RLS has already accepted the write.
create trigger on_dose_logged_notify
  after insert on public.dose_events
  for each row execute procedure public.notify_on_dose_logged();

-- Not granted to authenticated/anon: this is only ever invoked as a trigger,
-- and the repo locked down SECURITY DEFINER execute grants in
-- 20260704130000_lock_down_security_definer_execute.sql. Same posture here.
revoke all on function public.notify_on_dose_logged() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Token hygiene: prune tokens unseen for 90 days.
--
-- Tokens are upserted on every app foreground, so a row that has not been
-- seen in 90 days belongs to a device that is gone. The Edge Function already
-- deletes rows on a DeviceNotRegistered receipt; this catches the quieter
-- case where a device simply stops appearing.
--
-- Exposed as a function rather than scheduled here on purpose: pg_cron is
-- available on this project but NOT installed, and installing an extension
-- with a background worker is a founder decision, not a side effect of a
-- feature migration. To enable it:
--
--   create extension if not exists pg_cron;
--   select cron.schedule('prune-device-tokens', '17 4 * * *',
--                        $$select public.prune_stale_device_tokens()$$);
--
-- Until then the table grows slowly and harmlessly; nothing depends on the
-- prune having run.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.prune_stale_device_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.device_tokens
  where last_seen < now() - interval '90 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.prune_stale_device_tokens() from public, anon, authenticated;

commit;
