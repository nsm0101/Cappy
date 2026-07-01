-- Migration: family_med_brands
--
-- Per-family brand preference for a generic medication (e.g. "Tylenol" vs.
-- generic acetaminophen). Backs `src/api/brands.ts` /
-- `getFamilyBrandPrefs`, which drives the dose-card accent color and brand
-- name on DoseSheetScreen. One row per (family, generic); upserted by any
-- active family member.
--
-- Reconstructed from the live `cappy-dev` schema: this migration was
-- applied directly to the database and never committed. Recreated here via
-- `information_schema`/`pg_constraint` introspection so git matches what's
-- deployed.

begin;

create table public.family_med_brands (
  family_id   uuid not null references public.families(id) on delete cascade,
  generic     text not null,
  brand_key   text not null,
  updated_by  uuid not null references public.profiles(id),
  updated_at  timestamptz not null default now(),
  primary key (family_id, generic)
);

alter table public.family_med_brands enable row level security;

create policy "family_med_brands: members read"
  on public.family_med_brands for select
  using (public.is_family_member(family_id));

create policy "family_med_brands: members upsert"
  on public.family_med_brands for insert
  with check (
    updated_by = auth.uid()
    and public.is_family_member(family_id)
  );

create policy "family_med_brands: members update"
  on public.family_med_brands for update
  using (public.is_family_member(family_id))
  with check (
    updated_by = auth.uid()
    and public.is_family_member(family_id)
  );

commit;
