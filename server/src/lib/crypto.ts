/**
 * Envelope encryption helpers for PHI fields.
 *
 * For alpha, the implementation uses AES-256-GCM with per-row data keys.
 * Data keys are wrapped by a "master key" stored in environment for
 * dev/staging, and by AWS KMS in production. The interface is the same.
 *
 * USAGE:
 *   const encrypted = await encryptField('Aiden Smith');
 *   // store `encrypted` in jsonb column
 *
 *   const plaintext = await decryptField(encrypted);
 *
 *   const lookupHash = await encryptForLookup('aiden@example.com');
 *   // store both encrypted (for display) and lookupHash (for WHERE clause)
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
} from 'node:crypto';

export type EncryptedField = {
  c: string; // ciphertext, base64
  iv: string; // initialization vector, base64
  k: string; // wrapped DEK, base64
  v: number; // key version
  t: string; // auth tag, base64
};

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16;
const CURRENT_KEY_VERSION = 1;

/**
 * Loaded once per process. In production this returns a key fetched
 * from AWS KMS; in dev/staging, from environment variable.
 */
let cachedMasterKey: Buffer | null = null;

const getMasterKey = (): Buffer => {
  if (cachedMasterKey) return cachedMasterKey;
  const env = process.env['CAPPY_MASTER_KEY_BASE64'];
  if (!env) {
    throw new Error(
      'CAPPY_MASTER_KEY_BASE64 missing. In production this must come from KMS.',
    );
  }
  const key = Buffer.from(env, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Master key must be ${KEY_LENGTH} bytes`);
  }
  cachedMasterKey = key;
  return key;
};

const getLookupHmacKey = (): Buffer => {
  const env = process.env['CAPPY_LOOKUP_HMAC_KEY_BASE64'];
  if (!env) {
    throw new Error('CAPPY_LOOKUP_HMAC_KEY_BASE64 missing');
  }
  return Buffer.from(env, 'base64');
};

/**
 * Encrypt a string field for storage.
 */
export const encryptField = (plaintext: string): EncryptedField => {
  if (typeof plaintext !== 'string') {
    throw new Error('encryptField: plaintext must be a string');
  }
  const dek = randomBytes(KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, dek, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const wrappedDek = wrapDek(dek);
  return {
    c: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    k: wrappedDek.toString('base64'),
    v: CURRENT_KEY_VERSION,
    t: tag.toString('base64'),
  };
};

/**
 * Decrypt a stored field back to plaintext.
 */
export const decryptField = (field: EncryptedField): string => {
  const dek = unwrapDek(Buffer.from(field.k, 'base64'), field.v);
  const iv = Buffer.from(field.iv, 'base64');
  const ciphertext = Buffer.from(field.c, 'base64');
  const tag = Buffer.from(field.t, 'base64');
  const decipher = createDecipheriv(ALGORITHM, dek, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
};

/**
 * Compute an HMAC of a value for use as a lookup key (e.g. email).
 * Same input always produces same output, so equality lookups work.
 * Different from a password hash — this is for non-secret values that
 * must be looked up.
 */
export const encryptForLookup = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  return createHmac('sha256', getLookupHmacKey())
    .update(normalized)
    .digest('hex');
};

/**
 * Wrap a data encryption key with the master key.
 *
 * For alpha: simple AES-GCM wrap with master key.
 * For prod: replace with AWS KMS Encrypt call.
 */
const wrapDek = (dek: Buffer): Buffer => {
  const master = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, master, iv);
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: iv (12) || tag (16) || wrapped (32) = 60 bytes
  return Buffer.concat([iv, tag, wrapped]);
};

const unwrapDek = (wrapped: Buffer, _version: number): Buffer => {
  const master = getMasterKey();
  const iv = wrapped.subarray(0, IV_LENGTH);
  const tag = wrapped.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = wrapped.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, master, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};
