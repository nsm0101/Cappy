# Daily Briefing — Day 1

This is the example first briefing produced by the Orchestrator after
foundation kit unpacking. Use it as a template for what to expect from
subsequent briefings.

## Yesterday

- Foundation kit assembled
- Repository structure designed
- ADRs 0001-0008 written
- Schema spec authored
- OpenAPI alpha-baseline spec authored

## Today's plan

**Dispatched (assuming founder approval):**
- TICKET-001 [Vendor accounts] → **Founder** — required for everything
  downstream
- TICKET-002 [Repo scaffold] → **Backend Engineer** — can start as
  soon as GitHub repo exists
- TICKET-003 [CI pipeline] → **DevOps Engineer** — starts after
  TICKET-002

**Holding for founder input:**
- Founder must register `cappy.app` (or chosen primary domain) before
  TICKET-008 (Universal Links setup) becomes possible
- Founder needs to choose an LLC formation track or operate as
  sole-prop for alpha — affects BAA-signing identity

## Decisions needed from founder

1. **Primary domain**
   Question: Use `cappy.app`, `getcappy.com`, or alternative?
   Options: `cappy.app` (premium TLD, ~$20/yr), `getcappy.com` (~$12/yr)
   Recommendation: `cappy.app` — clean, modern, signals product
   Impact of waiting: Universal Links setup blocked

2. **LLC vs. sole-prop**
   Question: Form an LLC before signing first BAA?
   Options:
     - Form LLC now (~$300 + state fees, 1-2 weeks)
     - Operate as sole-prop, transfer to LLC later
   Recommendation: Form LLC; BAAs are difficult to assign later
   Impact of waiting: First BAAs may need to be re-signed

3. **Hosting target for staging**
   Question: Fly.io, Railway, or Render?
   Options: see TICKET-004 spec
   Recommendation: Fly.io for cost and Postgres-adjacency
   Impact of waiting: TICKET-004 cannot start until decided

## Risk register changes

- New risk added: Fly.io BAA availability for production. Mitigation
  documented in TICKET-004; production hosting decision is its own
  ADR.

## Burn

- Day 1 estimated agent-hours: 9 (3 tickets × ~3h each, including
  founder time on TICKET-001)
- Cumulative milestone progress: ~5%

## Notes from founder feedback

(none yet — empty `/project/feedback/` on Day 1)

---

## Founder response section

**Approve today's plan?**
**Decisions:**
1. Primary domain:
2. LLC vs. sole-prop:
3. Hosting target:

**New goals or priorities:**
**Notes:**
