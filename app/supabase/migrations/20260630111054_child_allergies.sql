-- Migration: child_allergies
--
-- One row per (child, allergen). Backs the allergy autocomplete UI on
-- ChildDetailScreen and the allergy gate in DoseSheetScreen (a medication a
-- child is allergic to is never recommended).
--
-- Reconstructed from the live `cappy-dev` schema: this migration was
-- applied directly to the database and never committed. Recreated here via
-- `information_schema`/`pg_constraint` introspection so git matches what's
-- deployed.

begin;

create table public.child_allergies (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.children(id) on delete cascade,
  allergen    text not null,
  label       text not null,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (child_id, allergen)
);
create index child_allergies_child_idx on public.child_allergies (child_id);

alter table public.child_allergies enable row level security;

create policy "child_allergies: family members read"
  on public.child_allergies for select
  using (
    exists (
      select 1
      from public.children c
      where c.id = child_allergies.child_id
        and public.is_family_member(c.family_id)
    )
  );

create policy "child_allergies: caregivers add"
  on public.child_allergies for insert
  with check (
    created_by = auth.uid()
    and public.can_log_dose_for_child(child_id)
  );

create policy "child_allergies: caregivers remove"
  on public.child_allergies for delete
  using (public.can_log_dose_for_child(child_id));

commit;
