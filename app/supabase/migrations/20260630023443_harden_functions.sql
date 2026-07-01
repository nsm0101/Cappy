-- Migration: harden_functions
--
-- Adds an explicit `search_path` to public.touch_updated_at, the one
-- trigger function from 20260101000200_triggers.sql that didn't already
-- have one (every other function in that file already set it). Pinning
-- search_path on every SECURITY DEFINER / trigger function avoids the
-- classic search_path-hijacking risk for functions that run with elevated
-- privilege.
--
-- Reconstructed from the live `cappy-dev` schema: this migration was
-- applied directly to the database and never committed. Recreated here via
-- `pg_get_functiondef` introspection so git matches what's deployed.

begin;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

commit;
