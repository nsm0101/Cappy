# Ticket: TICKET-004: Stand up the staging environment and deploy

**Assigned to:** DevOps Engineer
**Created by:** Orchestrator
**Created on:** Day 2
**Estimated effort:** 4 hours
**Priority:** P0 blocker
**Milestone:** Milestone 0 — Foundation
**Depends on:** TICKET-001, TICKET-002, TICKET-003
**Blocks:** all Milestone 1 tickets that need a deployed environment

## Context

Once we can deploy automatically, every subsequent ticket can be
verified against staging. Before that, every ticket lives only in
local dev — verification is harder and the agent loop is slower.

## Goal

After this ticket: a successful merge to `main` deploys the server
to the staging environment, runs the migration, and the staging URL
returns `{"status":"ok"}` on `/v1/healthz`.

## Specification

### 1. Choose a hosting target
Recommended for alpha (in order of preference):
1. **Fly.io** — simple, good Postgres adjacency, $0-20/mo
2. **Railway** — also simple, possibly easier UX
3. **Render** — slightly more expensive but very reliable

The choice goes in a new ADR (`docs/adr/0009-host-choice.md`)
proposed by the Architect, decided by the founder. For this ticket,
assume Fly.io.

### 2. Create the staging environment
- Create a Fly app `cappy-staging`
- Region: `iad` (us-east) for proximity to Supabase
- Allocate a small machine (shared 1x CPU, 256MB RAM is enough for
  alpha)
- Configure secrets:
  - `DATABASE_URL` from Supabase staging project
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
  - `CAPPY_MASTER_KEY_BASE64` (newly generated for staging — different
    from dev)
  - `CAPPY_LOOKUP_HMAC_KEY_BASE64` (newly generated for staging)
  - `NODE_ENV=staging`
  - `LOG_LEVEL=info`
  - `CORS_ALLOWED_ORIGINS` set to `https://staging.cappy.app` once
    DNS is configured

### 3. Wire the deploy step in `.github/workflows/deploy-staging.yml`
Replace the placeholder "Deploy" step with:
```yaml
- name: Set up Fly
  uses: superfly/flyctl-actions/setup-flyctl@master
- name: Deploy
  run: flyctl deploy --remote-only --app cappy-staging
  env:
    FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### 4. Verify the staging deploy
- Push a commit to `main`
- Watch the deploy succeed
- Curl the staging healthcheck:
  `curl https://cappy-staging.fly.dev/v1/healthz`
- Confirm response is `{"status":"ok","version":"0.1.0-alpha"}`

### 5. Wire monitoring
- Sentry: confirm errors from staging show up in the staging Sentry
  project
- Better Stack (or Axiom): set up log forwarding from Fly
- Set up an uptime monitor on `/v1/healthz` (Better Stack or
  UptimeRobot free)

### 6. Document in runbook
Write `/docs/runbooks/deploy.md`:
- How a deploy works step by step
- How to roll back (Fly: `flyctl releases list`, then
  `flyctl releases rollback <version>`)
- How to access logs
- How to SSH into the running instance for debugging (rare)

## Definition of Done

- [ ] `cappy-staging` Fly app exists and runs
- [ ] Merge to main triggers a successful deploy in <10 minutes
- [ ] Staging healthcheck returns `status: ok`
- [ ] Staging error from a test endpoint reaches Sentry
- [ ] Logs from staging reach the log aggregator
- [ ] Uptime monitor is active and alerts to founder email
- [ ] Runbook written and tested by walking through it
- [ ] `/compliance/baa-register.md` updated if Fly/Better Stack/etc.
      need BAAs (note: Fly does NOT have HIPAA BAA available as of
      this writing — confirm current state and document)
- [ ] Retrospective written

## Out of scope

- Production deploy (deferred to end of Milestone 1)
- Custom domain on staging (use the `.fly.dev` URL for alpha)
- Production-grade scaling configuration

## ⚠️ HIPAA caveat

**Fly.io does not offer a HIPAA BAA at the free / standard tier as of
this writing.** Staging environments must not contain real PHI.
Before any real-PHI environment, we must either:
1. Move to a host that offers a BAA (Render Pro, AWS, GCP), or
2. Verify Fly's current BAA status with their team

This ticket sets up STAGING ONLY where PHI is forbidden. Production
hosting is a separate decision documented in a future ADR.

---

## Result (filled in by assignee)

**Status:**
**Completed on:**
**PR:**
**Staging URL:**
**Deploy time (median):**
