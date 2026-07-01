-- Migration: caregiver_role_add_guest
--
-- Adds the 'guest' role (temporary access, e.g. a babysitter) to the
-- caregiver_role enum, alongside the existing admin/caregiver/readonly.
-- Used together with 20260630134000_guest_expiry_and_authz.sql, which adds
-- the expiry columns/checks that make a guest's access actually time out.
--
-- Reconstructed from the live `cappy-dev` schema: this migration was
-- applied directly to the database and never committed. Recreated here via
-- `pg_enum` introspection so git matches what's deployed.

alter type caregiver_role add value if not exists 'guest';
