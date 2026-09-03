-- Migration: 20260903100300_tag_associations
--
-- Patent ¶[0047]: "an article whose identifier is bound to a particular
-- medication record must be capable of being rebound, because the article
-- outlives the medication."
--
-- `nfc_tags` today holds exactly one medication_id per tag and a status column.
-- Re-commissioning a token to a new bottle would overwrite the old binding,
-- which loses three things the paragraph requires:
--
--   1. "the prior association is retained in the record as a superseded
--      association rather than being discarded" — needed to read historical
--      doses correctly, since a dose logged in March was a dose of whatever
--      the token pointed at in March;
--   2. history segregation, "so that a rolling-window limit is not computed
--      across two different medications merely because both were administered
--      from the same vessel";
--   3. retirement — "a token that is lost or damaged is replaced ... whereupon
--      the identifier of the lost token is marked as retired and ceases to
--      resolve."
--
-- An association is append-only. Rebinding writes a new row and stamps the old
-- one superseded; it never mutates a binding that doses were logged against.

begin;

create table if not exists public.tag_associations (
  id                    uuid primary key default gen_random_uuid(),
  tag_uid               text not null,
  family_id             uuid not null references public.families(id) on delete cascade,
  medication_id         uuid not null references public.medications(id),

  -- ¶[0007]: which physical article carries this identifier decides whether an
  -- identification from it may resolve directly or is only a candidate.
  binding_strength      binding_strength not null default 'strong',

  -- ¶[0046]: a class identifier is written at manufacture and dedicated to no
  -- one product. It narrows what is offered; it never authorises a dose on its
  -- own.
  is_class_identifier   boolean not null default false,
  medication_class      text,

  -- ¶[0047]: "the device may require that a re-association be grounded in a
  -- machine-readable source acquired from the new container."
  commissioning_source  text not null default 'manual'
    check (commissioning_source in ('factory_class', 'optical_from_container', 'nfc', 'manual')),
  commissioned_by       uuid not null references public.profiles(id),
  commissioned_at       timestamptz not null default now(),

  superseded_at         timestamptz,
  superseded_by         uuid references public.tag_associations(id),
  retired_at            timestamptz,
  retirement_reason     text,

  check (superseded_at is null or superseded_by is not null or retired_at is not null)
);

-- One live association per (tag, family). Superseded and retired rows stay.
create unique index if not exists tag_associations_active_unique
  on public.tag_associations (tag_uid, family_id)
  where superseded_at is null and retired_at is null;

create index if not exists tag_associations_family_idx
  on public.tag_associations (family_id, tag_uid);

alter table public.dose_events
  drop constraint if exists dose_events_tag_association_fk;
alter table public.dose_events
  add constraint dose_events_tag_association_fk
  foreign key (tag_association_id) references public.tag_associations(id) on delete set null;

alter table public.tag_associations enable row level security;

drop policy if exists tag_associations_read on public.tag_associations;
create policy tag_associations_read on public.tag_associations
  for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists tag_associations_write on public.tag_associations
;
create policy tag_associations_write on public.tag_associations
  for insert to authenticated
  with check (public.is_family_member(family_id, array['admin','caregiver']::caregiver_role[])
              and commissioned_by = auth.uid());

drop policy if exists tag_associations_update on public.tag_associations;
create policy tag_associations_update on public.tag_associations
  for update to authenticated
  using (public.is_family_member(family_id, array['admin','caregiver']::caregiver_role[]));

-- ─────────────────────────────────────────────────────────────────────
-- commission_tag — the one supported way to bind or rebind an article.
--
-- Supersession and insertion happen in a single statement so that no window
-- exists in which a tag has two live associations, or none.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.commission_tag(
  p_tag_uid             text,
  p_family_id           uuid,
  p_medication_id       uuid,
  p_binding_strength    binding_strength default 'strong',
  p_commissioning_source text default 'manual',
  p_is_class_identifier boolean default false,
  p_medication_class    text default null
)
returns public.tag_associations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prior public.tag_associations;
  v_new   public.tag_associations;
begin
  if not public.is_family_member(p_family_id, array['admin','caregiver']::caregiver_role[]) then
    raise exception 'Not permitted to commission tags for this family'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_prior
  from public.tag_associations
  where tag_uid = p_tag_uid and family_id = p_family_id
    and superseded_at is null and retired_at is null
  for update;

  -- Rebinding to the medication already in force is a no-op, not a new row.
  if found and v_prior.medication_id = p_medication_id
     and v_prior.binding_strength = p_binding_strength then
    return v_prior;
  end if;

  insert into public.tag_associations
    (tag_uid, family_id, medication_id, binding_strength, is_class_identifier,
     medication_class, commissioning_source, commissioned_by)
  values
    (p_tag_uid, p_family_id, p_medication_id, p_binding_strength, p_is_class_identifier,
     p_medication_class, p_commissioning_source, auth.uid())
  returning * into v_new;

  if v_prior.id is not null then
    update public.tag_associations
       set superseded_at = now(), superseded_by = v_new.id
     where id = v_prior.id;
  end if;

  return v_new;
end;
$$;

create or replace function public.retire_tag(
  p_tag_uid   text,
  p_family_id uuid,
  p_reason    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_family_member(p_family_id, array['admin']::caregiver_role[]) then
    raise exception 'Only a family admin may retire a tag'
      using errcode = 'insufficient_privilege';
  end if;

  update public.tag_associations
     set retired_at = now(), retirement_reason = p_reason
   where tag_uid = p_tag_uid and family_id = p_family_id
     and superseded_at is null and retired_at is null;
end;
$$;

-- The association in force for a tag right now, or null if the identifier has
-- been retired and must cease to resolve.
create or replace function public.active_tag_association(
  p_tag_uid   text,
  p_family_id uuid
)
returns public.tag_associations
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.tag_associations
  where tag_uid = p_tag_uid
    and family_id = p_family_id
    and superseded_at is null
    and retired_at is null
    -- Membership check inside the function: as a SECURITY DEFINER it bypasses
    -- the table's RLS, and which medication a family's article points at is
    -- theirs.
    and (auth.uid() is null or public.is_family_member(p_family_id))
  limit 1;
$$;

grant execute on function public.commission_tag(text, uuid, uuid, binding_strength, text, boolean, text) to authenticated;
grant execute on function public.retire_tag(text, uuid, text) to authenticated;
grant execute on function public.active_tag_association(text, uuid) to authenticated;

-- Backfill: every existing nfc_tags row becomes its family's live association,
-- so nothing that already works stops working.
insert into public.tag_associations
  (tag_uid, family_id, medication_id, binding_strength, commissioning_source,
   commissioned_by, commissioned_at, retired_at, retirement_reason)
select t.tag_uid, t.family_id, t.medication_id, 'strong', 'manual',
       t.registered_by, t.registered_at,
       case when t.status = 'revoked' then coalesce(t.revoked_at, now()) end,
       case when t.status = 'revoked' then 'Migrated from nfc_tags.status = revoked' end
from public.nfc_tags t
where not exists (
  select 1 from public.tag_associations a
  where a.tag_uid = t.tag_uid and a.family_id = t.family_id
);

commit;
