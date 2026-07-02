// supabase/functions/nfc-resolve/index.ts
//
// Resolves an NFC tag UID to its medication + family context, with
// per-child and per-caregiver dose-safety status (caregivers can be dose
// recipients too — e.g. a parent logging their own acetaminophen).
//
// Input  (POST JSON):  { "tagUid": "04A1B2C3..." }
// Output (200 JSON):
//   {
//     "tag":        { id, label, status },
//     "family":     { id, name },
//     "medication": { id, generic_name, brand_name, concentration_label, ... },
//     "children":   [ { id, display_name, last_dose_at, next_safe_at, status, doses_in_last_24h } ]
//     "caregivers": [ { id, display_name, avatar_url, last_dose_at, next_safe_at, status, doses_in_last_24h } ]
//   }
//
// 404 with Problem Details if the tag is unknown or not in caller's scope.
//
// This function runs with the caller's JWT — RLS still applies. We use
// the client's auth to ensure they can only resolve tags in families
// they're members of.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCorsPreflight, json, problem, getEnv } from '../_shared/utils.ts';

interface ResolveRequest {
  tagUid?: string;
}

type DoseStatusRow = {
  status: string;
  last_dose_at: string | null;
  next_safe_at: string | null;
  doses_in_last_24h: number;
};

// SAFE-4: never fail open. If the status RPC errors, report 'unknown' so the
// client renders "Status unavailable" (and re-checks at log time) instead of
// the most permissive possible answer, "due".
const UNKNOWN_STATUS: DoseStatusRow = {
  status: 'unknown',
  last_dose_at: null,
  next_safe_at: null,
  doses_in_last_24h: 0,
};

/** Calls compute_dose_status for one recipient, falling back to "unknown"
 * (and logging) on RPC error so one bad row doesn't fail the whole resolve. */
const fetchDoseStatus = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rpcArgs: { child_uuid: string; medication_uuid: string } | { caregiver_uuid: string; medication_uuid: string },
  logLabel: string,
): Promise<DoseStatusRow> => {
  const { data, error } = await supabase.rpc('compute_dose_status', rpcArgs);
  if (error) {
    console.error('compute_dose_status RPC error', logLabel, error);
    return UNKNOWN_STATUS;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    status: row?.status ?? 'unknown',
    last_dose_at: row?.last_dose_at ?? null,
    next_safe_at: row?.next_safe_at ?? null,
    doses_in_last_24h: row?.doses_in_last_24h ?? 0,
  };
};

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;
  if (req.method !== 'POST') return problem(405, 'Method Not Allowed');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return problem(401, 'Unauthorized');

  let body: ResolveRequest;
  try {
    body = await req.json();
  } catch {
    return problem(400, 'Invalid JSON body');
  }

  const tagUid = (body.tagUid ?? '').trim();
  if (!tagUid || tagUid.length < 4) {
    return problem(400, 'tagUid is required');
  }

  const supabase = createClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } },
  );

  // Fetch the tag with family + medication. RLS will enforce membership.
  const { data: tag, error: tagError } = await supabase
    .from('nfc_tags')
    .select('id, tag_uid, family_id, medication_id, status, label')
    .eq('tag_uid', tagUid)
    .eq('status', 'active')
    .maybeSingle();

  if (tagError) {
    console.error('nfc_tags query error', tagError);
    return problem(500, 'Internal error');
  }
  if (!tag) {
    // Either unknown tag or not in scope — same response either way.
    return problem(404, 'Tag not found');
  }

  const { data: family, error: familyError } = await supabase
    .from('families')
    .select('id, name')
    .eq('id', tag.family_id)
    .maybeSingle();

  if (familyError || !family) {
    return problem(404, 'Tag not found');
  }

  const { data: medication, error: medError } = await supabase
    .from('medications')
    .select('*')
    .eq('id', tag.medication_id)
    .maybeSingle();

  if (medError || !medication) {
    return problem(404, 'Tag not found');
  }

  const { data: children, error: childrenError } = await supabase
    .from('children')
    .select('id, display_name, date_of_birth, avatar_url')
    .eq('family_id', family.id)
    .is('deleted_at', null);

  if (childrenError) {
    console.error('children query error', childrenError);
    return problem(500, 'Internal error');
  }

  // For each child, compute dose status via the RPC
  const childResults = await Promise.all(
    (children ?? []).map(async (child) => ({
      ...child,
      ...(await fetchDoseStatus(
        supabase,
        { child_uuid: child.id, medication_uuid: medication.id },
        `child ${child.id}`,
      )),
    })),
  );

  // Active adult caregivers in the family can also be dose recipients
  // (e.g. a parent logging their own dose of the same medication).
  const { data: caregiverRows, error: caregiversError } = await supabase
    .from('family_caregivers')
    .select('user_id, profiles ( display_name, avatar_url )')
    .eq('family_id', family.id)
    .eq('status', 'active');

  if (caregiversError) {
    console.error('family_caregivers query error', caregiversError);
    return problem(500, 'Internal error');
  }

  const caregiverResults = await Promise.all(
    (caregiverRows ?? []).map(async (row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profile = row.profiles as any;
      return {
        id: row.user_id,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        ...(await fetchDoseStatus(
          supabase,
          { caregiver_uuid: row.user_id, medication_uuid: medication.id },
          `caregiver ${row.user_id}`,
        )),
      };
    }),
  );

  return json(200, {
    tag: { id: tag.id, label: tag.label, status: tag.status },
    family,
    medication,
    children: childResults,
    caregivers: caregiverResults,
  });
});
