# BAA Register

The complete list of vendors that touch (or could touch) Cappy production
data, with their Business Associate Agreement status.

**Owner:** Founder
**Last reviewed:** [DATE]
**Implements:** 45 CFR §164.308(b)(1) — Business Associate Contracts

## In production

| Vendor | What they see | BAA status | Signed | Renews | Notes |
|--------|--------------|------------|--------|--------|-------|
| Supabase | Postgres data, auth, storage, realtime | Pending request | — | — | Pro tier required for BAA. Request via Supabase support. |
| Sentry | Error reports (PHI must be redacted before send) | Pending request | — | — | HIPAA tier required. |
| Postmark | Transactional email (subject lines must be non-PHI) | Pending request | — | — | HIPAA tier required. |

## Reviewed and approved for non-PHI use only

| Vendor | What they see | Why no BAA | Constraints |
|--------|--------------|------------|-------------|
| GitHub | Source code, issues | Not BAA-covered | No PHI in code, issues, commit messages |
| Cloudflare (DNS, R2 for static assets) | Public marketing site only | Not BAA-covered | No PHI on this surface |
| Apple Developer Program | App binaries, App Store metadata | Not applicable to PHI | No PHI in binaries, screenshots, copy |
| Google Play Developer Program | App binaries, Play Store metadata | Not applicable to PHI | No PHI in binaries, screenshots, copy |

## Forbidden vendors (currently)

| Vendor | Why forbidden |
|--------|---------------|
| Firebase Cloud Messaging payloads | Google BAA carves out FCM message payload |
| Slack (free / pro tier) | Not BAA-covered; do not paste PHI into Slack |
| Vercel (Hobby / Pro) | BAA only on Enterprise tier |
| OpenAI API (general) | Not BAA-covered for healthcare unless Enterprise + signed BAA |
| Anthropic API (general) | BAA available; engage via sales before any production use |

## Procedure for adding a new vendor

1. Research agent produces a brief evaluating the vendor against the
   rubric in `/research/templates/vendor-rubric.md`
2. Founder reviews and decides
3. Founder signs the BAA
4. PDF of signed BAA is stored in `/compliance/baas/` (gitignored —
   keep originals in cloud storage)
5. This register is updated with the row
6. Data-flow diagram is updated
7. Threat model is updated if the new vendor changes the trust
   boundary

## BAA renewal calendar

The Compliance & Documentation agent sets a 60-days-before-expiration
reminder for every BAA on this register. The reminder is a ticket
filed to the Orchestrator.

## Verification

Annually (or before any pilot launch with real PHI), the founder:
1. Verifies every signed BAA is current
2. Verifies the data-flow diagram matches actual data flows
3. Verifies no forbidden vendor appears in production logs or
   integrations
4. Records the verification in `/compliance/hipaa/risk-assessment.md`
