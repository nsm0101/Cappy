-- Migration: 20260903100200_dose_event_provenance
--
-- Records how an administration was identified and when it really happened, so
-- the interlocks and the reconciler have something to work with.
--
-- Three patent requirements land here.
--
-- ¶[0006]/¶[0053]: the identifier is resolved through an ordered acquisition
-- sequence — near-field, then optical, then confirmed-manual — "so that
-- failure of one channel does not defeat identification and so that the
-- channel actually used is itself recorded." Today nothing is recorded; a
-- dose logged after a clean NFC read is indistinguishable from one logged
-- after a caregiver picked the medication out of a list at 3 AM.
--
-- ¶[0007]: confidence is a property of the article, not of the identifier. A
-- token held in the vessel's recess is *strongly bound* — the storage geometry
-- maintains the association with no act by the caregiver. A carrier a user
-- applied to a syringe barrel is *weakly bound* however cleanly it reads,
-- because nothing keeps that syringe with that bottle. The two are recorded
-- separately and behave differently: a weak binding is a candidate that must
-- be affirmatively confirmed before the dose is released.
--
-- ¶[0055]: the times being compared were written by different phones, whose
-- clocks are set independently, may sit in different time zones and may have
-- drifted. Every event therefore carries the UTC offset in force where it was
-- recorded, the observed skew against the server clock when that could be
-- measured, and the residual uncertainty when it could not. `effective_at` is
-- the instant the interlocks actually use, and it is deliberately the LATE end
-- of the uncertainty band — treating a dose as later than it was only delays
-- the next one, while treating it as earlier can release a dose before the
-- interval has run.

begin;

do $$ begin
  create type acquisition_channel as enum ('nfc', 'optical', 'manual_confirmed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type binding_strength as enum ('strong', 'weak');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reconciliation_state as enum ('unreconciled', 'canonical', 'merged');
exception when duplicate_object then null; end $$;

alter table public.dose_events
  -- ── identification provenance ──────────────────────────────────────
  add column if not exists acquisition_channel   acquisition_channel,
  add column if not exists binding_strength      binding_strength,
  add column if not exists identifier_presented  text,
  add column if not exists tag_association_id    uuid,
  -- ¶[0046]: when a class identifier was used, which class the selection was
  -- made within — so a selection outside the class stays distinguishable from
  -- one inside it.
  add column if not exists identified_class      text,

  -- ── ¶[0052] incomplete history ─────────────────────────────────────
  -- The caregiver's answer to "has any dose been given that isn't in here?"
  -- null = never asked. false = they confirmed nothing is missing.
  add column if not exists unrecorded_doses_attested boolean,

  -- ── ¶[0055] time provenance ────────────────────────────────────────
  add column if not exists given_at_utc_offset_minutes integer,
  add column if not exists device_id             text,
  add column if not exists observed_clock_skew_ms bigint,
  add column if not exists time_uncertainty_ms   integer not null default 0,
  add column if not exists created_at_device     timestamptz,
  add column if not exists synced_at             timestamptz,

  -- ── ¶[0056] reconciliation ─────────────────────────────────────────
  add column if not exists effective_at          timestamptz,
  add column if not exists canonical_event_id    uuid,
  add column if not exists reconciliation_status reconciliation_state not null default 'unreconciled',
  -- Set when this row corrects another. Read by the reconciler, which must
  -- never merge a correction with the dose it corrects — see
  -- 20260903100700 for why that would hide a real dose.
  add column if not exists corrects_dose_event_id uuid;

alter table public.dose_events drop constraint if exists dose_events_corrects_fk;
alter table public.dose_events
  add constraint dose_events_corrects_fk
  foreign key (corrects_dose_event_id) references public.dose_events(id) on delete set null;

alter table public.dose_events
  drop constraint if exists dose_events_canonical_fk;
alter table public.dose_events
  add constraint dose_events_canonical_fk
  foreign key (canonical_event_id) references public.dose_events(id) on delete set null;

alter table public.dose_events
  drop constraint if exists dose_events_time_uncertainty_nonneg;
alter table public.dose_events
  add constraint dose_events_time_uncertainty_nonneg
  check (time_uncertainty_ms >= 0);

-- effective_at is never earlier than the asserted time. This is the
-- constraint that makes the "conservative direction" claim structural rather
-- than a property of whichever code path happened to write the row.
alter table public.dose_events
  drop constraint if exists dose_events_effective_not_before_given;
alter table public.dose_events
  add constraint dose_events_effective_not_before_given
  check (effective_at is null or effective_at >= given_at);

create index if not exists dose_events_effective_idx
  on public.dose_events (child_id, medication_id, effective_at desc)
  where status = 'active';

create index if not exists dose_events_canonical_idx
  on public.dose_events (canonical_event_id)
  where canonical_event_id is not null;

-- ─────────────────────────────────────────────────────────────────────
-- Backfill and maintain effective_at.
--
-- A row that never carried uncertainty is effective at its asserted time. A
-- row that does is effective at the late end of its band. The trigger only
-- ever raises effective_at, never lowers it — that one-way ratchet is what
-- ¶[0057] means by "the eligibility computation ... cannot yield a next
-- permissible administration time earlier than the time that either
-- contributing entry would have yielded standing alone".
-- ─────────────────────────────────────────────────────────────────────

update public.dose_events
   set effective_at = given_at
 where effective_at is null;

create or replace function public.dose_event_set_effective_at()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_floor timestamptz;
begin
  v_floor := new.given_at + make_interval(secs => coalesce(new.time_uncertainty_ms, 0) / 1000.0);

  if tg_op = 'INSERT' then
    new.effective_at := greatest(coalesce(new.effective_at, v_floor), v_floor);
  else
    -- Never walk an established eligibility time backwards.
    new.effective_at := greatest(
      coalesce(new.effective_at, v_floor),
      coalesce(old.effective_at, v_floor),
      v_floor);
  end if;

  if new.created_at_device is null then
    new.created_at_device := coalesce(new.logged_at, now());
  end if;
  if new.synced_at is null then
    new.synced_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists dose_events_effective_at on public.dose_events;
create trigger dose_events_effective_at
  before insert or update on public.dose_events
  for each row execute function public.dose_event_set_effective_at();

comment on column public.dose_events.effective_at is
  'Instant used for every eligibility calculation. Late end of the time-uncertainty band, raised (never lowered) by reconciliation. Patent ¶[0055]-[0057].';
comment on column public.dose_events.binding_strength is
  'strong = identifier read from an article the storage geometry keeps with its medication (vessel token). weak = article a user applied (syringe carrier); requires affirmative confirmation before release. Patent ¶[0007].';

commit;
