# Risk Assessment

> **Status:** Stub. Initial risk assessment to be conducted before
> alpha launches with real families.

**Owner:** Founder (Security Officer)
**Implements:** 45 CFR §164.308(a)(1)(ii)(A)
**Last reviewed:** [DATE]
**Review cadence:** Annual, plus when material changes to systems or
processes occur

## Methodology

We follow the NIST SP 800-30 risk assessment methodology adapted for
a small-team healthcare startup:

1. **Identify assets** that contain or process PHI
2. **Identify threats** to those assets
3. **Identify vulnerabilities** that could be exploited by threats
4. **Determine likelihood** of each threat-vulnerability pair (low /
   medium / high)
5. **Determine impact** of each pair (low / medium / high)
6. **Rate risk** as the combination
7. **Document mitigations** in place
8. **File tickets** for residual risks above tolerance

## Asset inventory

| Asset | Description | PHI involved |
|-------|-------------|--------------|
| Production Postgres | Family / child / dose data | Yes |
| Supabase Auth | User credentials | Yes (email, phone) |
| Supabase Storage | Avatar images, future bottle photos | Possibly |
| Sentry | Error reports (with PHI redacted) | Indirectly |
| Postmark | Transactional emails (subject lines non-PHI) | Indirectly |
| Founder workstation | Code, secrets, occasional debug data | Yes |
| Founder mobile devices | Cappy app installations for dev/test | Yes |
| GitHub | Source code, issues, PRs | No (PHI is forbidden in code/issues) |

## Threat scenarios (initial)

For each, the assessment will document likelihood, impact, current
mitigations, and residual risk.

1. Stolen Supabase service role key
2. Compromised founder GitHub account
3. Lost / stolen founder workstation
4. Phishing attack against the founder
5. Vulnerability in a backend dependency
6. Vulnerability in a mobile dependency
7. Misconfigured authorization allowing cross-family data leak
8. SQL injection (mitigated by Drizzle parameterization)
9. Vendor breach (Supabase, Sentry, Postmark)
10. Caregiver invite code brute-forced
11. Lost NFC tag enabling reconnaissance of family contents
12. Attacker reads PHI from production logs (mitigated by redaction)
13. Backup restore restores stale or corrupted data
14. Insider (founder) intentional misuse — for the audit story

## Findings

To be populated after the first formal risk assessment.

## Mitigation tracking

Each finding above tolerance becomes a ticket. Tickets link back to
this document. Closed tickets remain in this document's history.
