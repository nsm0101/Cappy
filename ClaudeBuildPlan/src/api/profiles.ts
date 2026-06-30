import { supabase } from './client';

/** The signed-in caregiver's display name (used in dose-log attribution). */
export const getMyDisplayName = async (): Promise<string | null> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error) return null;
  return data?.display_name ?? null;
};

export const updateMyDisplayName = async (displayName: string): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', userData.user.id);
  if (error) throw error;
};
