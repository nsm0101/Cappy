// APNs HTTP/2 sender.
//
// Token authentication (.p8), not certificates: a certificate expires once a
// year and takes push notifications down with it on a date nobody has in their
// calendar. A signing key does not expire.
//
// The provider token is an ES256 JWT signed with the P-256 key, valid for an
// hour. Apple rate-limits token *generation*, not use, so the signed token is
// cached and reused for the life of the isolate.

const encoder = new TextEncoder();

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const base64urlString = (s: string): string => base64url(encoder.encode(s));

/** Strip the PEM armour and decode the PKCS#8 body. */
const decodePkcs8 = (pem: string): ArrayBuffer => {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
};

export interface ApnsConfig {
  keyP8: string;      // contents of AuthKey_XXXX.p8
  keyId: string;      // 10-character key id
  teamId: string;     // 10-character team id
  topic: string;      // bundle id, e.g. com.closedose.cappy
  environment: 'sandbox' | 'production';
}

/**
 * One signing key per environment.
 *
 * Apple's newer team-scoped keys are restricted to Sandbox OR Production, and
 * the choice is immutable once the key is saved. A Sandbox key presented to
 * api.push.apple.com is rejected, so a single key cannot serve both — and a
 * household in beta will genuinely have both, because a Debug build on the
 * developer's phone mints sandbox tokens while TestFlight mints production
 * ones. `device_push_tokens.environment` records which each token is, and this
 * resolves the matching key.
 *
 * The unsuffixed APNS_KEY_P8 / APNS_KEY_ID are the fallback, so a legacy
 * both-environments key (Apple still honours those) keeps working with no
 * extra configuration.
 */
export const apnsConfigFor = (
  environment: 'sandbox' | 'production',
): ApnsConfig | null => {
  const suffix = environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION';
  const keyP8 = Deno.env.get(`APNS_KEY_P8_${suffix}`) ?? Deno.env.get('APNS_KEY_P8');
  const keyId = Deno.env.get(`APNS_KEY_ID_${suffix}`) ?? Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const topic = Deno.env.get('APNS_TOPIC');
  if (!keyP8 || !keyId || !teamId || !topic) return null;
  return { keyP8, keyId, teamId, topic, environment };
};

/** True when at least one environment is configured. */
export const apnsConfigured = (): boolean =>
  apnsConfigFor('sandbox') !== null || apnsConfigFor('production') !== null;

// Cached per key id, not globally: with an environment-specific key each way,
// one shared slot would hand a Sandbox-signed token to the Production host.
const cachedTokens = new Map<string, { value: string; issuedAt: number }>();

export const providerToken = async (config: ApnsConfig): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  // Apple rejects tokens older than an hour; refresh at 50 minutes.
  const cached = cachedTokens.get(config.keyId);
  if (cached && now - cached.issuedAt < 3000) return cached.value;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    decodePkcs8(config.keyP8),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const header = base64urlString(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const claims = base64urlString(JSON.stringify({ iss: config.teamId, iat: now }));
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(`${header}.${claims}`),
  );

  const value = `${header}.${claims}.${base64url(new Uint8Array(signature))}`;
  cachedTokens.set(config.keyId, { value, issuedAt: now });
  return value;
};

export interface ApnsPush {
  deviceToken: string;
  title: string;
  body: string;
  /** Groups related banners so a flurry replaces rather than stacks. */
  collapseId?: string;
  /** Opaque routing data. Must contain nothing clinical. */
  data?: Record<string, unknown>;
  /** 10 = deliver immediately. 5 = defer, used inside quiet hours. */
  priority?: 5 | 10;
  interruptionLevel?: 'passive' | 'active' | 'time-sensitive';
  /** Absolute expiry — a stale coordination push is worse than none. */
  expirationEpochSeconds?: number;
}

export interface ApnsResult {
  deviceToken: string;
  status: number;
  reason?: string;
  /** True when Apple says this token is dead and should be retired. */
  gone: boolean;
}

export const sendApns = async (config: ApnsConfig, push: ApnsPush): Promise<ApnsResult> => {
  const host = config.environment === 'sandbox'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';

  const token = await providerToken(config);

  const headers: Record<string, string> = {
    authorization: `bearer ${token}`,
    'apns-topic': config.topic,
    'apns-push-type': 'alert',
    'apns-priority': String(push.priority ?? 10),
    'content-type': 'application/json',
  };
  if (push.collapseId) headers['apns-collapse-id'] = push.collapseId.slice(0, 64);
  if (push.expirationEpochSeconds) {
    headers['apns-expiration'] = String(push.expirationEpochSeconds);
  }

  const payload = {
    aps: {
      alert: { title: push.title, body: push.body },
      sound: 'default',
      'interruption-level': push.interruptionLevel ?? 'active',
      'thread-id': push.collapseId,
    },
    ...(push.data ?? {}),
  };

  const response = await fetch(`${host}/3/device/${push.deviceToken}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  let reason: string | undefined;
  if (response.status !== 200) {
    try {
      const body = await response.json();
      reason = body?.reason;
    } catch {
      reason = await response.text().catch(() => undefined);
    }
  }

  return {
    deviceToken: push.deviceToken,
    status: response.status,
    reason,
    // 410 Gone, and BadDeviceToken on a 400, both mean the token is dead.
    gone: response.status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered',
  };
};
