-- SEC-2 (complete, both projects): lock down EXECUTE on all SECURITY DEFINER
-- functions. Supersedes 20260702020000_revoke_anon_security_definer_execute,
-- whose revokes were silently undone whenever a later migration re-created a
-- function with DROP/CREATE (grants reset to the PUBLIC default).
--
-- Verified 2026-07-04 (advisors + pg_proc grant audit on cappy-prod):
--   all 8 SECURITY DEFINER functions were anon-executable on prod; the four
--   helper RPCs had regressed on dev too.
--
-- Grant model:
--   * Helper RPCs / RLS predicates (compute_dose_status, is_family_member,
--     can_log_dose_for_child, can_log_dose_for_caregiver): authenticated +
--     service_role only. The app calls compute_dose_status with a session;
--     the others back RLS policies, which run with the caller's privileges,
--     so authenticated MUST keep EXECUTE.
--   * Trigger/internal functions (audit_log, handle_new_user,
--     supersede_original_dose, bootstrap_family_admin): not callable via
--     the API by anyone. Triggers run as table owner; grep confirms no
--     .rpc() call sites in src/ or edge functions.

-- Helper RPCs / RLS predicates: authenticated (+ service_role) only.
revoke execute on function public.compute_dose_status(uuid, uuid, uuid) from public, anon;
revoke execute on function public.is_family_member(uuid, public.caregiver_role[]) from public, anon;
revoke execute on function public.can_log_dose_for_child(uuid) from public, anon;
revoke execute on function public.can_log_dose_for_caregiver(uuid, uuid) from public, anon;

grant execute on function public.compute_dose_status(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.is_family_member(uuid, public.caregiver_role[]) to authenticated, service_role;
grant execute on function public.can_log_dose_for_child(uuid) to authenticated, service_role;
grant execute on function public.can_log_dose_for_caregiver(uuid, uuid) to authenticated, service_role;

-- Trigger/internal functions: no API role may call them.
revoke execute on function public.audit_log() from public, anon, authenticated;
revoke execute on function public.bootstrap_family_admin() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.supersede_original_dose() from public, anon, authenticated;
