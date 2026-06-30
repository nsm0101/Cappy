# Foundation Kit Manifest

A complete listing of every file in this kit and what it does.

## Top level
- `README.md` — repository orientation
- `AGENTS.md` — universal rules every agent reads first
- `FOUNDER-START-HERE.md` — how to use this kit
- `MANIFEST.md` — this file
- `.gitignore` — git exclusions
- `.editorconfig` — editor consistency

## /agents/ — specialist system prompts
- `orchestrator.md` — the lead agent "Cap"
- `architect.md` — produces ADRs and contracts
- `backend-engineer.md` — implements server code
- `mobile-engineer.md` — implements iOS and Android
- `devops-engineer.md` — infrastructure and CI/CD
- `qa-security.md` — testing, security, threat modeling
- `compliance-docs.md` — HIPAA policies and legal docs
- `product-designer.md` — user flows, copy, design tokens
- `research.md` — vendor and regulatory research

## /project/ — planning artifacts
- `PLAN.md` — the 90-day milestone plan
- `GOALS.md` — strategic + milestone + daily goal stack
- `DECISIONS.md` — chronological ADR index
- `example-day-1-briefing.md` — sample first daily briefing
- `templates/ticket.md` — ticket format
- `templates/retro.md` — per-ticket retrospective
- `templates/adr.md` — ADR format
- `templates/daily-briefing.md` — orchestrator-founder briefing
- `tickets/TICKET-001-vendor-accounts.md` — initial vendor setup
- `tickets/TICKET-002-repo-scaffold.md` — get the repo running
- `tickets/TICKET-003-ci-pipeline.md` — get CI green
- `tickets/TICKET-004-staging-deploy.md` — first staging deploy
- `tickets/TICKET-005-identity-me.md` — first authenticated endpoint
- `tickets/TICKET-006-audit-module.md` — hash-chained audit log
- `tickets/TICKET-007-authz-module.md` — authorization layer
- `feedback/README.md` — how the founder leaves notes for the Orchestrator

## /docs/ — engineering docs
- `glossary.md` — domain vocabulary
- `product/cappy-brief.md` — canonical product vision
- `adr/0001-modular-monolith.md` — architecture style
- `adr/0002-supabase-for-alpha.md` — backend platform
- `adr/0003-cloudflare-r2-storage.md` — object storage
- `adr/0004-native-mobile.md` — iOS+Android native
- `adr/0005-encryption-strategy.md` — envelope encryption for PHI
- `adr/0006-typescript-fastify.md` — backend stack
- `adr/0007-audit-log-strategy.md` — hash-chained audit log
- `adr/0008-nfc-tag-strategy.md` — NTAG215 + Universal Links

## /contracts/ — API and data contracts
- `openapi/cappy.yaml` — full OpenAPI 3.1 spec for alpha endpoints
- `schema/0001-alpha-baseline.md` — canonical schema specification

## /server/ — backend application code
- `package.json` — dependencies and scripts
- `tsconfig.json` — TypeScript strict mode
- `drizzle.config.ts` — ORM config
- `vitest.config.ts` — test runner config
- `.eslintrc.cjs` — lint with module-boundary enforcement
- `.prettierrc` — formatter config
- `.env.example` — required environment variables
- `README.md` — how to run the server
- `src/index.ts` — entry point
- `src/server.ts` — Fastify factory
- `src/lib/config.ts` — env validation
- `src/lib/logger.ts` — Pino with PHI redaction
- `src/lib/crypto.ts` — envelope encryption helpers
- `src/lib/db.ts` — Drizzle connection
- `src/lib/errors.ts` — Problem Details errors
- `src/lib/idempotency.ts` — idempotency key handling
- `src/modules/health/routes.ts` — first working module
- `migrations/0001_alpha_baseline.sql` — full schema
- `migrations/seed-medications-alpha.sql` — acetaminophen catalog

## /compliance/ — internal HIPAA documentation
- `SECURITY-RULES.md` — non-negotiable engineering rules
- `baa-register.md` — vendor BAA tracking
- `hipaa/security-rule-mapping.md` — every Security Rule provision mapped
- `hipaa/incident-response.md` — incident handling procedure
- `hipaa/breach-notification.md` — breach notification procedure
- `hipaa/contingency-plan.md` — backup/DR/emergency mode
- `hipaa/workforce-training.md` — training policy
- `hipaa/access-management.md` — least-privilege procedures
- `hipaa/sanction-policy.md` — consequences for violations
- `hipaa/risk-assessment.md` — annual risk assessment template

## /legal/ — user-facing legal (DRAFT — needs attorney review)
- `privacy-policy.md` — privacy policy draft
- `terms-of-service.md` — terms of service draft
- `caregiver-consent.md` — first-launch consent screen text

## /design/ — design system source of truth
- `tokens.json` — colors, typography, spacing, radii, motion

## /research/ — research templates
- `templates/vendor-rubric.md` — vendor evaluation rubric

## /.github/workflows/ — CI/CD
- `ci.yml` — runs on every PR
- `deploy-staging.yml` — runs on merge to main
- `deploy-prod.yml` — runs on tag push

## /ios/ — iOS app (created in Milestone 2)
- `README.md` — placeholder explaining what goes here

## What this kit does NOT contain (to be built later)

- `/android/` — created in month 4
- `/server/src/modules/{identity,family,children,medications,doses,nfc,authz,audit,invites}/`
  — each created by its respective Milestone 1 ticket
- `/server/tests/integration/` — created with first integration test
- `/infra/terraform/` — created when production hosting is chosen
- `/infra/runbooks/` — created as procedures are needed
- `/security/threat-models/` — created per-feature by QA agent
- `/security/findings/` — created when first finding occurs
- `/research/briefs/` — created per research ticket

These are intentionally empty so the agent loop generates them with
the correct conventions for each.

## Total file count

This kit contains 75 files across 25 directories.
