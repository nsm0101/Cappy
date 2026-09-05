// supabase/functions/notify-dose/index.ts
//
// ADR-0009. Invoked fire-and-forget by the AFTER INSERT trigger on
// dose_events (see 20260801100000_dose_notifications.sql).
//
//   input:  { "doseEventId": "<uuid>" }  + x-notify-secret header
//   output: 200 always, with a small summary. Never a retryable error —
//           there is nothing on the other end to retry.
//
// Resolves the caregivers subscribed to this dose's child, minus the person
// who logged it, and pushes them an awareness notification.
//
// ─────────────────────────────────────────────────────────────────────
// PHI NOTE — read before changing the copy.
//
// AGENTS.md §3 says: never put PHI in a push notification payload.
// ADR-0009 "Notification copy" mandates: "Sarah logged 5 mL Tylenol for Emma
// at 2:14 PM" — a child's name, a medication and an amount, which is PHI.
//
// These are in direct conflict and it has NOT been silently resolved here.
// The ADR is the newer, more specific, founder-authored decision, and the
// feature is worthless without recognisable content — a notification reading
// "someone did something" does not let a caregiver decide whether to give a
// dose. So the ADR copy is implemented, with three constraints that keep the
// blast radius as small as the requirement allows:
//
//   1. The `data` payload carries the dose id and nothing else. Code only
//      needs to know which dose to open.
//   2. Nothing here logs a notification body, a child name, or a medication.
//      Error logs carry codes and counts only.
//   3. Android's channel is created with lockscreenVisibility PRIVATE, so the
//      body is hidden on a secure lock screen. iOS has no equivalent applied.
//
// This still needs a founder decision to reconcile the two documents. Until
// then, treat the copy below as load-bearing and do not extend it.
// ─────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCorsPreflight, json, problem, getEnv } from '../_shared/utils.ts';
import { ExpoPushSender, type PushMessage } from '../_shared/pushSender.ts';

const DOSE_ACTIVITY_CHANNEL = 'dose-activity';

interface NotifyRequest {
  doseEventId?: string;
}

/** "5 mL" when volume is known, else "500 mg" — whichever the caregiver saw. */
const formatAmount = (volumeMl: number | null, amountMg: number): string => {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return volumeMl != null && volumeMl > 0 ? `${n(volumeMl)} mL` : `${n(amountMg)} mg`;
};

/**
 * Clock time in the family's local reckoning.
 *
 * There is no per-family timezone stored, so this uses the server's UTC and
 * formats a 12-hour clock. A caregiver in UTC-5 reading "7:14 PM" for a 2:14
 * PM dose is a real papercut — flagged rather than papered over. The fix is a
 * timezone column on families, which is out of scope for this ADR.
 */
