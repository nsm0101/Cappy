# Incident Response Policy

> **Status:** Stub — to be reviewed by healthcare counsel before any
> incident occurs.

**Owner:** Founder (Security Officer)
**Implements:** 45 CFR §164.308(a)(6)
**Last reviewed:** [DATE]
**Review cadence:** Annual, or after any incident

## Scope

This policy covers any event that compromises, or is suspected to
compromise, the confidentiality, integrity, or availability of Cappy
systems or PHI processed by Cappy.

Examples:
- Unauthorized access to production database or admin credentials
- Loss of an admin device with cached PHI
- A vendor with a BAA suffers a breach
- A bug exposes PHI to the wrong family
- Suspected malicious activity in audit logs

## Roles

For alpha (single-founder), the founder serves all roles:
- **Incident Commander** — coordinates response
- **Security Officer** — assesses severity and breach status
- **Privacy Officer** — handles user notification
- **Communications Lead** — manages external comms

When the team grows, these roles separate.

## Severity classification

| Severity | Definition | Response time |
|----------|------------|---------------|
| **SEV-1** | Confirmed breach of PHI; user notification required | Immediate |
| **SEV-2** | Suspected breach; investigation needed | Within 4 hours |
| **SEV-3** | Security event with no PHI exposure (failed authn surge, dependency vuln, etc.) | Within 24 hours |
| **SEV-4** | Operational issue with security implications (cert near expiry, alert misfired, etc.) | Within 1 week |

## Response procedure

### 1. Detect and triage (immediate)

- Confirm the event is real (not a false-positive alert)
- Assign severity
- Open an incident record at `/security/findings/YYYY-MM-DD-{summary}.md`
- Begin a timeline log (every action taken, timestamped)

### 2. Contain (immediate for SEV-1/2)

- Revoke compromised credentials
- Isolate affected systems
- Preserve evidence (do not delete logs, do not wipe instances)
- If a vendor is compromised, freeze data flow to that vendor

### 3. Assess (within hours)

- Determine scope: how many users, what data, what time period
- Determine cause: how did this happen
- Determine reach: did the data leave our control
- Determine breach status under HIPAA (45 CFR §164.402): was PHI
  acquired, accessed, used, or disclosed in a manner not permitted?

### 4. Notify (timing per breach assessment)

If a HIPAA breach is determined:
- **Affected individuals:** notify within 60 days of discovery
- **HHS OCR:** notify within 60 days for breaches affecting 500+
  individuals; annual report for smaller breaches
- **Media:** notify if breach affects 500+ residents of a state
- **State AGs:** as required by state breach notification laws

For non-HIPAA but security-relevant events:
- Affected users notified at founder's discretion in consultation
  with counsel

### 5. Remediate

- Fix the root cause
- Verify the fix in staging
- Deploy to production
- Monitor for recurrence
- File follow-up tickets for systemic improvements

### 6. Post-mortem (within 1 week of resolution)

- Write a blameless post-mortem at `/security/findings/YYYY-MM-DD-{id}-postmortem.md`
- Include timeline, root cause, what worked, what didn't, action items
- Action items become tickets with owners and dates

## Evidence retention

All incident records, communications, and evidence are retained for at
least 6 years per HIPAA documentation requirements (§164.316(b)(2)(i)).

## Practice

A tabletop exercise simulating a SEV-1 incident is conducted at least
annually and documented.

## Contacts

- **Founder / Incident Commander:** [phone, email]
- **Healthcare attorney:** [TO BE FILLED]
- **Cyber insurance carrier:** [TO BE FILLED if/when policy purchased]
- **Sentry account contact** for vendor-side investigation
- **Supabase support** for vendor-side investigation
