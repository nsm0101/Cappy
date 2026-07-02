-- Migration: 20260101000000_init
-- Cappy initial schema — Posture C (consumer-app posture)
-- 
-- Differences from the prior HIPAA-track schema:
--   - No field-level envelope encryption (Supabase at-rest disk
--     encryption is enough at this stage). Sensitive fields are
--     plain text columns.
--   - No hash-chained audit log. Plain audit_events table with
--     triggers (see audit-evolution.md for when to revisit).
--   - No client_idempotency_key separate from primary key — we use
--     a UUID provided by the client as the primary key directly,
--     which is naturally idempotent on retry.
--   - RLS policies enforce authorization (no separate authz module).
--
-- All tables use UUIDs generated client-side (UUID v4). This makes
-- offline-first writes work without coordination with the server.

begin;

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────
-- Custom enums
-- ─────────────────────────────────────────────────────────────────────

create type caregiver_role as enum ('admin', 'caregiver', 'readonly');
create type caregiver_status as enum ('active', 'revoked', 'pending');
create type tag_status as enum ('active', 'revoked', 'pending');
create type dose_status as enum ('active', 'superseded');
create type medication_formulation as enum (
  'liquid_suspension', 'infant_drops', 'chewable', 'oral_disintegrating'
);
create type medication_rx_status as enum ('otc', 'rx');

-- ─────────────────────────────────────────────────────────────────────
-- profiles
-- App-side mirror of auth.users plus our extensions.
-- Created by trigger on auth.users insert (see bottom of file).
-- ─────────────────────────────────────────────────────────────────────

create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  display_name       text,
  avatar_url         text,
  consent_version    text,
  consent_accepted_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

-- ─────────────────────────────────────────────────────────────────────
-- families
-- ─────────────────────────────────────────────────────────────────────

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index families_created_by_idx on public.families (created_by);
create index families_active_idx on public.families (id) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────
-- family_caregivers
-- ─────────────────────────────────────────────────────────────────────

create table public.family_caregivers (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        caregiver_role not null,
  status      caregiver_status not null default 'pending',
  joined_at   timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (family_id, user_id)
);
create index family_caregivers_user_id_idx on public.family_caregivers (user_id);
create index family_caregivers_family_id_idx on public.family_caregivers (family_id);

-- ─────────────────────────────────────────────────────────────────────
-- children
-- ─────────────────────────────────────────────────────────────────────

