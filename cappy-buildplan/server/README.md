# Cappy Backend

TypeScript + Fastify + Drizzle backend for the Cappy alpha. See
`/docs/adr/0006-typescript-fastify.md` for stack rationale.

## Local development

Prerequisites:
- Node.js 20 LTS
- pnpm 9+
- Postgres 15+ running locally (or Docker)
- Supabase project for auth (or use Supabase CLI for fully local)

Setup:

```bash
cd server
cp .env.example .env
# Generate two random keys:
echo "CAPPY_MASTER_KEY_BASE64=$(openssl rand -base64 32)" >> .env
echo "CAPPY_LOOKUP_HMAC_KEY_BASE64=$(openssl rand -base64 32)" >> .env

pnpm install
pnpm db:migrate
pnpm dev
```

Verify:

```bash
curl http://localhost:3000/v1/healthz
# {"status":"ok","version":"0.1.0-alpha"}
```

## Module layout

Code lives in modular monolith form (see ADR-0001). Each module is a
self-contained directory under `src/modules/`:

```
src/modules/<name>/
  routes.ts         Fastify route handlers
  service.ts        Business logic
  repository.ts     Database access
  schema.ts         Drizzle table definitions
  events.ts         Event publishers
  policy.ts         Authorization rules
  index.ts          Public exports
  tests/            Unit tests
```

Cross-module imports MUST go through the module's `index.ts`. The lint
rule `boundaries/element-types` enforces this.

## Testing

```bash
pnpm test               # unit tests
pnpm test:integration   # integration tests (requires Postgres testcontainer)
pnpm test:watch         # watch mode
```

Coverage thresholds are 70% baseline. Safety-critical modules (doses,
authz, audit, crypto) target 90%+ and have mutation testing in CI.

## Migrations

Drizzle generates SQL migrations from schema changes:

```bash
pnpm db:generate    # produces a new migration in /migrations
pnpm db:migrate     # applies pending migrations
pnpm db:studio      # GUI for inspection
```

Migrations are forward-only. Rollback is a new forward migration that
undoes the previous one. See `/docs/adr/0001-modular-monolith.md` and
`/contracts/schema/0001-alpha-baseline.md` for conventions.

## Adding a new module

1. Get an Architect-produced spec at `/contracts/schema/` and/or
   `/contracts/openapi/cappy.yaml`
2. Create the module directory with the standard layout
3. Implement schema → repository → service → routes
4. Wire into `src/server.ts`
5. Tests, lint, typecheck pass
6. Update `/docs/runbooks/` if operational behavior changes

## Things this scaffold does not yet have (good first tickets)

- `/v1/me` endpoint (TICKET-IDENTITY-001)
- Auth middleware that verifies Supabase JWT and populates `req.user`
- The `audit_events` table and `audit.record()` helper
- The `idempotency_keys` table and the lookup wiring
- Any module beyond `health`
