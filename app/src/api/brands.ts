import { supabase } from './client';

/** Map of generic name -> chosen brand_key for a family. */
export const getFamilyBrandPrefs = async (
  familyId: string,
): Promise<Record<string, string>> => {
  const { data, error } = await supabase
    .from('family_med_brands')
    .select('generic, brand_key')
    .eq('family_id', familyId);
  if (error) throw error;
  const map: Record<string, string> = {};
  (data ?? []).forEach((r) => {
    map[r.generic] = r.brand_key;
  });
  return map;
};

export const setFamilyBrand = async (
  familyId: string,
  generic: string,
  brandKey: string,
): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');
  const { error } = await supabase.from('family_med_brands').upsert(
    {
      family_id: familyId,
      generic,
      brand_key: brandKey,
      updated_by: userData.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'family_id,generic' },
  );
  if (error) throw error;
};
