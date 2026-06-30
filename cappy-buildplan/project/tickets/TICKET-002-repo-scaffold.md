# Ticket: TICKET-002: Initialize the cappy repository from the foundation kit

**Assigned to:** Backend Engineer (or Founder for the first push)
**Created by:** Orchestrator
**Created on:** Day 1
**Estimated effort:** 2 hours
**Priority:** P0 blocker
**Milestone:** Milestone 0 — Foundation
**Depends on:** TICKET-001 (GitHub repo must exist)
**Blocks:** every subsequent ticket

## Context

The foundation kit at `cappy-foundation.zip` (or unpacked directory)
contains every file needed to bootstrap the repository. This ticket
unpacks it into the GitHub repo, sets up branch protection, and
verifies the local dev loop works.

## Goal

After this ticket: `git clone` of the repo, `cd server && pnpm install
&& pnpm dev` produces a server responding on `http://localhost:3000/v1/healthz`
with `{"status":"ok"}`.

## Specification

### 1. Initialize the repository
```bash
git clone git@github.com:cappy/cappy.git
cd cappy
# unpack the foundation kit into this directory
unzip cappy-foundation.zip
# verify file structure matches /home/claude/cappy-foundation/ tree
```

### 2. First commit
- Verify `.gitignore` excludes: `node_modules/`, `dist/`, `.env`,
  `.env.*`, `*.log`, `coverage/`, `.DS_Store`
- Commit the entire foundation kit as commit "chore: initial commit
  from foundation kit"
- Push to `main`

### 3. Branch protection on main
- Require PR before merge
- Require 1 approval (the founder serves as reviewer; the Orchestrator
  agent prepares the PR description)
- Require status checks to pass: `Server (lint, typecheck, test)`,
  `Contracts (OpenAPI lint)`, `Security scans`, `Healthcare policy
  checks`
- Block force pushes
- Block deletions

### 4. Generate and store dev secrets locally
```bash
cd server
cp .env.example .env
echo "CAPPY_MASTER_KEY_BASE64=$(openssl rand -base64 32)" >> .env
echo "CAPPY_LOOKUP_HMAC_KEY_BASE64=$(openssl rand -base64 32)" >> .env
# Edit .env to fill in actual Supabase URLs and dev DATABASE_URL
```

### 5. Bring up local Postgres
Either:
- Install Postgres 15 locally, create database `cappy_dev`, or
- Run `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres
  -e POSTGRES_DB=cappy_dev --name cappy-dev-pg postgres:15`

### 6. Run migrations
```bash
cd server
pnpm install
psql $DATABASE_URL -f migrations/0001_alpha_baseline.sql
psql $DATABASE_URL -f migrations/seed-medications-alpha.sql
```

### 7. Start the dev server
```bash
pnpm dev
```

### 8. Verify
```bash
curl http://localhost:3000/v1/healthz
# Expected: {"status":"ok","version":"0.1.0-alpha"}
```

## Definition of Done

- [ ] Repo populated and pushed to `main`
- [ ] Branch protection rules confirmed on main
- [ ] CI runs on the initial commit (will likely fail until package
      lockfiles exist; this is acceptable for first push, file follow-up
      tickets)
- [ ] Local dev server responds on `/v1/healthz` with `status: ok`
- [ ] Local Postgres has all tables from `0001_alpha_baseline.sql`
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (or all current lint errors are documented
      and a follow-up ticket is filed)
- [ ] Retrospective written

## Out of scope

- Deploying to staging or production (TICKET-004)
- Implementing any module beyond `/health` (subsequent Milestone 1
  tickets)
- Setting up the iOS project (Milestone 2)

## Notes for the assignee

- The lint may warn about `no-unused-vars` and similar in the scaffold;
  add `// eslint-disable-next-line` only as a temporary workaround,
  prefer fixing the underlying issue
- Drizzle config references `src/modules/*/schema.ts` files that do
  not yet exist; this is fine — the migration system uses the SQL file
  baseline for now and Drizzle will pick up generated migrations going
  forward

---

## Result (filled in by assignee)

**Status:**
**Completed on:**
**PR:**
**Verification screenshot of `/healthz` response:**
**Surprises encountered:**
