# Contingency Plan

> **Status:** Stub.

**Owner:** Founder
**Implements:** 45 CFR §164.308(a)(7)
**Last reviewed:** [DATE]
**Review cadence:** Annual; tested at least annually

## Components

The contingency plan covers four required and one addressable area
under §164.308(a)(7):

### Data backup plan (required)

- **What is backed up:** the entire production Postgres database, all
  Supabase Storage buckets, all infrastructure-as-code, all secrets
  metadata (not values)
- **How:** Supabase Pro point-in-time recovery (continuous), plus
  weekly logical dumps to a separate AWS account / S3 bucket with
  versioning enabled and a different KMS key
- **Where:** primary region us-east-1; replica to us-west-2
- **Retention:** PITR window 7 days (Supabase default); weekly dumps
  retained 12 months
- **Encryption:** AES-256 at rest with separate KMS key from production

### Disaster recovery plan (required)

Recovery objectives for alpha:
- **Recovery Time Objective (RTO):** 8 hours (acceptable for alpha-stage
  service)
- **Recovery Point Objective (RPO):** 15 minutes

Procedure (high level — full runbook at `/infra/runbooks/disaster-recovery.md`):
1. Confirm primary region failure
2. Activate replica
3. Update DNS (managed via Cloudflare)
4. Verify health endpoints
5. Notify users via status page
6. Begin root-cause investigation in parallel

### Emergency mode operation plan (required)

When the system is partially down:
- Mobile app falls back to read-only cache; new dose logs queue
  locally
- Caregivers see a clear "syncing later" indicator
- The system never silently fails to record — local persistence is the
  source of truth until sync resumes

### Testing and revision (required)

- Backup restore drill: monthly to staging, by an automated workflow
- Failover drill: quarterly, manually triggered
- Tabletop exercise: annually, simulated scenario walked through

### Applications and data criticality analysis (addressable)

- **Critical:** Postgres (dose events, families, audit log)
- **Important:** Supabase Auth (without it, users cannot log in but
  data is safe)
- **Recoverable:** Sentry (loss of telemetry is acceptable)
- **Replaceable:** Postmark (other transactional email options exist)

## Test history

| Date | Test type | Result | Notes |
|------|-----------|--------|-------|
| [DATE] | Initial backup restore | TBD | First test before alpha launch |
