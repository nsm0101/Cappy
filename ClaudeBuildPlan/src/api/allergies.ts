import { supabase } from './client';
import type { Database } from './database.types';

export type ChildAllergy = Database['public']['Tables']['child_allergies']['Row'];

export const listChildAllergies = async (childId: string): Promise<ChildAllergy[]> => {
  const { data, error } = await supabase
    .from('child_allergies')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const addChildAllergy = async (
  childId: string,
  allergen: string,
  label: string,
): Promise<ChildAllergy> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('child_allergies')
    .insert({ child_id: childId, allergen, label, created_by: userData.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const removeChildAllergy = async (id: string): Promise<void> => {
  const { error } = await supabase.from('child_allergies').delete().eq('id', id);
  if (error) throw error;
};
