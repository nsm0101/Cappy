/**
 * Idempotency-Key handling for POST endpoints that create resources.
 *
 * Convention: client generates a UUIDv4, sends in `Idempotency-Key`
 * header. Server stores (key + user_id) → response within a 24-hour
 * window. Duplicate requests within that window return the original
 * response.
 *
 * IMPORTANT: this module owns the `idempotency_keys` table (created
 * in a future migration). For now, this is a stub the Backend Engineer
 * implements when adding the first POST endpoint.
 */

import { z } from 'zod';
import { BadRequest } from './errors.js';

const idempotencyKeySchema = z.string().uuid({
  message: 'Idempotency-Key must be a UUIDv4',
});

export const validateIdempotencyKey = (raw: string | undefined): string => {
  if (!raw) {
    throw BadRequest('Idempotency-Key header is required');
  }
  const result = idempotencyKeySchema.safeParse(raw);
  if (!result.success) {
    throw BadRequest('Idempotency-Key must be a UUIDv4');
  }
  return result.data;
};

/**
 * Stub for the idempotency lookup. The full implementation lives in
 * `/server/src/modules/idempotency/` and is wired in when the first
 * POST endpoint is added.
 *
 * Expected behavior:
 *   - lookup(key, userId) → { found: true, response } | { found: false }
 *   - store(key, userId, response, ttlSeconds=86400)
 *   - storage backed by the `idempotency_keys` table
 */
export type IdempotencyLookup = {
  found: boolean;
  status?: number;
  body?: unknown;
};

export type IdempotencyStore = {
  lookup: (key: string, userId: string) => Promise<IdempotencyLookup>;
  store: (
    key: string,
    userId: string,
    status: number,
    body: unknown,
  ) => Promise<void>;
};
