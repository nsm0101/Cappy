import { decode } from 'base64-arraybuffer';
import { supabase } from './client';

const BUCKET = 'avatars';

/** Best-effort delete of a replaced photo; never fails the upload. */
const removeOldObject = async (oldPath: string | null | undefined, newPath: string) => {
  if (!oldPath || oldPath === newPath) return;
  try {
    await supabase.storage.from(BUCKET).remove([oldPath]);
  } catch {
    // Orphaned old object is harmless; don't fail a successful upload.
  }
};

/**
 * Upload a child's avatar (base64 JPEG) to the private `avatars` bucket.
 * Paths are VERSIONED (`{familyId}/{childId}-{ts}.jpg`) so replacing a photo
 * changes the stored path — this busts every cache layer (component state,
 * RN image cache, CDN) that made overwritten fixed-path photos appear stale.
 * The previous object is deleted best-effort after the record points at the
 * new one. Display goes through `signedAvatarUrl`.
 */
export const uploadChildAvatar = async (
  familyId: string,
  childId: string,
  base64Jpeg: string,
): Promise<string> => {
  const { data: existing } = await supabase
    .from('children')
    .select('avatar_url')
    .eq('id', childId)
    .maybeSingle();

  const path = `${familyId}/${childId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64Jpeg), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;

  const { error: updateError } = await supabase
    .from('children')
    .update({ avatar_url: path })
    .eq('id', childId);
  if (updateError) throw updateError;

  await removeOldObject(existing?.avatar_url, path);
  return path;
};

/**
 * Upload the current user's avatar (base64 JPEG) to the private `avatars`
 * bucket at a versioned `{familyId}/caregiver-{userId}-{ts}.jpg` path and
 * store that path on the user's profile record. Old photo is deleted
 * best-effort. Display goes through `signedAvatarUrl`.
 */
export const uploadMyAvatar = async (
  familyId: string,
  base64Jpeg: string,
): Promise<string> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');

  const { data: existing } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userData.user.id)
    .maybeSingle();

  const path = `${familyId}/caregiver-${userData.user.id}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64Jpeg), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: path })
    .eq('id', userData.user.id);
  if (updateError) throw updateError;

  await removeOldObject(existing?.avatar_url, path);
  return path;
};

/**
 * Resolve a stored avatar path to a short-lived signed URL for display.
 * Children's photos are never public — every view fetches its own URL.
 */
export const signedAvatarUrl = async (
  path: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> => {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
};
