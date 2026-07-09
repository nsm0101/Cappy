-- Family-level settings, starting with the manual-dose-log passcode.
--
-- The passcode previously lived in the admin's local device Keychain only,
-- so no other caregiver's device could ever verify it. It now lives here,
-- hashed (sha256 of familyId + ':' + passcode), readable by any active
-- family member and writable by admins.

create table public.family_settings (
  family_id                 uuid primary key references public.families(id) on delete cascade,
  manual_dose_passcode_hash text,
  updated_by                uuid references public.profiles(id),
  updated_at                timestamptz not null default now()
);

alter table public.family_settings enable row level security;

create policy family_settings_select on public.family_settings
  for select using (public.is_family_member(family_id));

create policy family_settings_insert on public.family_settings
  for insert with check (public.is_family_member(family_id, array['admin']::caregiver_role[]));

create policy family_settings_update on public.family_settings
  for update using (public.is_family_member(family_id, array['admin']::caregiver_role[]))
  with check (public.is_family_member(family_id, array['admin']::caregiver_role[]));