const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;
  if (req.method !== 'POST') return problem(405, 'Method Not Allowed');

  // This function runs unauthenticated — pg_net has no user session. The
  // shared secret is what distinguishes the trigger from the open internet.
  // Without it, anyone who learned the URL could enumerate dose ids and make
  // a family's phones buzz.
  const expected = getEnv('NOTIFY_DOSE_SECRET');
  if (req.headers.get('x-notify-secret') !== expected) {
    return problem(401, 'Unauthorized');
  }

  let body: NotifyRequest;
  try {
    body = await req.json();
  } catch {
    return problem(400, 'Invalid JSON body');
  }
  const doseEventId = (body.doseEventId ?? '').trim();
  if (!doseEventId) return problem(400, 'doseEventId is required');

  const admin = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // The trigger sends only an id, so everything the copy needs is read here.
  const { data: dose, error: doseError } = await admin
    .from('dose_events')
    .select(
      `
      id, child_id, family_id, logged_by, given_at, amount_mg, amount_volume_ml, status,
      children ( display_name ),
      medications ( brand_name, generic_name ),
      profiles!dose_events_logged_by_fkey ( display_name )
    `,
    )
    .eq('id', doseEventId)
    .maybeSingle();

  if (doseError) {
    console.error('notify-dose: dose lookup failed', doseError.code);
    return json(200, { sent: 0, reason: 'lookup_failed' });
  }
  // Re-checked rather than trusted from the trigger: the row could have been
  // superseded by a correction between the queue and this call.
  if (!dose || !dose.child_id || dose.status !== 'active') {
    return json(200, { sent: 0, reason: 'not_notifiable' });
  }

  // Recipients: active caregivers of this family, subscribed to this child,
  // excluding whoever logged it. A caregiver's own action is not news.
  const { data: members, error: membersError } = await admin
    .from('family_caregivers')
    .select('user_id')
    .eq('family_id', dose.family_id)
    .eq('status', 'active')
    .neq('user_id', dose.logged_by);

  if (membersError || !members?.length) {
    return json(200, { sent: 0, reason: 'no_members' });
  }
  const memberIds = members.map((m) => m.user_id);

  const { data: subs } = await admin
    .from('notification_subscriptions')
    .select('user_id, enabled')
    .eq('child_id', dose.child_id)
    .in('user_id', memberIds);

  // A caregiver with no row is subscribed (ADR-0009 decision 1: default on,
  // because silence is the dangerous failure mode). Only an explicit
  // enabled=false mutes.
  const muted = new Set((subs ?? []).filter((s) => !s.enabled).map((s) => s.user_id));
  const recipients = memberIds.filter((id) => !muted.has(id));
  if (!recipients.length) return json(200, { sent: 0, reason: 'all_muted' });

  // Dedup: claim (dose, recipient) pairs before sending. The unique PK means
  // a second invocation for the same dose inserts nothing and sends nothing.
  const { data: claimed } = await admin
    .from('notification_sends')
    .upsert(
      recipients.map((user_id) => ({ dose_event_id: dose.id, user_id })),
      { onConflict: 'dose_event_id,user_id', ignoreDuplicates: true },
    )
    .select('user_id');

  const toNotify = (claimed ?? []).map((r) => r.user_id);
  if (!toNotify.length) return json(200, { sent: 0, reason: 'already_sent' });

  const { data: tokens } = await admin
    .from('device_tokens')
    .select('token, platform, user_id')
    .in('user_id', toNotify);

  if (!tokens?.length) return json(200, { sent: 0, reason: 'no_tokens' });

  // ── Copy. actor + amount + child + time.
  //
  // Never a clinical claim. Specifically forbidden: "Emma is due for a dose",
  // "Time for Emma's medication", or anything presenting timing as medical
  // guidance. A push arrives stripped of the dose-safety line that gives it
  // context in-app, so the bar is higher here than anywhere else in the
  // product. This reports what another caregiver already did. It does not
  // advise.
  const actor = dose.profiles?.display_name ?? 'A caregiver';
  const child = dose.children?.display_name ?? 'your child';
  const med = dose.medications?.brand_name ?? dose.medications?.generic_name ?? 'medication';
  const amount = formatAmount(dose.amount_volume_ml, dose.amount_mg);

  const messages: PushMessage[] = tokens.map((t) => ({
    to: t.token,
    title: 'Dose logged',
    body: `${actor} logged ${amount} ${med} for ${child} at ${formatTime(dose.given_at)}`,
    data: { doseId: dose.id },
    interruptionLevel: 'time-sensitive',
    channelId: DOSE_ACTIVITY_CHANNEL,
  }));

  const sender = new ExpoPushSender(Deno.env.get('EXPO_ACCESS_TOKEN'));
  const tickets = await sender.send(messages);

  // Token hygiene. DeviceNotRegistered means the install is gone — delete the
  // row rather than pushing to it forever.
  const dead = tickets.filter((t) => t.error === 'DeviceNotRegistered').map((t) => t.token);
  if (dead.length) {
    await admin.from('device_tokens').delete().in('token', dead);
  }

  const ok = tickets.filter((t) => t.status === 'ok');
  // Record receipt ids so a later pass can check final delivery state. Keyed
  // back to the recipient via the token that produced the ticket.
  const tokenToUser = new Map(tokens.map((t) => [t.token, t.user_id]));
  await Promise.all(
    ok
      .filter((t) => t.id)
      .map((t) =>
        admin
          .from('notification_sends')
          .update({ receipt_id: t.id })
          .eq('dose_event_id', dose.id)
          .eq('user_id', tokenToUser.get(t.token) ?? ''),
      ),
  );

  // Counts only — no names, no bodies.
  return json(200, { sent: ok.length, failed: tickets.length - ok.length, pruned: dead.length });
});
