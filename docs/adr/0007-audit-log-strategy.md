# ADR-0007: Append-only audit table with periodic Merkle root anchoring

**Status:** Accepted
**Date:** Day 0
**Deciders:** Founder, Architect

## Context

HIPAA's audit-control requirement (45 CFR §164.312(b)) requires
mechanisms to "record and examine activity in information systems
that contain or use electronic protected health information."

The strongest interpretation is an immutable, tamper-evident log:
even an engineer with database admin access cannot alter past records
without detection. This is sometimes implemented as a separate
write-once-read-many (WORM) database, sometimes via blockchain anchoring,
sometimes via cloud-native immutable log services.

For alpha, we need something:
- Practical to implement on Supabase Postgres
- Sufficient for HIPAA compliance posture
- Verifiable in audit
- Cheap

## Decision

Use a regular Postgres table named `audit_events` with these
properties:

1. **Append-only by convention and policy.** Postgres role permissions
   restrict the application user to INSERT-only on this table. UPDATE
   and DELETE require a separate admin role, which the application
   never uses.

2. **Hash-chained rows.** Each row stores a hash of the previous row's
   contents plus its own contents. A modification anywhere in the chain
   invalidates every subsequent hash, making tampering detectable.

3. **Daily Merkle root anchoring (post-alpha).** Once per day, compute
   a Merkle root of all audit rows from the previous day. Publish the
   root to a public ledger or third-party timestamping service. This
   gives strong tamper evidence even against database admins. **Defer
   to post-alpha** — for alpha, hash-chaining alone is sufficient.

4. **No deletes, ever.** When a user deletes their account, audit events
   referencing that user are retained but the user_id is replaced by a
   non-reversible hash. The audit trail survives user deletion.

5. **Separate retention policy.** Audit events retain for 7 years
   (HIPAA's standard retention period) regardless of the underlying
   PHI's retention.

## Consequences

### Positive
- Implementable in alpha with no new vendor
- Tamper-evident under realistic threat models (engineer with read access
  cannot quietly alter past records without detection)
- Audit-friendly: a well-defined verification procedure produces a yes/no
  on integrity

### Negative
- Not as strong as a true WORM service or blockchain anchoring (an
  attacker with full database admin access could in principle re-derive
  hashes from a tampered baseline)
- Storage grows monotonically; need a long-term archive strategy

### Neutral / accepted tradeoffs
- Verification cost is O(n) in audit row count; acceptable at our scale

## Schema sketch

```sql
CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID,           -- nullable for system actions
  actor_kind TEXT NOT NULL,     -- 'user' | 'system' | 'admin'
  action TEXT NOT NULL,         -- e.g., 'dose.created'
  entity_type TEXT NOT NULL,    -- e.g., 'dose_event'
  entity_id UUID,
  request_id UUID,              -- correlate to API request
  ip_hash TEXT,                 -- hashed not stored plain
  metadata JSONB,               -- non-PHI context only
  prev_hash TEXT,               -- hash of previous row
  row_hash TEXT NOT NULL        -- hash of this row including prev_hash
);

-- INSERT-only for app role:
GRANT INSERT, SELECT ON audit_events TO cappy_app;
REVOKE UPDATE, DELETE ON audit_events FROM cappy_app;
```

## Alternatives considered

**Dedicated WORM service (AWS QLDB, Datomic).** Rejected for alpha
on cost and BAA-coordination grounds.

**Blockchain anchoring (Ethereum, Bitcoin via OpenTimestamps).**
Considered for the daily root publish step. Defer to post-alpha.

**Application-log-only audit.** Rejected. Logs in Better Stack are
not tamper-evident; an attacker with log credentials could rewrite.

## References

- HIPAA Security Rule §164.312(b)
- AWS QLDB design notes for hash-chain pattern
- RFC 6962 (Certificate Transparency Merkle proofs) for inspiration

## Follow-up actions

- Implement audit module with hash-chaining — file ticket
- Document verification procedure in `/infra/runbooks/audit-verify.md`
  — file ticket
- Defer Merkle root publishing to post-alpha — note in PLAN
