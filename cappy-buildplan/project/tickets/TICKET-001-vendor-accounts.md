# Ticket: TICKET-001: Set up vendor accounts and begin BAA process

**Assigned to:** Founder (not delegable — requires legal authority and identity verification)
**Created by:** Orchestrator
**Created on:** Day 1
**Estimated effort:** 4 hours of founder calendar time across 1-3 days
**Priority:** P0 blocker
**Milestone:** Milestone 0 — Foundation
**Depends on:** none
**Blocks:** TICKET-002, TICKET-003, TICKET-004

## Context

Every other ticket in Milestone 0 depends on having vendor accounts
provisioned. The BAA processes can take days to weeks, so we start
them in parallel on Day 1.

## Goal

After this ticket: vendor accounts exist for the alpha stack, BAAs
are requested where required, and the founder has credentials in a
password manager.

## Specification

Create accounts for the following, in this order:

### 1. Apple Developer Program ($99/year)
- Personal or LLC enrollment (LLC if entity is formed)
- 2FA enabled on the Apple ID
- Required for TestFlight and App Store submission

### 2. GitHub
- Create the `cappy` GitHub organization (or use existing personal)
- Enable 2FA, prefer hardware key
- Create the `cappy/cappy` repository
- Set branch protection on `main`: require PR, require status checks,
  no force push, no deletes

### 3. Domain registration
- Register `cappy.app` (or chosen primary domain)
- Register `tap.cappy.app` subdomain (will host Universal Links)
- DNS managed via Cloudflare (free tier sufficient for now)

### 4. Supabase
- Create an organization
- Create three projects: `cappy-dev`, `cappy-staging`, `cappy-prod`
- Upgrade `cappy-prod` to Pro plan ($25/mo)
- **Request BAA** via Supabase support — explicitly state HIPAA
  intent, US-only data residency
- Save service role keys, anon keys, and JWT secrets to password
  manager (never commit)

### 5. Sentry
- Create organization
- Choose HIPAA-eligible plan and request BAA
- Create three projects matching environments
- Save DSNs

### 6. Postmark
- Create account
- Choose HIPAA-eligible plan and request BAA
- Verify sending domain (`cappy.app`)
- Save server tokens

### 7. Doppler (or Supabase Vault)
- Create workspace
- Create three configs (dev/staging/prod)
- Invite founder as owner (only member for now)

### 8. Cloudflare
- Add `cappy.app` zone
- Configure DNS to point at staging/prod hosts (TBD by hosting choice)
- Enable WAF in monitor mode initially

## Definition of Done

- [ ] Each vendor has an active account, with 2FA enabled
- [ ] Each BAA-required vendor has a BAA request initiated; pending
      requests noted in `/compliance/baa-register.md`
- [ ] All credentials live in the password manager, not on disk in
      plaintext
- [ ] Cost projection updated in this ticket below — confirm total
      expected month-1 cost is within $200 (Supabase Pro $25 + others)
- [ ] BAA-pending status noted in `/compliance/baa-register.md` with
      requested-date column
- [ ] Founder retrospective recorded at
      `/project/retros/YYYY-MM-DD-TICKET-001.md`

## Out of scope

- Actually deploying anything to these environments (TICKET-004)
- AWS account for KMS in production (deferred until Milestone 1 when
  encryption goes live)
- Cyber liability insurance (founder action item, separate track)

## Notes for the founder

Some BAAs require entity-level signatures (LLC). If the LLC is not
formed, request the BAA in the founder's name and cross-reference
later. Counsel can advise.

Several vendors do not allow Pro→Enterprise BAA self-service; you
may need to contact sales. Start those conversations on Day 1.

---

## Result (filled in by founder on completion)

**Status:**
**Completed on:**
**Vendor account list with verification:**
**BAA-pending list with dates:**
**Cost projection actual:**
