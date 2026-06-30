-- Migration: 20260101000100_rls
-- Row-Level Security policies.
--
-- Authorization model:
--   - profiles: a user can only read/write their own profile.
--   - families & family-scoped tables: visibility scoped to active
--     caregiver membership. Role enforces what role can do.
--   - medications: world-readable (it's a catalog).
--   - audit_events: read-only for the authenticated user, scoped to
--     their own actor_user_id. (Cross-family audit access is admin-only,
--     handled via service-role from Edge Functions.)
--
-- Helper: is_family_member(family_id, required_roles) returns boolean.
--
-- Note on RLS testing: every policy below should have a corresponding
-- pgTAP test. We'll add the test suite in a follow-up migration.

begin;

-- ─────────────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.is_family_member(
  family_uuid uuid,
  required_roles caregiver_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_caregivers fc
    where fc.family_id = family_uuid
      and fc.user_id = auth.uid()
      and fc.status = 'active'
      and (
        required_roles is null
        or fc.role = any (required_roles)
      )
  );
$$;

create or replace function public.can_log_dose_for_child(
  child_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.children c
    join public.family_caregivers fc on fc.family_id = c.family_id
    left join public.caregiver_child_access cca
      on cca.family_caregiver_id = fc.id and cca.child_id = c.id
    where c.id = child_uuid
      and fc.user_id = auth.uid()
      and fc.status = 'active'
      and c.deleted_at is null
      -- readonly role cannot log doses
      and fc.role in ('admin', 'caregiver')
      -- per-child override: 'none' or 'readonly' blocks logging
      and (cca.access_level is null or cca.access_level = 'full')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

create policy "profiles: own row, select"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: own row, update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- A user can also see the display_name of any caregiver in their families.
-- Implemented as a separate policy so it's purely additive.
create policy "profiles: visible to fellow caregivers"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.family_caregivers me
      join public.family_caregivers them
        on them.family_id = me.family_id
      where me.user_id = auth.uid()
        and me.status = 'active'
        and them.user_id = public.profiles.id
        and them.status = 'active'
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- families
-- ─────────────────────────────────────────────────────────────────────

alter table public.families enable row level security;

create policy "families: members can read"
  on public.families for select
  using (public.is_family_member(id));

create policy "families: any auth user can create"
  on public.families for insert
  with check (created_by = auth.uid());

create policy "families: admin can update"
  on public.families for update
  using (public.is_family_member(id, array['admin']::caregiver_role[]))
  with check (public.is_family_member(id, array['admin']::caregiver_role[]));

-- (No delete policy — soft-delete via deleted_at via update.)

-- ─────────────────────────────────────────────────────────────────────
-- family_caregivers
-- ─────────────────────────────────────────────────────────────────────

alter table public.family_caregivers enable row level security;

create policy "family_caregivers: members can read"
  on public.family_caregivers for select
  using (public.is_family_member(family_id));

create policy "family_caregivers: admin can manage"
  on public.family_caregivers for all
  using (public.is_family_member(family_id, array['admin']::caregiver_role[]))
  with check (public.is_family_member(family_id, array['admin']::caregiver_role[]));

-- Creator of family is admin (initial insert when family is created).
-- Done via accept-invite edge function for additional caregivers.

-- ─────────────────────────────────────────────────────────────────────
-- children
-- ─────────────────────────────────────────────────────────────────────

alter table public.children enable row level security;

create policy "children: family members can read"
  on public.children for select
  using (public.is_family_member(family_id));

create policy "children: admin can manage"
  on public.children for all
  using (public.is_family_member(family_id, array['admin']::caregiver_role[]))
  with check (public.is_family_member(family_id, array['admin']::caregiver_role[]));

-- ─────────────────────────────────────────────────────────────────────
-- caregiver_child_access
-- ─────────────────────────────────────────────────────────────────────

alter table public.caregiver_child_access enable row level security;

create policy "caregiver_child_access: members can read"
  on public.caregiver_child_access for select
  using (
    exists (
      select 1
      from public.family_caregivers fc
      where fc.id = caregiver_child_access.family_caregiver_id
        and public.is_family_member(fc.family_id)
    )
  );

create policy "caregiver_child_access: admin can manage"
  on public.caregiver_child_access for all
  using (
    exists (
      select 1
      from public.family_caregivers fc
      where fc.id = caregiver_child_access.family_caregiver_id
        and public.is_family_member(fc.family_id, array['admin']::caregiver_role[])
    )
  )
  with check (
    exists (
      select 1
      from public.family_caregivers fc
      where fc.id = caregiver_child_access.family_caregiver_id
        and public.is_family_member(fc.family_id, array['admin']::caregiver_role[])
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- invites
-- ─────────────────────────────────────────────────────────────────────

alter table public.invites enable row level security;

-- Admins of the family can read and create invites.
create policy "invites: admin can read"
  on public.invites for select
  using (public.is_family_member(family_id, array['admin']::caregiver_role[]));

create policy "invites: admin can create"
  on public.invites for insert
  with check (
    created_by = auth.uid()
    and public.is_family_member(family_id, array['admin']::caregiver_role[])
  );

-- Invite acceptance happens via Edge Function (service role) so the
-- joining user doesn't need read access to the invites table.

-- ─────────────────────────────────────────────────────────────────────
-- weight_records
-- ─────────────────────────────────────────────────────────────────────

alter table public.weight_records enable row level security;

create policy "weight_records: family members read"
  on public.weight_records for select
  using (
    exists (
      select 1
      from public.children c
      where c.id = weight_records.child_id
        and public.is_family_member(c.family_id)
    )
  );

create policy "weight_records: caregivers write"
  on public.weight_records for insert
  with check (
    recorded_by = auth.uid()
    and public.can_log_dose_for_child(child_id)
  );

-- ─────────────────────────────────────────────────────────────────────
-- medications (catalog — world-readable to any authenticated user)
-- ─────────────────────────────────────────────────────────────────────

alter table public.medications enable row level security;

create policy "medications: read for auth users"
  on public.medications for select
  using (auth.role() = 'authenticated');

-- Writes are admin-only via service role.

-- ─────────────────────────────────────────────────────────────────────
-- nfc_tags
-- ─────────────────────────────────────────────────────────────────────

alter table public.nfc_tags enable row level security;

create policy "nfc_tags: family members read"
  on public.nfc_tags for select
  using (public.is_family_member(family_id));

create policy "nfc_tags: admin manages"
  on public.nfc_tags for all
  using (public.is_family_member(family_id, array['admin']::caregiver_role[]))
  with check (public.is_family_member(family_id, array['admin']::caregiver_role[]));

-- ─────────────────────────────────────────────────────────────────────
-- dose_events
-- ─────────────────────────────────────────────────────────────────────

alter table public.dose_events enable row level security;

create policy "dose_events: family members read"
  on public.dose_events for select
  using (
    exists (
      select 1
      from public.children c
      where c.id = dose_events.child_id
        and public.is_family_member(c.family_id)
    )
  );

create policy "dose_events: caregivers log"
  on public.dose_events for insert
  with check (
    logged_by = auth.uid()
    and public.can_log_dose_for_child(child_id)
  );

-- No update or delete from app (corrections create new rows).

-- ─────────────────────────────────────────────────────────────────────
-- dose_corrections
-- ─────────────────────────────────────────────────────────────────────

alter table public.dose_corrections enable row level security;

create policy "dose_corrections: family members read"
  on public.dose_corrections for select
  using (
    exists (
      select 1
      from public.dose_events de
      join public.children c on c.id = de.child_id
      where de.id = dose_corrections.original_dose_event_id
        and public.is_family_member(c.family_id)
    )
  );

create policy "dose_corrections: caregivers create"
  on public.dose_corrections for insert
  with check (
    corrected_by = auth.uid()
    and exists (
      select 1
      from public.dose_events de
      where de.id = original_dose_event_id
        and public.can_log_dose_for_child(de.child_id)
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- audit_events
-- Read scoped to the actor themselves. Cross-family / cross-actor audit
-- queries go through Edge Functions with service role.
-- ─────────────────────────────────────────────────────────────────────

alter table public.audit_events enable row level security;

create policy "audit_events: read own actor rows"
  on public.audit_events for select
  using (actor_user_id = auth.uid());

-- Inserts come exclusively from triggers (security definer), not from
-- direct client writes. No insert policy → blocked by RLS default.

commit;
