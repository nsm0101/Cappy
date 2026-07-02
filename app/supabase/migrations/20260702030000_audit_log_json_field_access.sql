-- Fix (applied to cappy-dev 2026-07-02 via MCP): audit_log() referenced
-- old.status / old.role / old.deleted_at as direct record fields. On tables
-- lacking those columns (children has no status/role), PL/pgSQL raises
-- 42703 at expression evaluation — so EVERY UPDATE on children failed.
-- This is why photo upload "never worked": the storage upload succeeded,
-- then the children.avatar_url write blew up in the audit trigger and the
-- app surfaced "Photo upload failed". Also repaired the two orphaned
-- 2026-06-30 uploads by pointing children.avatar_url at them.
-- Optional fields are now read via to_jsonb(), which is total.

create or replace function public.audit_log()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  action_name text;
  entity_id_value uuid;
  meta jsonb;
  old_j jsonb;
  new_j jsonb;
begin
  if (tg_op = 'INSERT') then
    action_name := tg_argv[0] || '.created';
    entity_id_value := new.id;
    meta := '{}'::jsonb;
  elsif (tg_op = 'UPDATE') then
    old_j := to_jsonb(old);
    new_j := to_jsonb(new);
    if (new_j ? 'deleted_at')
       and (old_j->>'deleted_at' is null)
       and (new_j->>'deleted_at' is not null) then
      action_name := tg_argv[0] || '.deleted';
    elsif (tg_argv[0] = 'caregiver')
          and (old_j->>'status' = 'active')
          and (new_j->>'status' = 'revoked') then
      action_name := 'caregiver.revoked';
    elsif (tg_argv[0] = 'caregiver')
          and ((old_j->>'role') is distinct from (new_j->>'role')) then
      action_name := 'caregiver.role_changed';
      meta := jsonb_build_object('from', old_j->>'role', 'to', new_j->>'role');
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
$function$;
