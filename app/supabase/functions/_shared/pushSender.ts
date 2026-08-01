// PushSender — the send adapter boundary (ADR-0009 decision 3).
//
// Expo's push service is what makes Android nearly free: one token type, one
// API, both platforms. It is also a third party sitting in the delivery path,
// which cuts against the vendor-independence posture in the API-abstraction
// ADR. The mitigation is this file: `notify-dose` depends on the PushSender
// interface and never on Expo. Swapping to direct APNs + FCM later rewrites
// `ExpoPushSender` and touches nothing else.
//
// Move off Expo Push when any two of these hold (ADR-0009 decision 3):
//   1. Delivery latency p95 exceeds 30s
//   2. We need APNs features Expo doesn't proxy (Critical Alerts, collapse IDs)
//   3. Volume makes Expo's rate limits a live constraint
//   4. We need delivery telemetry richer than Expo's receipt API
//   5. A compliance posture change (Posture C → A) requires a documented
//      direct path
//   6. Expo's pricing or ToS changes materially for health-adjacent apps

/** A single push, in the shape the sender understands. */
export interface PushMessage {
  /** Expo push token for one device. */
  to: string;
  title: string;
  body: string;
  /**
   * Payload. Carries the dose id and nothing else — never a child's name, a
   * medication, or an amount. The body string is what the caregiver reads;
   * the data payload is what code reads, and code only needs to know which
   * dose to open.
   */
  data: Record<string, string>;
  /**
   * iOS. 'time-sensitive' breaks through Focus and Do Not Disturb and needs
   * only a self-service entitlement. Critical Alerts is deliberately NOT used
   * — it requires an Apple review measured in weeks and bypasses the ringer
   * switch, which a dose *log* does not warrant.
   */
  interruptionLevel?: 'active' | 'time-sensitive';
  /**
   * Android. Required on every message: the app ships without an
   * expo-notifications config plugin, so there is no default-channel
   * fallback. A message with no channelId will not surface at the intended
   * importance.
   */
  channelId?: string;
}

/** Per-message outcome, index-aligned with the messages that were sent. */
export interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  /** Expo error code, e.g. 'DeviceNotRegistered'. */
  error?: string;
  /** The token this ticket corresponds to — the caller needs it to prune. */
  token: string;
}

export interface PushSender {
  send(messages: PushMessage[]): Promise<PushTicket[]>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo caps a single request at 100 messages. */
const BATCH_SIZE = 100;

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Expo implementation. Plain fetch — no SDK, so no new dependency in the
 * delivery path.
 *
 * Never throws. A caregiver's dose is already written by the time this runs;
 * a delivery failure is logged as a failed ticket and the caller moves on.
 */
export class ExpoPushSender implements PushSender {
  constructor(private readonly accessToken?: string) {}

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    const tickets: PushTicket[] = [];

    for (const batch of chunk(messages, BATCH_SIZE)) {
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
          },
          body: JSON.stringify(batch),
        });

        if (!res.ok) {
          // Deliberately does not include the response body: on a 4xx Expo
          // echoes the offending message back, which would put the
          // notification body — and therefore a child's name — into the
          // function log. Status alone is enough to diagnose.
          console.error('expo push: HTTP', res.status);
          for (const m of batch) {
            tickets.push({ status: 'error', error: `http_${res.status}`, token: m.to });
          }
          continue;
        }

        const payload = (await res.json()) as { data?: Array<Record<string, unknown>> };
        const data = payload.data ?? [];

        batch.forEach((m, i) => {
          const t = data[i] as
            | { status?: string; id?: string; details?: { error?: string } }
            | undefined;
          tickets.push({
            status: t?.status === 'ok' ? 'ok' : 'error',
            id: t?.id,
            error: t?.details?.error,
            token: m.to,
          });
        });
      } catch (e) {
        console.error('expo push: request failed', e instanceof Error ? e.message : 'unknown');
        for (const m of batch) {
          tickets.push({ status: 'error', error: 'request_failed', token: m.to });
        }
      }
    }

    return tickets;
  }
}
