import { supabase } from './client';
import type { Database } from './database.types';

export type Child = Database['public']['Tables']['children']['Row'];

export const listChildrenInFamily = async (familyId: string): Promise<Child[]> => {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

export type CreateChildInput = {
  familyId: string;
  displayName: string;
  dateOfBirth: string; // YYYY-MM-DD
};

export const createChild = async (input: CreateChildInput): Promise<Child> => {
  const { data, error } = await supabase
    .from('children')
    .insert({
      family_id: input.familyId,
      display_name: input.displayName.trim(),
      date_of_birth: input.dateOfBirth,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const recordWeight = async (
  childId: string,
  valueGrams: number,
  recordedAt: Date = new Date(),
): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');

  const { error } = await supabase.from('weight_records').insert({
    child_id: childId,
    value_grams: Math.round(valueGrams),
    recorded_at: recordedAt.toISOString(),
    recorded_by: userData.user.id,
  });
  if (error) throw error;
};

export const getLatestWeight = async (childId: string): Promise<number | null> => {
  const { data, error } = await supabase
    .from('weight_records')
    .select('value_grams')
    .eq('child_id', childId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.value_grams ?? null;
};

export type LatestWeight = { valueGrams: number; recordedAt: string };

/** Latest weight with its recorded date (for stale-weight warnings). */
export const getLatestWeightRecord = async (
  childId: string,
): Promise<LatestWeight | null> => {
  const { data, error } = await supabase
    .from('weight_records')
    .select('value_grams, recorded_at')
    .eq('child_id', childId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { valueGrams: data.value_grams, recordedAt: data.recorded_at };
};

export const getChild = async (childId: string): Promise<Child> => {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('id', childId)
    .single();

  if (error) throw error;
  return data;
};

export const updateChildName = async (
  childId: string,
  displayName: string,
): Promise<void> => {
  const { data, error } = await supabase
    .from('children')
    .update({ display_name: displayName })
    .eq('id', childId)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Only family admins can rename a child.');
  }
};