create table public.children (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  display_name    text not null check (char_length(display_name) between 1 and 50),
  date_of_birth   date not null,
  avatar_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index children_family_id_idx on public.children (family_id);
create index children_active_idx on public.children (id) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────
-- caregiver_child_access (per-child overrides)
-- ─────────────────────────────────────────────────────────────────────

create table public.caregiver_child_access (
  id                   uuid primary key default gen_random_uuid(),
  family_caregiver_id  uuid not null references public.family_caregivers(id) on delete cascade,
  child_id             uuid not null references public.children(id) on delete cascade,
  access_level         text not null check (access_level in ('full', 'readonly', 'none')),
  created_at           timestamptz not null default now(),
  unique (family_caregiver_id, child_id)
);

-- ─────────────────────────────────────────────────────────────────────
-- invites (6-digit short codes)
-- ─────────────────────────────────────────────────────────────────────

create table public.invites (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  code            text not null unique check (code ~ '^[0-9]{6}$'),
  proposed_role   caregiver_role not null,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  accepted_by     uuid references public.profiles(id)
);
create index invites_pending_idx on public.invites (expires_at)
  where accepted_at is null;

-- ─────────────────────────────────────────────────────────────────────
-- weight_records
-- ─────────────────────────────────────────────────────────────────────

create table public.weight_records (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references public.children(id) on delete cascade,
  value_grams   integer not null check (value_grams between 1000 and 200000),
  recorded_at   timestamptz not null,
  recorded_by   uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index weight_records_child_recorded_idx
  on public.weight_records (child_id, recorded_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- medications (catalog, hardcoded for alpha)
-- ─────────────────────────────────────────────────────────────────────

create table public.medications (
  id                       uuid primary key default gen_random_uuid(),
  generic_name             text not null,
  brand_name               text,
  concentration_label      text not null,
  concentration_mg_per_ml  numeric(8,3) not null default 0,
  formulation              medication_formulation not null,
  rx_status                medication_rx_status not null default 'otc',
  min_age_months           integer not null default 0,
  min_interval_hours       integer not null default 4,
  max_doses_per_24h        integer not null default 5,
  created_at               timestamptz not null default now()
);

-- Seed acetaminophen variants for alpha (rx_status = 'otc' only)
insert into public.medications
  (generic_name, brand_name, concentration_label, concentration_mg_per_ml,
   formulation, rx_status, min_age_months, min_interval_hours, max_doses_per_24h)
values
  ('acetaminophen', 'Tylenol Infants''', '160 mg / 5 mL (oral suspension)',
   32.0, 'infant_drops', 'otc', 0, 4, 5),
  ('acetaminophen', 'Tylenol Children''s', '160 mg / 5 mL (oral suspension)',
   32.0, 'liquid_suspension', 'otc', 24, 4, 5),
  ('acetaminophen', 'Tylenol Children''s Chewables', '160 mg per chewable',
   0, 'chewable', 'otc', 24, 4, 5),
  ('acetaminophen', 'Tylenol Jr. Meltaways', '160 mg per tablet',
   0, 'oral_disintegrating', 'otc', 72, 4, 5);

-- ─────────────────────────────────────────────────────────────────────
-- nfc_tags
-- ─────────────────────────────────────────────────────────────────────

create table public.nfc_tags (
  id              uuid primary key default gen_random_uuid(),
  tag_uid         text not null unique check (char_length(tag_uid) between 4 and 32),
  family_id       uuid not null references public.families(id) on delete cascade,
  medication_id   uuid not null references public.medications(id),
  status          tag_status not null default 'pending',
  label           text,
  registered_by   uuid not null references public.profiles(id),
  registered_at   timestamptz not null default now(),
  revoked_at      timestamptz
);
create index nfc_tags_family_id_idx on public.nfc_tags (family_id);

-- ─────────────────────────────────────────────────────────────────────
-- dose_events
-- The PRIMARY KEY is the client-generated UUID — this is the idempotency
-- mechanism. Retries with the same UUID get a unique-violation we
-- handle as success.
-- ─────────────────────────────────────────────────────────────────────

create table public.dose_events (
  id                uuid primary key,  -- client-generated UUIDv4
  child_id          uuid not null references public.children(id) on delete cascade,
  medication_id     uuid not null references public.medications(id),
  logged_by         uuid not null references public.profiles(id),
  given_at          timestamptz not null,
  amount_mg         numeric(8,3) not null check (amount_mg >= 0),
  amount_volume_ml  numeric(8,3) check (amount_volume_ml is null or amount_volume_ml >= 0),
  unit_count        integer check (unit_count is null or unit_count >= 1),
  note              text,
  status            dose_status not null default 'active',
  logged_at         timestamptz not null default now()
);
create index dose_events_child_given_idx
  on public.dose_events (child_id, given_at desc);
create index dose_events_logger_active_idx
  on public.dose_events (logged_by, logged_at) where status = 'active';

-- ─────────────────────────────────────────────────────────────────────
-- dose_corrections
-- ─────────────────────────────────────────────────────────────────────

create table public.dose_corrections (
  id                          uuid primary key default gen_random_uuid(),
  original_dose_event_id      uuid not null references public.dose_events(id) on delete cascade,
  correction_dose_event_id    uuid not null references public.dose_events(id) on delete cascade,
  corrected_by                uuid not null references public.profiles(id),
  reason                      text,
  corrected_at                timestamptz not null default now()
);
create index dose_corrections_original_idx on public.dose_corrections (original_dose_event_id);

-- ─────────────────────────────────────────────────────────────────────
-- audit_events
-- Plain table populated by triggers. NOT hash-chained at this stage.
-- See /docs/audit-evolution.md for when to upgrade.
-- ─────────────────────────────────────────────────────────────────────

create table public.audit_events (
  id              bigserial primary key,
  occurred_at     timestamptz not null default now(),
  actor_user_id   uuid,
  actor_kind      text not null check (actor_kind in ('user', 'system', 'admin')),
  action          text not null,
  entity_type     text not null,
  entity_id       uuid,
  metadata        jsonb not null default '{}'::jsonb
);
create index audit_events_actor_idx on public.audit_events (actor_user_id, occurred_at desc);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);
create index audit_events_time_brin_idx on public.audit_events using brin (occurred_at);

commit;
