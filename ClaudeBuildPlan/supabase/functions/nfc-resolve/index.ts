// supabase/functions/nfc-resolve/index.ts
//
// Resolves an NFC tag UID to its medication + family context, with
// per-child dose-safety status.
//
// Input  (POST JSON):  { "tagUid": "04A1B2C3..." }
// Output (200 JSON):
//   {
//     "tag":        { id, label, status },
//     "family":     { id, name },
//     "medication": { id, generic_name, brand_name, concentration_label, ... },
//     "children":   [ { id, display_name, last_dose_at, next_safe_at, status, doses_in_last_24h } ]
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
    (children ?? []).map(async (child) => {
      const { data: status, error: statusError } = await supabase.rpc(
        'compute_dose_status',
        { child_uuid: child.id, medication_uuid: medication.id },
      );
      if (statusError) {
        return {
          ...child,
          status: 'due',
          last_dose_at: null,
          next_safe_at: null,
          doses_in_last_24h: 0,
        };
      }
      const row = Array.isArray(status) ? status[0] : status;
      return {
        ...child,
        status: row?.status ?? 'due',
        last_dose_at: row?.last_dose_at ?? null,
        next_safe_at: row?.next_safe_at ?? null,
        doses_in_last_24h: row?.doses_in_last_24h ?? 0,
      };
    }),
  );

  return json(200, {
    tag: { id: tag.id, label: tag.label, status: tag.status },
    family,
    medication,
    children: childResults,
  });
});
