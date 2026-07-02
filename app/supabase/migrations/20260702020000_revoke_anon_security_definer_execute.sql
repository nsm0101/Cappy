-- SEC-2 (applied to cappy-dev 2026-07-02 via MCP): SECURITY DEFINER helpers
-- should not be callable without signing in. The app only ever calls these
-- with an authenticated session; revoking anon EXECUTE clears the four
-- anon_security_definer_function_executable advisor warnings.

revoke execute on function public.compute_dose_status(uuid, uuid, uuid) from anon;
revoke execute on function public.is_family_member(uuid, public.caregiver_role[]) from anon;
revoke execute on function public.can_log_dose_for_child(uuid) from anon;
revoke execute on function public.can_log_dose_for_caregiver(uuid, uuid) from anon;
