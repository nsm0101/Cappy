-- Migration: guest_expiry_and_authz
--
-- Makes the 'guest' caregiver role (added in
-- 20260630112557_caregiver_role_add_guest.sql) actually time out:
--   - `family_caregivers.expires_at` — when set, the membership is treated
--     as inactive past this time (checked in `is_family_member`).
--   - `invites.guest_expires_hours` — how long a guest invite's resulting
--     membership should last; `createInvite` (src/api/families.ts) sets
--     this for proposed_role = 'guest' (24h or 7d).
-- `is_family_member` and `can_log_dose_for_child` are updated to honor the
-- expiry and to let guests log doses for children they have full access to
-- (`can_log_dose_for_child` already joined `caregiver_child_access` to
-- check `access_level`; this just adds 'guest' to the allowed role list).
--
-- Reconstructed from the live `cappy-dev` schema: this migration was
-- applied directly to the database and never committed. Recreated here via
-- `pg_get_functiondef`/`information_schema` introspection so git matches
-- what's deployed.

begin;

alter table public.family_caregivers
  add column expires_at timestamptz;

alter table public.invites
  add column guest_expires_hours integer;

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
      and (fc.expires_at is null or fc.expires_at > now())
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
      and (fc.expires_at is null or fc.expires_at > now())
      and c.deleted_at is null
      -- readonly role cannot log doses
      and fc.role in ('admin', 'caregiver', 'guest')
      and (cca.access_level is null or cca.access_level = 'full')
  );
$$;

commit;
