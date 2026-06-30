# Ticket: TICKET-007: Implement the authorization module

**Assigned to:** Backend Engineer
**Created by:** Orchestrator
**Created on:** Day 7
**Estimated effort:** 5 hours
**Priority:** P0 blocker
**Milestone:** Milestone 1 — Backend core
**Depends on:** TICKET-005, TICKET-006
**Blocks:** every endpoint that touches family-scoped data

## Context

Per Security Rule 3, every family-scoped endpoint calls
`authz.check(actor, action, target)` before doing the work. Building
the authz layer first makes the rule enforceable in subsequent tickets.

## Goal

After this ticket: any module can call
`authz.check({ actor, action, target })` and receive
`allow | deny | not_found`. The CI Semgrep rule that fails the build
when a route handler accesses family-scoped data without a
preceding `authz.check` is in place.

## Specification

### 1. Module skeleton
```
/server/src/modules/authz/
  service.ts
  policy.ts
  schema.ts        (no new tables; reads from family_caregivers and
                    caregiver_child_access)
  repository.ts
  index.ts
  tests/
```

### 2. The authz API
```typescript
type Actor = { userId: string };

type Action =
  | 'family.read'
  | 'family.update'
  | 'family.delete'
  | 'caregiver.invite'
  | 'caregiver.revoke'
  | 'child.read'
  | 'child.create'
  | 'child.update'
  | 'dose.read'
  | 'dose.create'
  | 'dose.correct'
  | 'nfc.register'
  | 'nfc.resolve';

type Target =
  | { kind: 'family'; familyId: string }
  | { kind: 'child'; childId: string }
  | { kind: 'dose'; doseId: string }
  | { kind: 'tag'; tagUid: string };

type Decision = 'allow' | 'deny' | 'not_found';

check(actor: Actor, action: Action, target: Target): Promise<Decision>;
```

### 3. Policy implementation
```typescript
// In policy.ts — pure functions, easy to unit-test
const policyForFamily = (
  membership: FamilyMembership | null,
  action: Action
): Decision => {
  if (!membership) return 'not_found';
  if (membership.status !== 'active') return 'not_found';
  switch (action) {
    case 'family.read': return 'allow';
    case 'family.update':
    case 'caregiver.invite':
    case 'caregiver.revoke':
      return membership.role === 'admin' ? 'allow' : 'deny';
    // ... rest
  }
};
```

For child-scoped actions, look up the per-child override in
`caregiver_child_access`; if no row exists, default to the role-based
permission.

For dose-scoped actions, resolve the dose's child, then apply
child-scoped policy.

### 4. Routes integration
A Fastify decorator:
```typescript
app.decorate('authz', { check, ensure });

// ensure() throws NotFound on 'deny' or 'not_found' (never 403)
const ensure = async (
  actor: Actor, action: Action, target: Target
): Promise<void> => {
  const decision = await check(actor, action, target);
  if (decision !== 'allow') {
    throw NotFound();
  }
};
```

### 5. CI enforcement
Add a Semgrep rule to `.github/workflows/ci.yml` security job:

```yaml
- name: Check for missing authz on family-scoped endpoints
  run: |
    # Custom Semgrep rule: any route handler that uses familyId from
    # path params must call authz.ensure or authz.check first
    npx --yes semgrep --config /path/to/cappy-rules.yml server/src/
```

Provide the Semgrep rule file at `/security/semgrep/authz.yml` with
patterns for the common violations.

### 6. Tests
- Unit tests: every (role, action) combination produces the expected
  decision
- Unit test: revoked caregiver gets `not_found` for everything
- Unit test: per-child override of `none` correctly hides the child
- Integration test: a contrived endpoint without authz.ensure fails
  the Semgrep gate

## Definition of Done

- [ ] `authz.check` and `authz.ensure` available
- [ ] All policy unit tests pass; coverage ≥95% on policy.ts
- [ ] CI Semgrep rule catches missing authz calls
- [ ] Documentation in `/docs/runbooks/authz-policy.md` describing
      the role × action × target matrix
- [ ] Retrospective written

## Out of scope

- Time-bounded access (deferred)
- Delegation of admin role (deferred)
- Audit log of authz decisions (we audit the action, not the check)

---

## Result (filled in by assignee)

**Status:**
**Completed on:**
**PR:**
**Test count and coverage:**
**Semgrep gate verification:**
