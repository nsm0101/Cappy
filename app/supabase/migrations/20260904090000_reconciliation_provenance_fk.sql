-- Migration: 20260904090000_reconciliation_provenance_fk
--
-- Claim 20 requires the caregiver devices to display a reconciliation status
-- and a common administration time "while the shared administration record
-- retains the source metadata and original local identifiers" of both events.
--
-- The record already retains all of it. What was missing is a way for the
-- client to read the *who* without a second round trip: merged_logged_by was
-- a bare uuid with no foreign key, so PostgREST could not embed the profile
-- and the audit disclosure could only have said "another device" — which is
-- provenance in the database and not provenance in the interface.
--
-- dose_event_reconciliations is empty on both projects, so this validates
-- instantly.

alter table public.dose_event_reconciliations
  drop constraint if exists dose_event_reconciliations_merged_logged_by_fkey;

alter table public.dose_event_reconciliations
  add constraint dose_event_reconciliations_merged_logged_by_fkey
  foreign key (merged_logged_by) references public.profiles(id) on delete set null;

comment on column public.dose_event_reconciliations.merged_logged_by is
  'Caregiver who recorded the entry that was merged away. Kept so the timeline can attribute each source of a reconciled administration. Patent para 0058.';

-- Corrects the read policy from 20260903100700. `dose_events` also has a
-- canonical_event_id column, so the unqualified reference inside the subquery
-- bound to the inner table: the stored predicate was `de.id =
-- de.canonical_event_id`, false for every canonical row, and the audit trail
-- returned nothing to every client while looking correct in the schema.
-- (20260903100700 is fixed at source too, for a clean install.)
drop policy if exists dose_event_reconciliations_read on public.dose_event_reconciliations;

create policy dose_event_reconciliations_read on public.dose_event_reconciliations
  for select to authenticated
  using (exists (
    select 1 from public.dose_events de
    where de.id = dose_event_reconciliations.canonical_event_id
      and public.is_family_member(de.family_id)
  ));
