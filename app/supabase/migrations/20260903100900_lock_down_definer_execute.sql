-- Migration: 20260903100900_lock_down_definer_execute
--
-- SEC-3: EXECUTE lockdown for everything added in the 0.8 patent-parity set.
-- Follows the pattern established by 20260704130000, which learned the hard
-- way that grants reset to the PUBLIC default every time a function is
-- re-created — so the revokes live in their own migration, applied last, and
-- must be re-run after any migration that replaces one of these functions.
--
-- This file handles the ROLE half of the problem. The USER half — a signed-in
-- caregiver passing another family's id — is handled by membership checks
-- inside the functions themselves, added in the migrations that define them.
-- Both halves are needed: a SECURITY DEFINER function runs as its owner, so
-- neither the grant nor the table's RLS is sufficient alone.
--
-- Grant model:
--   * Caller-facing RPCs: authenticated + service_role.
--   * push_recipients_for_dose: service_role ONLY — it enumerates other
--     people's device tokens, and nothing with a user session has any business
--     asking for that list.
--   * Trigger and internal functions: no API role at all. Triggers run as the
--     table owner and are never invoked over PostgREST.

-- Caller-facing.
revoke execute on function public.weight_freshness(uuid, timestamptz) from public, anon;
revoke execute on function public.expected_weight_drift(numeric, numeric) from public, anon;
revoke execute on function public.weight_staleness_months(numeric, numeric) from public, anon;
revoke execute on function public.dose_rule_for(text, numeric) from public, anon;
revoke execute on function public.evaluate_dose_presentation(uuid, uuid, uuid, binding_strength, boolean, boolean, timestamptz) from public, anon;
revoke execute on function public.active_tag_association(text, uuid) from public, anon;
revoke execute on function public.commission_tag(text, uuid, uuid, binding_strength, text, boolean, text) from public, anon;
revoke execute on function public.retire_tag(text, uuid, text) from public, anon;
revoke execute on function public.open_scan_intents(uuid) from public, anon;
revoke execute on function public.notification_enabled(uuid, uuid, uuid, notification_event) from public, anon;
revoke execute on function public.in_quiet_hours(uuid, timestamptz) from public, anon;

grant execute on function public.weight_freshness(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.expected_weight_drift(numeric, numeric) to authenticated, service_role;
grant execute on function public.weight_staleness_months(numeric, numeric) to authenticated, service_role;
grant execute on function public.dose_rule_for(text, numeric) to authenticated, service_role;
grant execute on function public.evaluate_dose_presentation(uuid, uuid, uuid, binding_strength, boolean, boolean, timestamptz) to authenticated, service_role;
grant execute on function public.active_tag_association(text, uuid) to authenticated, service_role;
grant execute on function public.commission_tag(text, uuid, uuid, binding_strength, text, boolean, text) to authenticated, service_role;
grant execute on function public.retire_tag(text, uuid, text) to authenticated, service_role;
grant execute on function public.open_scan_intents(uuid) to authenticated, service_role;
grant execute on function public.notification_enabled(uuid, uuid, uuid, notification_event) to authenticated, service_role;
grant execute on function public.in_quiet_hours(uuid, timestamptz) to authenticated, service_role;

-- Service role only.
revoke execute on function public.push_recipients_for_dose(uuid, notification_event) from public, anon, authenticated;
grant  execute on function public.push_recipients_for_dose(uuid, notification_event) to service_role;

-- Triggers and internals.
revoke execute on function public.reconcile_dose_event(uuid) from public, anon, authenticated;
revoke execute on function public.dose_events_reconcile_trigger() from public, anon, authenticated;
revoke execute on function public.dose_event_set_effective_at() from public, anon, authenticated;
revoke execute on function public.resolve_scan_intents_for_dose() from public, anon, authenticated;
revoke execute on function public.dispatch_dose_push() from public, anon, authenticated;
