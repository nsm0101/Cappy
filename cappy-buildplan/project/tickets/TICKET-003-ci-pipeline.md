# Ticket: TICKET-003: Activate CI pipeline and verify all checks pass

**Assigned to:** DevOps Engineer
**Created by:** Orchestrator
**Created on:** Day 1
**Estimated effort:** 3 hours
**Priority:** P0 blocker
**Milestone:** Milestone 0 — Foundation
**Depends on:** TICKET-002
**Blocks:** TICKET-004 and all Milestone 1 tickets

## Context

The CI workflows in `.github/workflows/` define what "good" looks
like for the codebase. Until they are running and green, we have no
gate on quality.

## Goal

After this ticket: every PR triggers CI; CI runs in <10 minutes for
the common path; all four jobs pass on a clean main; failure modes
are documented.

## Specification

### 1. Verify workflows trigger
Open a small no-op PR (e.g., update a comment in README.md) and
confirm:
- `ci.yml` runs
- All four jobs in `ci.yml` execute
- Job results are visible in PR checks

### 2. Get the `Server (lint, typecheck, test)` job green
- Run `pnpm install` locally and commit `pnpm-lock.yaml`
- Run `pnpm lint`, fix any issues that appear in CI but not locally
  (caching, Node version differences)
- Run `pnpm typecheck`, fix any issues
- Run `pnpm test`, fix any issues
- Iterate until green

### 3. Get the `Contracts` job green
- The OpenAPI spec at `/contracts/openapi/cappy.yaml` should already
  pass `redocly lint`; if not, fix the spec, not the linter
- Document any acceptable warnings

### 4. Get the `Security scans` job green
- Gitleaks: ensure no secrets in repo (the foundation kit was
  generated clean; if anything triggers, investigate)
- Semgrep: address any findings; for findings that are intentional
  patterns, add `# nosemgrep: rule-id` with a justification comment
- OSV: address any high-severity vulnerabilities by upgrading
  dependencies

### 5. Get the `Healthcare policy checks` job green
- Verify the `grep` patterns in the policy job do not produce false
  positives on the scaffold
- If the grep approach is too crude for a particular pattern, replace
  it with a Semgrep rule and document

### 6. Configure required status checks
- In the GitHub repo settings, add all four CI jobs to the required
  checks for `main`
- Confirm a PR with a failing check cannot merge

### 7. Document the pipeline
Create `/docs/runbooks/ci-pipeline.md` describing:
- What each job does
- How to debug failures locally
- How to skip a check (forbidden, but document the escalation path)
- How to add a new check

## Definition of Done

- [ ] All four CI jobs green on a fresh PR
- [ ] Required status checks configured
- [ ] CI completes in <10 minutes for the common path
- [ ] Runbook written at `/docs/runbooks/ci-pipeline.md`
- [ ] Any introduced exceptions (`# nosemgrep`, eslint-disable) are
      catalogued in a follow-up "tech debt" ticket
- [ ] Retrospective written

## Out of scope

- Deploy workflows (TICKET-004)
- E2E tests (Milestone 2)
- Mutation testing (Milestone 1, after first safety-critical module)

---

## Result (filled in by assignee)

**Status:**
**Completed on:**
**PR:**
**CI run time (median):**
**Exceptions introduced (with justifications):**
