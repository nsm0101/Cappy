import { decode } from 'base64-arraybuffer';
import { supabase } from './client';

const BUCKET = 'avatars';

/**
 * Upload a child's avatar (base64 JPEG) to the private `avatars` bucket at
 * `{familyId}/{childId}.jpg` and store that path on the child record.
 * Returns the storage path. Display goes through `signedAvatarUrl`.
 */
export const uploadChildAvatar = async (
  familyId: string,
  childId: string,
  base64Jpeg: string,
): Promise<string> => {
  const path = `${familyId}/${childId}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64Jpeg), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;

  const { error: updateError } = await supabase
    .from('children')
    .update({ avatar_url: path })
    .eq('id', childId);
  if (updateError) throw updateError;

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
