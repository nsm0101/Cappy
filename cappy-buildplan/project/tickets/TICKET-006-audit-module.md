# Ticket: TICKET-006: Implement the audit module

**Assigned to:** Backend Engineer
**Created by:** Orchestrator
**Created on:** Day 6
**Estimated effort:** 4 hours
**Priority:** P0 blocker
**Milestone:** Milestone 1 — Backend core
**Depends on:** TICKET-005
**Blocks:** every state-changing endpoint (which must emit audit
events per security rules)

## Context

ADR-0007 specifies a hash-chained audit table. Every state-changing
endpoint must emit an audit event. We need the helper before we
build any of those endpoints, otherwise we will paper over the
requirement and ship without proper auditing.

## Goal

After this ticket: any module can call
`audit.record({ actor, action, entityType, entityId, ...})`
inside a transaction, and the row is appended to `audit_events`
with a correct hash chain.

## Specification

### 1. Module skeleton
```
/server/src/modules/audit/
  routes.ts       (no public routes for now)
  service.ts
  repository.ts
  schema.ts
  index.ts
  tests/
```

### 2. Schema
```typescript
export const auditEvents = pgTable('audit_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid('actor_user_id'),
  actorKind: text('actor_kind').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  requestId: uuid('request_id'),
  ipHash: text('ip_hash'),
  metadata: jsonb('metadata').notNull().default({}),
  prevHash: text('prev_hash'),
  rowHash: text('row_hash').notNull(),
});
```

### 3. Hash computation
```typescript
const hashRow = (row: AuditRowInput, prevHash: string | null): string => {
  const canonical = JSON.stringify({
    occurredAt: row.occurredAt.toISOString(),
    actorUserId: row.actorUserId,
    actorKind: row.actorKind,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    requestId: row.requestId,
    ipHash: row.ipHash,
    metadata: row.metadata,
    prevHash,
  });
  return createHash('sha256').update(canonical).digest('hex');
};
```

### 4. Service: `record()`
```typescript
record(input: AuditRecordInput, tx: DrizzleTransaction): Promise<void>
```
- Locks the table for SELECT MAX(id) (use `SELECT ... FOR UPDATE` on
  a known row pattern, or a sequence-based approach — discuss with
  Architect if unsure)
- Reads the previous row's `row_hash`
- Computes the new row's `row_hash`
- Inserts the row in the same transaction
- Returns void on success; throws on failure (caller's transaction
  rolls back)

**The lock is important** — without it, two concurrent inserts could
read the same prev_hash and break the chain.

### 5. Verification helper (CLI script)
A script at `/server/scripts/verify-audit-chain.ts`:
- Reads all audit rows in id order
- Recomputes every row's hash
- Reports any mismatch
- Exit code 0 if chain is valid, 1 if not

### 6. Tests
- Unit test: `hashRow` is deterministic
- Unit test: chain verification passes after sequential inserts
- Unit test: chain verification fails after manual tampering
- Integration test: concurrent inserts under load do not break the
  chain (insert 100 rows from 10 parallel transactions, verify chain)
- Integration test: a transaction that fails after `audit.record()`
  rolls back the audit row

### 7. Wire into server bootstrap
- On server start, verify the chain has integrity (call verifier on
  startup; if invalid, log a CRITICAL event and refuse to serve)
- This catches a corrupted backup restore or accidental tampering

## Definition of Done

- [ ] `audit.record()` available for import via `modules/audit/index.ts`
- [ ] All tests pass; concurrent insert test confirms no chain breaks
- [ ] Verification script runs in <30 seconds against 10,000 rows
- [ ] Server startup verifies chain integrity
- [ ] Coverage ≥90% for the audit module (this is safety-critical
      code per QA rules)
- [ ] Documentation in `/docs/runbooks/audit-verify.md`
- [ ] Retrospective written

## Out of scope

- Daily Merkle root anchoring (deferred to post-alpha per ADR-0007)
- Admin UI for browsing audit events (deferred)
- Encrypting audit metadata (it must remain non-PHI by convention,
  not by encryption)

## Notes for the assignee

- The transaction-with-lock pattern is subtle. If unsure, use an
  advisory lock: `pg_advisory_xact_lock(<some constant>)` at the
  start of the audit insert. This serializes audit inserts globally;
  acceptable at our scale.
- Never log the `metadata` field at debug level if it could
  inadvertently contain anything PHI-adjacent.

---

## Result (filled in by assignee)

**Status:**
**Completed on:**
**PR:**
**Concurrent-insert test results:**
**Verification script timing:**
