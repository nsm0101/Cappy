# Security Rules — Non-Negotiable

**Owner:** Founder
**Last reviewed:** [DATE]
**Implements:** 45 CFR §164.308, §164.310, §164.312
**Reviewed by AI agents:** every coding agent reads this before writing code

These rules apply to **every** line of code, **every** infrastructure
change, **every** vendor integration. Violations are P0 incidents,
regardless of who or what introduced them.

## Rule 1 — PHI never leaves the safe path

**The safe path:** PHI flows from the user's device, over TLS 1.3, to
our backend, into a Postgres column with field-level encryption, and
back out to authorized users only. The safe path is short and
auditable.

**Off the safe path:** logs, metrics, traces, error reports, analytics,
push notification payloads, URL parameters, query strings, Sentry
breadcrumbs, GitHub issues, Slack messages, email subject lines,
support chats with vendors.

PHI must never appear off the safe path. Use redaction helpers. Use
opaque identifiers in observability tools. When in doubt, treat the
field as PHI.

## Rule 2 — No PHI without a BAA

A vendor sees PHI only after:
1. The founder signs the vendor's BAA
2. The BAA is filed in `/compliance/baa-register.md`
3. The vendor appears in the data-flow diagram

The current BAA-covered vendors for alpha are:
- Supabase (Pro tier, BAA on file)
- Sentry (HIPAA tier, BAA on file)
- Postmark (HIPAA tier, BAA on file)

Any vendor not on this list **must not** see PHI, even in test data.
This includes:
- ❌ Plain Slack (not BAA-covered)
- ❌ Plain GitHub Issues (not BAA-covered)
- ❌ Vercel (Hobby/Pro not BAA-covered; Enterprise is)
- ❌ Firebase Cloud Messaging payloads (Google's BAA has carve-outs)
- ❌ Plain Google Workspace email
- ❌ Datadog Free/Pro (HIPAA tier exists but separate)

## Rule 3 — Authorization checks are mandatory

Every endpoint that returns or modifies family-scoped data calls
`authz.check(actor, action, target)` **before** doing the work.

A missing `authz.check` is a P0 bug. The CI security pipeline runs
a Semgrep rule that fails the build if a route handler accesses a
family-scoped repository without a preceding `authz.check`.

Authorization decisions return one of `allow | deny | not_found`.
Map both `deny` and `not_found` to HTTP 404 in responses. Returning
403 leaks the existence of resources to unauthorized actors.

## Rule 4 — Audit every state change

Every state-changing endpoint emits an audit event before returning
success. The audit emit happens in the same database transaction as
the state change so they cannot diverge.

Format:

```typescript
await audit.record({
  actor: ctx.userId,
  actorKind: 'user',
  action: 'dose.created',         // verb-noun, past tense
  entityType: 'dose_event',
  entityId: dose.id,
  requestId: ctx.requestId,
  metadata: { /* non-PHI only */ }
});
```

If the operation fails after the audit row is written, the audit row
is rolled back with the transaction. If the operation succeeds, the
audit row is committed atomically.

## Rule 5 — Never roll your own crypto

Use:
- **Server-side**: `/server/src/lib/crypto.ts` (envelope encryption
  using the Node `crypto` module + KMS)
- **iOS**: Apple CryptoKit, Keychain
- **Android**: Android Keystore (when we build it)
- **At-rest disk**: Supabase's built-in encryption (AES-256)
- **In-transit**: TLS 1.3, certificate pinning on mobile

Do not write your own key derivation, signature scheme, or symmetric
cipher. If you find yourself reaching for a crypto primitive that is
not in the helpers, escalate.

## Rule 6 — Idempotency on creates

Every POST endpoint that creates a resource accepts an `Idempotency-Key`
header. The key plus the user id forms a uniqueness constraint;
duplicate keys within 24 hours return the original response.

The mobile clients generate UUIDv4 keys client-side and persist them
locally with the queued operation. Network retries reuse the same key.

## Rule 7 — No deletes for PHI in alpha

Hard rule for alpha: we do not implement DELETE endpoints for PHI.
Soft-delete only (set `deleted_at`). This is a deliberate choice to
avoid accidental data loss while we are building. Real delete
capability comes post-alpha after we have:
1. A documented retention policy
2. A user-facing data-deletion procedure
3. Audit-trail handling for deletions
4. Founder + attorney review

The user-facing right to deletion is satisfied during alpha by manual
procedure: the user emails the founder, who runs a vetted script.
Document this in the Privacy Policy.

## Rule 8 — Secrets in the secrets manager

Never:
- Commit secrets to git
- Log secrets
- Print secrets in CI output
- Bake secrets into Docker images
- Pass secrets in URL query strings
- Store secrets in plain text on disk

Always:
- Use Doppler (or Supabase Vault) for secrets
- Reference secrets via environment variables at runtime only
- Rotate secrets on a schedule (90 days for app secrets, 365 for
  long-lived KMS keys)
- Mask secrets in CI logs (`::add-mask::` in GitHub Actions)

## Rule 9 — Dependencies are reviewed

Every new direct dependency requires:
1. A justification in the PR description
2. A check that the license is permissive (MIT, Apache 2.0, BSD)
3. A check via OSV Scanner or Snyk for known vulnerabilities
4. A look at the maintainer health (is it actively maintained?)

We do not add a dependency casually. Each one is a future security
review burden.

## Rule 10 — Fail closed

When in doubt, fail closed:
- Authorization check returns an error → deny
- Audit emit fails → fail the operation
- Encryption helper unavailable → fail the operation
- A required environment variable is missing → fail to start

Never silently degrade in a way that weakens security.

## Reporting violations

If you (human or agent) find a violation of these rules in code already
shipped, file a P0 incident immediately:

1. Open `/security/findings/YYYY-MM-DD-{summary}.md`
2. Notify the Orchestrator and the founder
3. Do not fix silently — even if the fix is one line, the disclosure
   path matters

Reporting is rewarded. Hiding is not.
