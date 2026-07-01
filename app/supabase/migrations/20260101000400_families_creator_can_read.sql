-- Migration: 20260101000400_families_creator_can_read
--
-- Bugfix for "could not create family".
--
-- `families.createFamily` does INSERT ... RETURNING (supabase .insert().select()).
-- The original families SELECT policy was `is_family_member(id)`, but the
-- admin membership that makes that true is created by the AFTER-INSERT
-- trigger `on_family_created` (bootstrap_family_admin). Within the same
-- statement, the RETURNING row is not yet visible under that policy, so
-- Postgres rejects it with:
--   42501: new row violates row-level security policy for table "families"
--
-- Fix: allow the creator to always read their own families. This is
-- additive/permissive (OR-ed with the membership policy) and also correct
-- on its own merits — the creator should always see families they created.

create policy "families: creator can read"
  on public.families for select
  using (created_by = auth.uid());
