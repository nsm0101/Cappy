/**
 * Generate a UUID v4. Prefers the platform `crypto.randomUUID` when
 * available; falls back to a Math.random() implementation (not
 * cryptographically strong) for the rare environment without it.
 *
 * For the alpha we do NOT ship the native `react-native-get-random-values`
 * polyfill, so `crypto.randomUUID` is typically unavailable under Hermes
 * and the Math.random() fallback below is used. That's acceptable for
 * dose-event primary keys / idempotency. Before production, add the native
 * polyfill (and a fresh native build) if cryptographically strong IDs are
 * required.
 */
export const uuidv4 = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  // Fallback: RFC 4122 § 4.4
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  const b6 = bytes[6];
  const b8 = bytes[8];
  if (b6 !== undefined && b8 !== undefined) {
    bytes[6] = (b6 & 0x0f) | 0x40; // version 4
    bytes[8] = (b8 & 0x3f) | 0x80; // variant
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
