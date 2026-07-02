import { supabase } from './client';
import type { Database } from './database.types';
import type { DoseStatus } from './doses';

export type ResolvedDoseStatus = {
  status: DoseStatus;
  last_dose_at: string | null;
  next_safe_at: string | null;
  doses_in_last_24h: number;
};

export type ResolvedTag = {
  tag: { id: string; label: string | null; status: 'active' | 'revoked' | 'pending' };
  family: { id: string; name: string };
  medication: Database['public']['Tables']['medications']['Row'];
  children: Array<
    {
      id: string;
      display_name: string;
      date_of_birth: string;
      avatar_url: string | null;
    } & ResolvedDoseStatus
  >;
  /** Active adult caregivers in the family — can also be a dose recipient. */
  caregivers: Array<
    {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
    } & ResolvedDoseStatus
  >;
};

/**
 * Resolve a tag UID into its full medication+family+children context.
 * Calls the `nfc-resolve` Edge Function (defined in supabase/functions/).
 */
export const resolveNfcTag = async (tagUid: string): Promise<ResolvedTag | null> => {
  const { data, error } = await supabase.functions.invoke('nfc-resolve', {
    body: { tagUid },
  });
  if (error) {
    // Tag-not-found surfaces as a non-2xx; data may be null. Return null
    // for the caller to handle, rather than throwing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (error as any).context?.status ?? (error as any).status;
    if (status === 404) return null;
    throw error;
  }
  return data as ResolvedTag;
};

/**
 * List the medication catalog (FLOW-1: manual dose logging without a tag).
 * RLS: medications are readable by any authenticated user.
 */
export const listMedications = async (): Promise<ResolvedTag['medication'][]> => {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .order('generic_name')
    .order('brand_name');
  if (error) throw error;
  return data ?? [];
};

/**
 * Register a new tag binding. Admin-only; RLS enforces this.
 */
export const registerTag = async (input: {
  tagUid: string;
  familyId: string;
  medicationId: string;
  label?: string;
}): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');

  const { error } = await supabase.from('nfc_tags').insert({
    tag_uid: input.tagUid,
    family_id: input.familyId,
    medication_id: input.medicationId,
    label: input.label?.trim() || null,
    registered_by: userData.user.id,
    status: 'active',
  });
  if (error) throw error;
};
