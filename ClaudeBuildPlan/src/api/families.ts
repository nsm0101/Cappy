import { supabase } from './client';
import type { Database } from './database.types';

export type Family = Database['public']['Tables']['families']['Row'];
export type FamilyCaregiver = Database['public']['Tables']['family_caregivers']['Row'];

export type FamilyWithRole = Family & { my_role: FamilyCaregiver['role'] };

/**
 * List the families this user belongs to (active membership only).
 */
export const listMyFamilies = async (): Promise<FamilyWithRole[]> => {
  const { data, error } = await supabase
    .from('family_caregivers')
    .select(
      `
      role,
      families (
        id, name, created_by, created_at, updated_at, deleted_at
      )
    `,
    )
    .eq('status', 'active');

  if (error) throw error;
  if (!data) return [];

  return data
    .filter((row) => row.families != null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => ({ ...(row.families as Family), my_role: row.role }));
};

export const createFamily = async (name: string): Promise<Family> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('families')
    .insert({ name: name.trim(), created_by: userData.user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateFamilyName = async (familyId: string, name: string): Promise<Family> => {
  const { data, error } = await supabase
    .from('families')
    .update({ name: name.trim() })
    .eq('id', familyId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export type CaregiverWithProfile = FamilyCaregiver & {
  display_name: string | null;
};

export const listFamilyCaregivers = async (
  familyId: string,
): Promise<CaregiverWithProfile[]> => {
  const { data, error } = await supabase
    .from('family_caregivers')
    .select(
      `
      *,
      profiles ( display_name )
    `,
    )
    .eq('family_id', familyId);

  if (error) throw error;
  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    ...row,
    display_name: row.profiles?.display_name ?? null,
  }));
};

export const revokeCaregiver = async (caregiverId: string): Promise<void> => {
  const { error } = await supabase
    .from('family_caregivers')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', caregiverId);

  if (error) throw error;
};

/**
 * Generate a 6-digit invite code. Caller must be admin in the family;
 * RLS enforces this.
 */
export const createInvite = async (
  familyId: string,
  proposedRole: 'admin' | 'caregiver' | 'readonly',
): Promise<{ code: string; expires_at: string }> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');

  // Generate a random 6-digit code client-side; collisions are unlikely
  // at our scale but DB unique constraint will catch them.
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('invites')
    .insert({
      family_id: familyId,
      code,
      proposed_role: proposedRole,
      created_by: userData.user.id,
      expires_at,
    })
    .select('code, expires_at')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Accept an invite. Delegates to the Edge Function for atomicity and
 * to avoid needing RLS read access to invites.
 */
export const acceptInvite = async (
  code: string,
): Promise<{ caregiver: FamilyCaregiver }> => {
  const { data, error } = await supabase.functions.invoke('accept-invite', {
    body: { code },
  });
  if (error) throw error;
  return data as { caregiver: FamilyCaregiver };
};
