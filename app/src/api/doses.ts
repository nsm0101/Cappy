import { supabase } from './client';
import type { Database } from './database.types';

export type DoseEvent = Database['public']['Tables']['dose_events']['Row'];

export type DoseStatus = 'due' | 'early' | 'recent' | 'overdue';

export type DoseStatusResult = {
  status: DoseStatus;
  last_dose_at: string | null;
  next_safe_at: string | null;
  doses_in_last_24h: number;
};

/** A dose belongs to exactly one recipient — a child or an adult caregiver. */
export type DoseRecipient =
  | { childId: string; caregiverUserId?: undefined }
  | { caregiverUserId: string; childId?: undefined };

export type LogDoseInput = DoseRecipient & {
  /**
   * Client-generated UUIDv4. The PRIMARY KEY of the dose_events row.
   * On network retry, send the same id — the unique constraint
   * collapses to a no-op (we treat 23505 unique-violation as success).
   *
   * Generate via `crypto.randomUUID()` from web standards, or via
   * the `uuid` npm package if your target doesn't support it natively.
   */
  id: string;
  /** The family this dose belongs to — required for both recipient kinds. */
  familyId: string;
  medicationId: string;
  givenAt: Date;
  amountMg: number;
  amountVolumeMl?: number;
  unitCount?: number;
  note?: string;
};

/**
 * Log a dose. Idempotent on retry — same `id` is a safe no-op.
 *
 * Throws on real errors. On Postgres unique-violation (23505) we
 * silently succeed because that means the dose was already logged.
 */
export const logDose = async (input: LogDoseInput): Promise<DoseEvent> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('dose_events')
    .insert({
      id: input.id,
      family_id: input.familyId,
      child_id: input.childId ?? null,
      caregiver_user_id: input.caregiverUserId ?? null,
      medication_id: input.medicationId,
      logged_by: userData.user.id,
      given_at: input.givenAt.toISOString(),
      amount_mg: input.amountMg,
      amount_volume_ml: input.amountVolumeMl ?? null,
      unit_count: input.unitCount ?? null,
      note: input.note?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation. The row already exists; fetch and
    // return it instead of throwing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any).code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('dose_events')
        .select('*')
        .eq('id', input.id)
        .single();
      if (fetchError) throw fetchError;
      return existing;
    }
    throw error;
  }
  return data;
};

export const listDosesForChild = async (
  childId: string,
  options: { limit?: number; before?: Date } = {},
): Promise<DoseEvent[]> => {
  let query = supabase
    .from('dose_events')
    .select('*')
    .eq('child_id', childId)
    .order('given_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (options.before) {
    query = query.lt('given_at', options.before.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

/**
 * Server-side dose status calculation. Uses the `compute_dose_status`
 * RPC. Same logic the NFC tap-resolve flow uses, so client and tap
 * agree.
 */
export const getDoseStatus = async (
  childId: string,
  medicationId: string,
): Promise<DoseStatusResult> => {
  const { data, error } = await supabase.rpc('compute_dose_status', {
    child_uuid: childId,
    medication_uuid: medicationId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    status: (row?.status ?? 'due') as DoseStatus,
    last_dose_at: row?.last_dose_at ?? null,
    next_safe_at: row?.next_safe_at ?? null,
    doses_in_last_24h: row?.doses_in_last_24h ?? 0,
  };
};

/**
 * Issue a correction. Creates a new dose_events row (active) and a
 * dose_corrections row linking original → correction. A trigger marks
 * the original as superseded. Children only — corrections aren't
 * supported for caregiver-recipient doses yet.
 */
export const correctDose = async (
  originalId: string,
  correction: {
    childId: string;
    familyId: string;
    medicationId: string;
    givenAt: Date;
    amountMg: number;
    amountVolumeMl?: number;
    unitCount?: number;
    note?: string;
  },
  reason?: string,
): Promise<{ original_id: string; correction_id: string }> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in');

  // Generate a new dose id for the correction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctionId = (globalThis as any).crypto.randomUUID() as string;

  const correctionDose = await logDose({
    ...correction,
    id: correctionId,
  });

  const { error: cErr } = await supabase.from('dose_corrections').insert({
    original_dose_event_id: originalId,
    correction_dose_event_id: correctionDose.id,
    corrected_by: userData.user.id,
    reason: reason?.trim() || null,
  });
  if (cErr) throw cErr;

  return { original_id: originalId, correction_id: correctionDose.id };
};

export type DoseEventWithDetails = DoseEvent & {
  medication: Database['public']['Tables']['medications']['Row'];
  // dose_events has two FKs to profiles (logged_by and caregiver_user_id),
  // so every embed below must name the constraint explicitly — an
  // unqualified `profiles ( ... )` is ambiguous once there's more than one
  // relationship between the same two tables.
  profiles: { display_name: string | null } | null;
  children?: { display_name: string; avatar_url: string | null } | null;
  /** Set when this dose's recipient is an adult caregiver, not a child. */
  caregiver_recipient?: { display_name: string | null; avatar_url: string | null } | null;
};

const DOSE_DETAILS_SELECT = `
  *,
  medication:medications (*),
  profiles!dose_events_logged_by_fkey ( display_name ),
  caregiver_recipient:profiles!dose_events_caregiver_user_id_fkey ( display_name, avatar_url )
`;

export const listDosesWithDetailsForChild = async (
  childId: string,
  options: { limit?: number; before?: Date } = {},
): Promise<DoseEventWithDetails[]> => {
  let query = supabase
    .from('dose_events')
    .select(DOSE_DETAILS_SELECT)
    .eq('child_id', childId)
    .order('given_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (options.before) {
    query = query.lt('given_at', options.before.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as DoseEventWithDetails[]) ?? [];
};

/**
 * Family-wide dose timeline — every dose for the family regardless of
 * recipient (child or caregiver), filtered directly on `dose_events.family_id`.
 */
export const listDosesWithDetailsForFamily = async (
  familyId: string,
  options: { limit?: number; before?: Date } = {},
): Promise<DoseEventWithDetails[]> => {
  let query = supabase
    .from('dose_events')
    .select(`${DOSE_DETAILS_SELECT}, children ( display_name, avatar_url )`)
    .eq('family_id', familyId)
    .order('given_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (options.before) {
    query = query.lt('given_at', options.before.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as DoseEventWithDetails[]) ?? [];
};

