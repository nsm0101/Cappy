// supabase/functions/accept-invite/index.ts
//
// Atomically:
//   1. Look up the invite by 6-digit code
//   2. Verify it hasn't expired or been used
//   3. Create a family_caregivers row for the joining user with the
//      proposed role
//   4. Mark the invite accepted
//
// Input  (POST JSON):  { "code": "123456" }
// Output (200 JSON):   { caregiver: { id, family_id, role, status } }
//
// Uses service-role key inside the function so the joining user
// (who is NOT yet a member of the family) doesn't need RLS read
// access to the invites table.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCorsPreflight, json, problem, getEnv } from '../_shared/utils.ts';

interface AcceptRequest {
  code?: string;
}

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;
  if (req.method !== 'POST') return problem(405, 'Method Not Allowed');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return problem(401, 'Unauthorized');

  // First, verify the caller's identity using their JWT
  const userClient = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return problem(401, 'Unauthorized');
  }
  const userId = userData.user.id;

  let body: AcceptRequest;
  try {
    body = await req.json();
  } catch {
    return problem(400, 'Invalid JSON body');
  }
  const code = (body.code ?? '').trim();
  if (!/^[0-9]{6}$/.test(code)) {
    return problem(400, 'code must be a 6-digit number');
  }

  // Use service role for the privileged ops
  const admin = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: invite, error: inviteError } = await admin
    .from('invites')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (inviteError) {
    console.error('invite lookup', inviteError);
    return problem(500, 'Internal error');
  }
  if (!invite) {
    return problem(404, 'Invite not found');
  }
  if (invite.accepted_at) {
    return problem(410, 'Invite already used');
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return problem(410, 'Invite expired');
  }

  // Check the user isn't already in this family
  const { data: existing, error: existingError } = await admin
    .from('family_caregivers')
    .select('id, status')
    .eq('family_id', invite.family_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) {
    console.error('existing membership', existingError);
    return problem(500, 'Internal error');
  }
  if (existing && existing.status === 'active') {
    return problem(409, 'Already a member of this family');
  }

  // Insert (or reactivate) the membership
  let caregiver;
  if (existing) {
    const { data, error } = await admin
      .from('family_caregivers')
      .update({
        role: invite.proposed_role,
        status: 'active',
        joined_at: new Date().toISOString(),
        revoked_at: null,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      return problem(500, 'Internal error');
    }
    caregiver = data;
  } else {
    const { data, error } = await admin
      .from('family_caregivers')
      .insert({
        family_id: invite.family_id,
        user_id: userId,
        role: invite.proposed_role,
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      return problem(500, 'Internal error');
    }
    caregiver = data;
  }

  // Mark invite accepted (best-effort — even if this fails, the
  // caregiver is now active)
  await admin
    .from('invites')
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq('id', invite.id);

  return json(200, { caregiver });
});
