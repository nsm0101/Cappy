import { supabase } from './client';
import type { Database } from './database.types';

export type CaregiverProfile = {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null; // YYYY-MM-DD
  avatar_url: string | null;
  consent_version: string | null;
  consent_accepted_at: string | null;
};

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

/** The signed-in caregiver's full profile (name, DOB, avatar, consent). */
export const getMyProfile = async (): Promise<CaregiverProfile | null> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'display_name, first_name, last_name, date_of_birth, avatar_url, consent_version, consent_accepted_at',
    )
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error) return null;
  return (data as CaregiverProfile) ?? null;
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

export type UpdateProfileInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  /** When set, records consent acceptance at now(). */
  consentVersion?: string;
};

/**
 * Save the caregiver's identity captured in the first-run setup step.
 * Sets first/last name, DOB, a denormalized display_name ("First Last"),
 * and (optionally) records consent acceptance.
 */
export const updateMyProfile = async (input: UpdateProfileInput): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');

  const first = input.firstName.trim();
  const last = input.lastName.trim();
  const displayName = [first, last].filter(Boolean).join(' ');

  const patch: Database['public']['Tables']['profiles']['Update'] = {
    first_name: first,
    last_name: last,
    date_of_birth: input.dateOfBirth,
    display_name: displayName,
    updated_at: new Date().toISOString(),
  };
  if (input.consentVersion) {
    patch.consent_version = input.consentVersion;
    patch.consent_accepted_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userData.user.id);
  if (error) throw error;
};

/** True when the caregiver still needs to complete the first-run setup. */
export const isProfileComplete = (p: CaregiverProfile | null): boolean =>
  Boolean(p && p.display_name?.trim() && p.date_of_birth && p.consent_accepted_at);
