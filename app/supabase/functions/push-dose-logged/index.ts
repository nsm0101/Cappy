// supabase/functions/push-dose-logged/index.ts
//
// Fans one dose event out to the other caregivers' phones.
//
// Called by the `dose_events_zz_push` trigger through pg_net, with the service
// role key. It is a transport and nothing more: who receives a notification is
// decided by `push_recipients_for_dose` in the database, from preferences that
// live there. It should not be possible to change who gets notified by editing
// this file.
//
// Input (POST JSON): { "dose_event_id": uuid, "event_type": notification_event }
//
// The payload carries NO clinical detail. "Sam logged a dose for Ava" — never
// the medication, the amount, the reason, or the child's condition. These
// render on a locked screen, face up on a kitchen counter, in front of whoever
// is standing there. The medication name lives behind the tap, inside the
// authenticated app. That is a privacy posture and a plain-decency call, and
// it also keeps the notification path out of a great deal of compliance scope.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { json, problem, getEnv } from '../_shared/utils.ts';
import { apnsConfigFor, apnsConfigured, sendApns } from '../_shared/apns.ts';

interface PushRequest {
  dose_event_id?: string;
  event_type?: string;
}

interface Recipient {
  user_id: string;
  token: string;
  environment: 'sandbox' | 'production';
  quiet: boolean;
}

/** First name only. A notification is not the place for a full legal name. */
const firstName = (name: string | null | undefined, fallback: string): string => {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0];
};

/**
 * Only the database trigger may call this.
 *
 * Without a check, any signed-in user could POST somebody else's
 * dose_event_id and make every caregiver in that family's phone buzz — the
 * recipient resolver is SECURITY DEFINER, so it would happily answer.
 *
 * The trigger proves itself with a dedicated shared secret rather than the
 * service role key. That key would work, but it is the wrong credential for
 * the job: it grants full read/write over every table, and storing it in
 * `private.app_settings` puts a database-wide skeleton key in a row, to
 * authorise a caller whose only permitted action is "fan this one dose out".
 * PUSH_TRIGGER_SECRET can do exactly that and nothing else, and rotating it
 * costs one UPDATE and one `supabase secrets set`.
 *
 * Compared with a constant-time-free equality check: the secret is 48 bytes of
 * random and the endpoint is not enumerable, so a timing oracle is not the
 * weak link here — but the comparison is written to run over the full length
 * anyway, since it costs nothing.
 */
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const isTrigger = (req: Request): boolean => {
  const expected = Deno.env.get('PUSH_TRIGGER_SECRET');
  if (!expected) return false;
  const presented = req.headers.get('x-cappy-trigger-secret') ?? '';
  return timingSafeEqual(presented, expected);
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return problem(405, 'Method not allowed');
  if (!isTrigger(req)) return problem(403, 'Forbidden');

  if (!apnsConfigured()) {
    // Not configured yet. A 200 keeps pg_net quiet — this is not an error the
    // database can do anything about, and a retry storm helps nobody.
    return json(200, { skipped: 'apns_not_configured' });
  }

  let body: PushRequest;
  try {
    body = await req.json();
  } catch {
    return problem(400, 'Invalid JSON');
  }

  const doseEventId = body.dose_event_id;
  if (!doseEventId) return problem(400, 'dose_event_id is required');
  const eventType = body.event_type ?? 'dose_logged_by_other';

  const admin = createClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  // Who and what. Deliberately a narrow select: this function has no business
  // reading the amount or the note.
  const { data: dose, error: doseError } = await admin
    .from('dose_events')
    .select(`
      id, family_id, child_id, caregiver_user_id, medication_id, logged_by,
      given_at, reconciliation_status,
      child:children(display_name),
      logger:profiles!dose_events_logged_by_fkey(display_name),
      recipient:profiles!dose_events_caregiver_user_id_fkey(display_name)
    `)
    .eq('id', doseEventId)
    .single();

  if (doseError || !dose) return problem(404, 'Dose event not found');

  // A merged duplicate is the same administration someone was already told
  // about.
  if (dose.reconciliation_status === 'merged') {
    return json(200, { skipped: 'merged_duplicate' });
  }

  const { data: recipients, error: recipientsError } = await admin
    .rpc('push_recipients_for_dose', {
      p_dose_event_id: doseEventId,
      p_event_type: eventType,
    });

  if (recipientsError) return problem(500, 'Could not resolve recipients', recipientsError.message);
  const list = (recipients ?? []) as Recipient[];
  if (list.length === 0) return json(200, { sent: 0, reason: 'no_opted_in_devices' });

  const loggerName = firstName((dose as Record<string, any>).logger?.display_name, 'Someone');
  const recipientName = (dose as Record<string, any>).child?.display_name
    ?? firstName((dose as Record<string, any>).recipient?.display_name, 'themselves');

  const title = 'Dose logged';
  const bodyText = `${loggerName} logged a dose for ${recipientName}.`;

  // Whether this event may be held for quiet hours is the catalog's decision,
  // not this function's.
  const { data: catalog } = await admin
    .from('notification_event_catalog')
    .select('respects_quiet_hours')
    .eq('event_type', eventType)
    .single();
  const respectsQuietHours = catalog?.respects_quiet_hours ?? true;

  // One collapse id per (recipient, medication, event) so a correction or a
  // second sync replaces the banner instead of stacking another one.
  const collapseId = `${dose.child_id ?? dose.caregiver_user_id}:${dose.medication_id}:${eventType}`;

  // A coordination push has a short shelf life. Four hours after the fact it
  // is noise, so Apple is told to stop trying.
  const expiration = Math.floor(Date.now() / 1000) + 4 * 3600;

  const results = await Promise.all(list.map((r) => {
    const quiet = respectsQuietHours && r.quiet;
    // Each token names the environment it was minted in, and each environment
    // has its own signing key. A token with no key configured is skipped
    // rather than sent with the wrong one, which would only produce a 403 and
    // a confusing log line.
    const config = apnsConfigFor(r.environment ?? 'production');
    if (!config) {
      return Promise.resolve({
        deviceToken: r.token, status: 0,
        reason: `no_key_for_${r.environment}`, gone: false,
      });
    }
    return sendApns(config, {
      deviceToken: r.token,
      title,
      body: bodyText,
      collapseId,
      // Inside quiet hours the notification is delivered but not allowed to
      // wake anyone: low priority, passive presentation. Dropping it entirely
      // would leave the other parent without the coordination they opted in
      // for; ringing the phone at 3 AM is what they opted out of.
      priority: quiet ? 5 : 10,
      interruptionLevel: quiet ? 'passive' : 'active',
      expirationEpochSeconds: expiration,
      data: {
        doseEventId: dose.id,
        familyId: dose.family_id,
        childId: dose.child_id,
        eventType,
      },
    }).catch((error) => ({
      deviceToken: r.token,
      status: 0,
      reason: String(error),
      gone: false,
    }));
  }));

  // Retire tokens Apple says are dead. Kept rather than deleted, so a device
  // that comes back gets its row rather than a duplicate.
  const dead = results.filter((r) => r.gone).map((r) => r.deviceToken);
  if (dead.length > 0) {
    await admin
      .from('device_push_tokens')
      .update({ disabled_at: new Date().toISOString(), disabled_reason: 'apns_gone' })
      .in('token', dead);
  }

  return json(200, {
    sent: results.filter((r) => r.status === 200).length,
    failed: results.filter((r) => r.status !== 200).length,
    skipped_no_key: results.filter((r) => String(r.reason ?? '').startsWith('no_key_for_')).length,
    retired: dead.length,
  });
});
