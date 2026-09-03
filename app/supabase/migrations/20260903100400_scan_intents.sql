-- Migration: 20260903100400_scan_intents
--
-- "Forgot to log your dose?"
--
-- The gap this closes is the one the patent names in ¶[0052]: "the interlocks
-- operate upon the administration history that has been recorded, and an
-- administration that was never recorded is not visible to them." Every
-- interval rule in the app is only as good as the log, and the most common way
-- the log goes wrong is entirely mundane — a caregiver taps the token, reads
-- the dose, draws it up, gives it to a child who is crying at 2 AM, and never
-- comes back to the phone.
--
-- A tap plus a selected recipient is a strong signal that a dose was about to
-- be given. It is not proof that one was: the caregiver may have checked and
-- found it was too early, or been interrupted. So the reminder asks rather
-- than asserts, and an unanswered intent never becomes an administration
-- event — inventing a dose would corrupt the very history the interlocks
-- depend on.
--
-- The row exists server-side (not just as a local notification) for two
-- reasons: the dose may be logged from the *other* parent's phone, which
-- should silence the prompt here; and an intent that expired unanswered is
-- exactly the "gap inconsistent with the configured interval" that ¶[0052]
-- says the device may surface rather than pretend away.

begin;

insert into public.dosing_policy (key, numeric_value, description) values
  ('unlogged_dose_grace_minutes', 20,
   'Minutes after a tag is tapped and a recipient selected before the caregiver is asked whether a dose was given but not logged. Long enough to actually administer a dose and settle a child; short enough that the answer is still remembered.'),
  ('unlogged_dose_expiry_hours', 6,
   'An intent older than this is abandoned rather than asked about. A caregiver cannot reliably recall at breakfast whether a 1 AM tap ended in a dose, and a guess here poisons the interval history.')
on conflict (key) do nothing;

create table if not exists public.scan_intents (
  id                     uuid primary key,   -- client-generated, idempotent
  family_id              uuid not null references public.families(id) on delete cascade,
  medication_id          uuid references public.medications(id),
  tag_uid                text,
  tag_association_id     uuid references public.tag_associations(id) on delete set null,
  acquisition_channel    acquisition_channel not null,
  binding_strength       binding_strength,

  -- The recipient whose dosing information was presented. Exactly one.
  child_id               uuid references public.children(id) on delete cascade,
  caregiver_user_id      uuid references public.profiles(id) on delete cascade,

  actor_user_id          uuid not null references public.profiles(id) on delete cascade,
  device_id              text,

  opened_at              timestamptz not null default now(),
  -- Whether a dose volume was actually released to the screen. An intent that
  -- ended in a suppressed dose is weaker evidence and is recorded as such.
  dose_released          boolean not null default false,

  remind_at              timestamptz not null,
  reminded_at            timestamptz,
  resolved_dose_event_id uuid references public.dose_events(id) on delete set null,
  resolved_at            timestamptz,
  dismissed_at           timestamptz,
  dismissal              text check (dismissal in ('no_dose_given', 'logged_elsewhere', 'expired')),

  check ((child_id is not null) <> (caregiver_user_id is not null))
);

create index if not exists scan_intents_open_idx
  on public.scan_intents (remind_at)
  where resolved_at is null and dismissed_at is null;

create index if not exists scan_intents_actor_idx
  on public.scan_intents (actor_user_id, opened_at desc);

create index if not exists scan_intents_recipient_idx
  on public.scan_intents (child_id, medication_id, opened_at desc)
  where resolved_at is null and dismissed_at is null;

alter table public.scan_intents enable row level security;

drop policy if exists scan_intents_read on public.scan_intents;
create policy scan_intents_read on public.scan_intents
  for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists scan_intents_insert on public.scan_intents;
create policy scan_intents_insert on public.scan_intents
  for insert to authenticated
  with check (actor_user_id = auth.uid() and public.is_family_member(family_id));

drop policy if exists scan_intents_update on public.scan_intents;
create policy scan_intents_update on public.scan_intents
  for update to authenticated
  using (actor_user_id = auth.uid() or public.is_family_member(family_id));

-- ─────────────────────────────────────────────────────────────────────
-- Any dose logged for the same recipient and medication after the tap
-- answers the question. Resolution is by recipient, not by device, so a dose
-- logged on the other parent's phone silences the prompt here too.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.resolve_scan_intents_for_dose()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.scan_intents si
     set resolved_dose_event_id = new.id,
         resolved_at = now(),
         dismissal = case when si.actor_user_id = new.logged_by
                          then null else 'logged_elsewhere' end
   where si.resolved_at is null
     and si.dismissed_at is null
     and si.medication_id is not distinct from new.medication_id
     and (
       (new.child_id is not null and si.child_id = new.child_id) or
       (new.caregiver_user_id is not null and si.caregiver_user_id = new.caregiver_user_id)
     )
     -- The tap must precede the dose, with a little slack for a caregiver who
     -- back-dated "given 10 minutes ago" after tapping.
     and si.opened_at <= new.logged_at + interval '2 minutes'
     and si.opened_at >= new.given_at - interval '6 hours';
  return new;
end;
$$;

drop trigger if exists dose_events_resolve_scan_intents on public.dose_events;
create trigger dose_events_resolve_scan_intents
  after insert on public.dose_events
  for each row execute function public.resolve_scan_intents_for_dose();

-- ─────────────────────────────────────────────────────────────────────
-- open_scan_intents — what this caregiver still owes an answer on.
-- Intents past the expiry window are abandoned rather than surfaced.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.open_scan_intents(p_family_id uuid)
returns setof public.scan_intents
language sql
stable
security definer
set search_path = public
as $$
  select si.*
  from public.scan_intents si
  where si.family_id = p_family_id
    and si.actor_user_id = auth.uid()
    and si.resolved_at is null
    and si.dismissed_at is null
    and si.remind_at <= now()
    and si.opened_at > now() - make_interval(hours =>
          coalesce((select numeric_value::integer from public.dosing_policy
                     where key = 'unlogged_dose_expiry_hours'), 6))
  order by si.opened_at desc;
$$;

grant execute on function public.open_scan_intents(uuid) to authenticated;

commit;
