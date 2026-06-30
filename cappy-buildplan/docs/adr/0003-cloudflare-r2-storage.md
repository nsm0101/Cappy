# ADR-0003: Cloudflare R2 for object storage (or Supabase Storage)

**Status:** Accepted (provisional — see "open question")
**Date:** Day 0
**Deciders:** Founder, Architect

## Context

We need object storage for: avatar images, future medication-bottle
photos, and PDF exports of dose history. Volume in alpha is low —
megabytes, not terabytes — but we want a path that scales without
re-architecting.

Two reasonable options:

1. **Cloudflare R2** — S3-compatible, no egress fees, BAA available on
   Cloudflare's enterprise tier
2. **Supabase Storage** — S3-compatible, integrated with Supabase auth
   and RLS, covered by Supabase's BAA on Pro tier

## Decision

For alpha: **use Supabase Storage**. It is covered by the same BAA we
already need, eliminates the second-vendor coordination cost, and
performs adequately at our scale.

Reconsider if any of the following becomes true:
- Egress costs exceed $50/month
- We need geographically distributed reads (CDN-style)
- We need more than 100 GB of storage

If we migrate to R2 later: write a one-time copy job, repoint URLs,
done. Files are referenced by opaque keys, not by URL.

## Open question

We have not yet confirmed Supabase Storage's BAA explicitly covers
storage objects (vs. database content). Day-1 confirmation task for
the founder before we store any PHI in storage.

## Consequences

### Positive
- One vendor for alpha
- Auth integration (RLS-protected URLs) means we can serve files
  through signed URLs without rolling our own auth proxy

### Negative
- If Supabase has an outage, both database and storage go down together
- Supabase Storage is less battle-tested than S3 or R2

## Alternatives considered

**AWS S3.** Rejected for alpha because of the additional BAA setup.
Reconsider when we leave Supabase generally.

**Cloudflare R2.** Strong second choice. Explicit no-egress-fee pricing
is appealing. Defer until we have egress patterns to optimize.

## References

- Supabase Storage docs https://supabase.com/docs/guides/storage
- R2 pricing https://www.cloudflare.com/products/r2/

## Follow-up actions

- Founder confirms Supabase Storage BAA scope before first PHI image
  is stored — file ticket
