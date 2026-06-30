# Ticket: TICKET-005: Implement the identity module - /v1/me endpoint

**Assigned to:** Backend Engineer
**Created by:** Orchestrator
**Created on:** Day 5
**Estimated effort:** 4 hours
**Priority:** P0 blocker
**Milestone:** Milestone 1 — Backend core
**Depends on:** TICKET-002, TICKET-003, TICKET-004
**Blocks:** every other endpoint (auth required for all)

## Context

`/v1/me` is the first authenticated endpoint and serves as the
template for every subsequent endpoint. Getting the auth middleware,
error handling, and audit emission right here means subsequent
tickets only need to focus on business logic.

## Goal

After this ticket: a request to `/v1/me` with a valid Supabase JWT
returns the current user's profile. An unauthenticated request
returns 401 in Problem Details format. The user record is created
in our `users` table on first call.

## Specification

### 1. Create the identity module skeleton
```
/server/src/modules/identity/
  routes.ts
  service.ts
  repository.ts
  schema.ts
  policy.ts
  index.ts
  tests/
    routes.test.ts
    service.test.ts
    repository.test.ts
```

### 2. Schema (`schema.ts`)
Drizzle table definition for `users` matching the SQL migration.
Expose typed inserts, updates, selects.

### 3. Auth middleware (`/server/src/lib/auth.ts`)
A Fastify plugin that:
- Reads `Authorization: Bearer <jwt>` header
- Verifies the JWT using `SUPABASE_JWT_SECRET` (HS256)
- On success, attaches `request.user = { id: <uuid>, email: <string> }`
- On failure, throws `Unauthorized()` from `lib/errors.ts`
- Every route registered with `app.register(routes, { onRequest: [auth] })`
  is protected

### 4. Repository (`repository.ts`)
- `getById(userId): Promise<User | null>`
- `upsertFromAuth({ id, email }): Promise<User>` — creates the user
  row if not found, encrypts email, sets `email_hash`

### 5. Service (`service.ts`)
- `getCurrentUser(userId): Promise<UserDto>` — calls repository,
  decrypts fields, returns DTO matching the OpenAPI `User` schema

### 6. Routes (`routes.ts`)
```typescript
export const identityRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/me',
    { onRequest: [authMiddleware] },
    async (req) => {
      const user = await identityService.getCurrentUser(req.user.id);
      return user;
    }
  );
};
```

### 7. Wire into `server.ts`
```typescript
await app.register(identityRoutes, { prefix: '/v1' });
```

### 8. Tests
- Unit test: `getCurrentUser` returns the right DTO when the user
  exists
- Unit test: `upsertFromAuth` creates a new user on first call,
  returns existing on subsequent
- Integration test: `GET /v1/me` with no token returns 401
- Integration test: `GET /v1/me` with invalid token returns 401
- Integration test: `GET /v1/me` with valid token returns the user
- Integration test: PHI fields (email) are decrypted in the response
  but the database has them encrypted (verify by querying directly)

### 9. Audit
Calling `/v1/me` does NOT emit an audit event (it is a read of one's
own data, not state-changing and not third-party access). When we
later add admin endpoints that read users, those WILL audit.

## Definition of Done

- [ ] `/v1/me` endpoint responds per OpenAPI spec
- [ ] JWT verification works against staging Supabase project
- [ ] Email is encrypted in the database (verified via direct query)
- [ ] All tests pass: unit and integration
- [ ] Coverage on the identity module ≥80%
- [ ] No PHI in any log line (verified by tailing logs during a test
      request and confirming no email or other PHI appears)
- [ ] Lint, typecheck, all CI jobs pass
- [ ] `/v1/me` works against the staging deploy
- [ ] Retrospective written

## Out of scope

- MFA enrollment (separate ticket)
- Profile editing (separate ticket)
- Account deletion (deferred per security rules)

## Notes for the assignee

- Supabase JWTs use HS256 (symmetric). The verification key is the
  Supabase project's JWT secret, available in the project settings.
- The `auth.users.id` from Supabase becomes our `users.id` (same UUID).
  The `upsertFromAuth` pattern handles the case where Supabase has
  the user but our application table does not yet.
- The `display_name` field is nullable; on first call it will be null.
  A separate ticket will let users set it.

---

## Result (filled in by assignee)

**Status:**
**Completed on:**
**PR:**
**Test coverage achieved:**
**Surprises encountered:**
