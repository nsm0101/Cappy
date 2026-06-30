# ADR-0005: Field-level envelope encryption for PHI

**Status:** Accepted
**Date:** Day 0
**Deciders:** Founder, Architect

## Context

HIPAA's encryption-at-rest requirement (45 CFR §164.312(a)(2)(iv)) is
satisfied by a wide range of technical approaches. The most common are:

1. **Disk encryption only** — relies on the cloud provider encrypting
   the underlying volume. Fast, free, low-effort. Provides no
   protection against database-level compromise (a SQL injection that
   reads tables, a stolen backup, an insider with database credentials).

2. **Database transparent data encryption (TDE)** — adds a layer below
   the SQL engine. Same threat model as disk encryption from an
   application's perspective.

3. **Application-level full-row encryption** — every row stored as
   ciphertext. Strong but breaks indexes, breaks relational queries,
   and forces decryption of full rows even when you only need one
   field.

4. **Field-level envelope encryption** — sensitive fields are encrypted
   individually, each with a per-row data key, and the data keys are
   wrapped by a master key in a KMS. The application decrypts only the
   fields it needs. Indexes work for non-encrypted fields.

For Cappy, the threat model includes: stolen database backups, leaked
Supabase credentials, malicious or curious insiders at our database
host, and accidental data exfiltration through app bugs.

## Decision

Use **field-level envelope encryption** for PHI fields:

- Each PHI value is encrypted with AES-256-GCM using a per-row data
  encryption key (DEK)
- DEKs are wrapped by a customer master key (CMK) stored in a KMS
  (AWS KMS for production)
- Encrypted values stored as `{ciphertext, iv, wrapped_dek, key_version}`
  in JSONB columns
- For fields requiring equality lookup (email, phone), store both an
  encrypted value and a salted hash; queries use the hash
- Helper module at `/server/src/lib/crypto.ts` exposes a single API:
  `encryptField()`, `decryptField()`, `encryptForLookup()`

The PHI fields covered:
- `users.email` (encrypted + hashed)
- `users.phone` (encrypted + hashed)
- `families.name`
- `children.display_name`
- `children.date_of_birth`
- `dose_events.note`
- `weight_records.value` (yes — child weight is PHI)

Fields **not** encrypted (operational metadata):
- IDs, timestamps, foreign keys, status flags, role names

## Consequences

### Positive
- A stolen Supabase backup is useless without KMS access
- Key rotation is a per-row operation, not a full-table re-encrypt
- Fine-grained: we can grant access to "see family names but not dose
  notes" via separate decrypt scopes (post-alpha)

### Negative
- ~10x slowdown on PHI field reads vs. plaintext (microseconds, but
  measurable at scale)
- Adds complexity to every PHI-touching query
- Lookup-by-encrypted-field requires the parallel hash column

### Neutral / accepted tradeoffs
- We trade query flexibility (no LIKE on encrypted fields) for security.
  This is acceptable because we don't need fuzzy search on PHI in alpha.
- Key management complexity is real. Documented in
  `/infra/runbooks/key-rotation.md`.

## Alternatives considered

**Disk encryption only.** Rejected. Insufficient against the threat
model.

**Application-level full-row encryption.** Rejected. Breaks too many
relational query patterns to be practical for our schema.

**pgcrypto with a single shared key.** Rejected. Single-key compromise
breaks everything; envelope encryption gives per-row containment.

## References

- AWS KMS envelope encryption pattern
  https://docs.aws.amazon.com/encryption-sdk/latest/developer-guide/concepts.html
- HIPAA Security Rule §164.312(a)(2)(iv)

## Follow-up actions

- Implement `/server/src/lib/crypto.ts` — file ticket (TICKET-005)
- Document key rotation runbook — file ticket
- Spike: measure performance overhead at expected alpha load — file
  ticket
