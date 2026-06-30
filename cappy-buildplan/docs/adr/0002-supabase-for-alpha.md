# ADR-0002: Supabase as primary backend platform for alpha

**Status:** Accepted
**Date:** Day 0
**Deciders:** Founder, Architect

## Context

Cappy needs Postgres, authentication, realtime, object storage, and
some background-job capability. We need all of these with BAA coverage.
Building each from primitives on AWS or GCP works but consumes
significant agent-time on plumbing that does not differentiate the
product.

Supabase Pro offers:
- Hosted Postgres with point-in-time recovery
- Auth (email, social, MFA)
- Realtime channels via Postgres logical replication
- Storage (S3-compatible) integrated with row-level security
- BAA on Pro tier and above
- Postgres-native — no proprietary database lock-in

Cost at alpha scale: $25/month for Pro plus modest usage overage.

## Decision

Use Supabase as the primary backend platform for alpha. Use Supabase's
hosted Postgres, auth, realtime, and storage. Treat Supabase auth as
the system of record for identity in alpha; we may layer our own
session management on top later.

We commit to **not** using Supabase-specific features that lock us in:
- Database schema is managed via Drizzle migrations, not Supabase
  migrations
- Edge Functions are avoided; our backend runs as a separate Fastify
  service
- Row Level Security (RLS) policies are kept simple; the primary
  authorization layer lives in our application code, not in RLS

If we need to leave Supabase later, we should be able to: take the
Postgres dump, take the auth user list (re-keyed), take the storage
bucket, and stand up an equivalent on AWS RDS + Cognito + S3 in a few
days.

## Consequences

### Positive
- ~70% less infrastructure code to write for alpha
- BAA, backups, realtime, and auth all covered with one vendor
  relationship
- One bill, one dashboard, one support contact
- Database is plain Postgres; no proprietary query syntax

### Negative
- Single-vendor concentration risk
- Supabase realtime has fewer features than a dedicated WebSocket
  vendor (Ably, Pusher); acceptable for alpha
- BAA approval process can take weeks; start in week 1

### Neutral / accepted tradeoffs
- We will run a separate Fastify backend rather than using Edge
  Functions; this is more code than "Supabase-only" approaches but
  preserves portability

## Alternatives considered

**AWS-native (RDS + Cognito + S3 + AppSync).** Rejected for alpha.
Higher operational overhead, longer setup time, more services to learn
and monitor. Reasonable post-funding migration target.

**Firebase.** Rejected. Firestore is a poor fit for our relational
data model, and Firebase BAA coverage is partial (specifically
problematic for FCM payloads).

**Self-hosted Postgres + custom auth.** Rejected. Massively more work
for no near-term benefit. Reconsider only at scale.

**Convex / Neon + Clerk + Pusher stack.** Considered seriously. Neon
+ Clerk is the closest competitor. Rejected for alpha because Supabase's
single-vendor BAA is simpler than chasing four BAAs separately.

## References

- Supabase BAA addendum (terms reviewed by founder, Day 0)
- Supabase pricing https://supabase.com/pricing
- Drizzle ORM documentation

## Follow-up actions

- Request Supabase BAA in week 1 — file ticket
- Set up Supabase project with three environments (dev/staging/prod)
  — file ticket
- Document the "exit Supabase" runbook by end of alpha — file ticket
