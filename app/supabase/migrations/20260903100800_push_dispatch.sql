-- Migration: 20260903100800_push_dispatch
--
-- Fires the cross-caregiver push. A dose row lands, an AFTER INSERT trigger
-- asks pg_net to POST the event id to the `push-dose-logged` Edge Function,
-- and the function fans out to APNs.
--
-- Why pg_net and not a queue: at beta volume the fan-out is a handful of
-- devices and the useful latency budget is a few seconds. A queue would add a
-- worker to operate for no gain. Revisit if p99 goes past ~5s.
--
-- Why the trigger carries no recipient logic: `push_recipients_for_dose`
-- already resolves who gets told, from preferences that live in the database.
-- The Edge Function is a transport, and it should not be possible to change
-- who receives a notification by editing TypeScript.
--
-- How the trigger authenticates, and why it is not the service role key.
-- The service role key would work. It is the wrong credential: it grants full
-- read/write over every table, and storing it in a row puts a database-wide
-- skeleton key in the database in order to authorise a caller whose only
-- permitted action is "fan this one dose out to the other caregivers". So the
-- trigger sends two things instead:
--
--   * the anon key, which satisfies the API gateway's JWT check. It is a
--     public value and safe to keep here.
--   * `trigger_secret`, which is what actually authorises. The function checks
--     it against its own PUSH_TRIGGER_SECRET and can do nothing else with it.
--
-- A leak of everything in private.app_settings now costs a push fan-out.
--
-- Deliberately NOT pushed:
--   * the logger's own devices — excluded in push_recipients_for_dose;
--   * a dose given more than `push_staleness_minutes` ago. A dose logged
--     offline at 2 AM and synced at 7 must not arrive as "just now". Its
--     coordination value expired hours earlier; the timeline carries it.
--   * a merged duplicate — the same administration someone was already told
--     about.
--
-- Configuration this migration does NOT do, because the values are per-project
-- and one of them is a secret. Until all three rows exist the trigger no-ops
-- silently, which is the correct failure mode — a missing key must never roll
-- back a dose insert:
--
--   insert into private.app_settings (key, value) values
--     ('edge_base_url',   'https://<project-ref>.functions.supabase.co'),
--     ('anon_key',        '<the project anon / publishable key>'),
--     ('trigger_secret',  '<openssl rand -base64 36 | tr +/ -_>')
--   on conflict (key) do update set value = excluded.value;
--
-- Then, matching the same random value:
--   supabase secrets set --project-ref <ref> PUSH_TRIGGER_SECRET='<same value>'
--
-- And the APNs credentials. Apple's team-scoped keys are Sandbox OR
-- Production and immutable once saved, so each environment needs its own:
--   supabase secrets set --project-ref <ref> \
--     APNS_TEAM_ID=... APNS_TOPIC=... \
--     APNS_KEY_ID_SANDBOX=... APNS_KEY_P8_SANDBOX="$(cat AuthKey_....p8)" \
--     APNS_KEY_ID_PRODUCTION=... APNS_KEY_P8_PRODUCTION="$(cat AuthKey_....p8)"

begin;

create extension if not exists pg_net with schema extensions;

create schema if not exists private;

create table if not exists private.app_settings (
  key   text primary key,
  value text not null
);

-- No policies: RLS on with zero policies denies every role that is not the
-- table owner.
alter table private.app_settings enable row level security;
revoke all on private.app_settings from authenticated, anon;

insert into public.dosing_policy (key, numeric_value, description) values
  ('push_staleness_minutes', 15,
   'A dose given longer ago than this does not generate a real-time push when it syncs. Announcing a five-hour-old dose as news is worse than silence.')
on conflict (key) do nothing;

create or replace function public.dispatch_dose_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  v_base   text;
  v_anon   text;
  v_secret text;
  v_stale  integer;
begin
  -- A dose that arrives already stale is history, not news.
  select numeric_value::integer into v_stale
  from public.dosing_policy where key = 'push_staleness_minutes';
  if new.given_at < now() - make_interval(mins => coalesce(v_stale, 15)) then
    return null;
  end if;

  -- A merged duplicate is the same administration someone was already told
  -- about. Reconciliation runs on an earlier AFTER INSERT trigger
  -- (dose_events_reconcile sorts before dose_events_zz_push by name), so the
  -- status is already settled by the time this reads it.
  if new.reconciliation_status = 'merged' then
    return null;
  end if;

  select value into v_base   from private.app_settings where key = 'edge_base_url';
  select value into v_anon   from private.app_settings where key = 'anon_key';
  select value into v_secret from private.app_settings where key = 'trigger_secret';
  if v_base is null or v_anon is null or v_secret is null then
    return null;   -- not configured yet; never fail the insert over it
  end if;

  perform net.http_post(
    url     := v_base || '/push-dose-logged',
    headers := jsonb_build_object(
                 'Content-Type',           'application/json',
                 'Authorization',          'Bearer ' || v_anon,
                 'x-cappy-trigger-secret', v_secret),
    body    := jsonb_build_object(
                 'dose_event_id', new.id,
                 'event_type',    'dose_logged_by_other'),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  -- A notification is never worth losing a dose record over.
  return null;
end;
$$;

revoke execute on function public.dispatch_dose_push() from public, anon, authenticated;

-- Named to sort after dose_events_reconcile, so reconciliation_status is
-- settled before the push decision reads it.
drop trigger if exists dose_events_zz_push on public.dose_events;
create trigger dose_events_zz_push
  after insert on public.dose_events
  for each row execute function public.dispatch_dose_push();

commit;
