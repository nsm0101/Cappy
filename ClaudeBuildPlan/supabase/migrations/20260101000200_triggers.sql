-- Migration: 20260101000200_triggers
-- Trigger-based automation:
--   1. Auto-create profile when a new auth.users row appears
--   2. Auto-add family creator as admin caregiver
--   3. Audit logging for state changes on:
--      - families (create, update, soft-delete)
--      - family_caregivers (create, revoke, role change)
--      - children (create, update, soft-delete)
--      - dose_events (create — corrections create new rows, not updates)
--      - dose_corrections (create)
--      - nfc_tags (register, revoke)
--
-- All audit triggers are AFTER triggers — they run after RLS enforcement
-- and inside the same transaction as the originating write. If the
-- write rolls back, the audit row rolls back too.
--
-- Triggers use SECURITY DEFINER so they can write to audit_events even
-- though the calling user has no INSERT permission on it via RLS.

begin;

-- ─────────────────────────────────────────────────────────────────────
-- Auto-create profile on signup
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────
-- Auto-add family creator as admin caregiver
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.bootstrap_family_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_caregivers
    (family_id, user_id, role, status, joined_at)
  values
    (new.id, new.created_by, 'admin', 'active', now());
  return new;
end;
$$;

create trigger on_family_created
  after insert on public.families
  for each row execute procedure public.bootstrap_family_admin();

-- ─────────────────────────────────────────────────────────────────────
-- Audit logging
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text;
  entity_id_value uuid;
  meta jsonb;
begin
  -- Compose the action name as "{entity}.{verb}"
  if (tg_op = 'INSERT') then
    action_name := tg_argv[0] || '.created';
    entity_id_value := new.id;
    meta := '{}'::jsonb;
  elsif (tg_op = 'UPDATE') then
    -- Detect soft-delete (deleted_at went from null to not-null)
    if (to_jsonb(new) ? 'deleted_at')
       and (old.deleted_at is null)
       and (new.deleted_at is not null) then
      action_name := tg_argv[0] || '.deleted';
    -- Detect caregiver revocation
    elsif (tg_argv[0] = 'caregiver')
          and (old.status = 'active')
          and (new.status = 'revoked') then
      action_name := 'caregiver.revoked';
    -- Detect caregiver role change
    elsif (tg_argv[0] = 'caregiver')
          and (old.role is distinct from new.role) then
      action_name := 'caregiver.role_changed';
      meta := jsonb_build_object('from', old.role, 'to', new.role);
    else
      action_name := tg_argv[0] || '.updated';
    end if;
    entity_id_value := new.id;
    if meta is null then meta := '{}'::jsonb; end if;
  elsif (tg_op = 'DELETE') then
    action_name := tg_argv[0] || '.hard_deleted';
    entity_id_value := old.id;
    meta := '{}'::jsonb;
  end if;

  insert into public.audit_events
    (actor_user_id, actor_kind, action, entity_type, entity_id, metadata)
  values
    (auth.uid(), 'user', action_name, tg_argv[0], entity_id_value, meta);

  if (tg_op = 'DELETE') then
    return old;
  else
    return new;
  end if;
end;
$$;

-- Attach triggers
create trigger audit_families
  after insert or update on public.families
  for each row execute procedure public.audit_log('family');

create trigger audit_caregivers
  after insert or update on public.family_caregivers
  for each row execute procedure public.audit_log('caregiver');

create trigger audit_children
  after insert or update on public.children
  for each row execute procedure public.audit_log('child');

create trigger audit_dose_events
  after insert on public.dose_events
  for each row execute procedure public.audit_log('dose');

create trigger audit_dose_corrections
  after insert on public.dose_corrections
  for each row execute procedure public.audit_log('dose_correction');

create trigger audit_nfc_tags
  after insert or update on public.nfc_tags
  for each row execute procedure public.audit_log('nfc_tag');

-- ─────────────────────────────────────────────────────────────────────
-- updated_at maintenance
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

create trigger families_updated_at
  before update on public.families
  for each row execute procedure public.touch_updated_at();

create trigger children_updated_at
  before update on public.children
  for each row execute procedure public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- Marking dose corrections — when a correction lands, supersede the
-- original.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.supersede_original_dose()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dose_events
  set status = 'superseded'
  where id = new.original_dose_event_id
    and status = 'active';
  return new;
end;
$$;

create trigger on_dose_correction_created
  after insert on public.dose_corrections
  for each row execute procedure public.supersede_original_dose();

-- ─────────────────────────────────────────────────────────────────────
-- Enable realtime publication for dose_events
-- Other caregivers' devices subscribe to these to get instant updates.
-- ─────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.dose_events;
alter publication supabase_realtime add table public.family_caregivers;
alter publication supabase_realtime add table public.children;

commit;
