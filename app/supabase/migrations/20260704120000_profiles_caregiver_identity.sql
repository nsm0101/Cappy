-- Migration: profiles_caregiver_identity
--
-- Sign in with Apple does not reliably return the caregiver's name (only
-- on the very first authorization, and never their date of birth). To make
-- dose attribution and age-aware features work, we collect the caregiver's
-- name + DOB in an in-app setup step after first sign-in and store it here.
--
--   - first_name / last_name  — caregiver's legal-ish name for display
--   - date_of_birth           — caregiver DOB (used to derive age; adults
--                               can also be dose recipients per
--                               20260630150000_caregiver_dose_recipients)
--
-- display_name is kept as the single denormalized label shown throughout
-- the app; the setup step sets it to "First Last". consent_version /
-- consent_accepted_at already exist and are captured at the same time.

begin;

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists date_of_birth date;

-- Guard: caregivers must be adults. Enforced softly (past date, not in the
-- future) at the DB layer; the client enforces the 18+ policy in the UI.
alter table public.profiles
  drop constraint if exists profiles_dob_not_future;
alter table public.profiles
  add constraint profiles_dob_not_future
  check (date_of_birth is null or date_of_birth <= current_date);

commit;
