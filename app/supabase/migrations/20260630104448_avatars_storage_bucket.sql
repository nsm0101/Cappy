-- Migration: avatars_storage_bucket
--
-- Private Storage bucket for child/profile avatar photos. RLS is scoped to
-- the family encoded in the object path's first folder segment — the app
-- (src/api/avatars.ts) uploads to `{familyId}/{childId}.jpg`, so
-- `storage.foldername(name)[1]` recovers the family id directly without a
-- join. Any active family member (not just admins) can manage a child's
-- photo, matching how `can_log_dose_for_child`-style features are scoped
-- elsewhere in this schema. Photos are never public — every view fetches a
-- short-lived signed URL via `signedAvatarUrl`.
--
-- Reconstructed from the live `cappy-dev` schema: this migration was
-- applied directly to the database and never committed. Recreated here via
-- `pg_policy`/`storage.buckets` introspection so git matches what's
-- deployed.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: family members read"
  on storage.objects for select
  using (
    bucket_id = 'avatars'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "avatars: family members upload"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "avatars: family members update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "avatars: family members delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

commit;
