# cappy-prod Runbook (M3)

**Project created 2026-07-02 via MCP:** ref `msjmnvegjrycwoedrwym`, region us-east-1, org CloseDose, free tier.
URL `https://msjmnvegjrycwoedrwym.supabase.co` · publishable key `sb_publishable_mIqDeSdJdpSgolgpBs1VfA_H_zev7WJ` (client-safe; already wired into `eas.json` production profile).

Dev (`cappy-dev`, ref `hyfmcwswtjlnxtdspggr`) stays untouched — development builds keep using `.env`.

## 1 · Deploy schema + functions (your machine, ~5 min)

```bash
cd ~/Documents/GitHub/Cappy/app

# Link to prod (dashboard → Project Settings → Database → set/reset the DB
# password FIRST; store it ONLY in your password manager)
supabase link --project-ref msjmnvegjrycwoedrwym

# All 16 tracked migrations, in order (schema, RLS, triggers, RPCs, storage
# bucket, seeds incl. the new ibuprofen row, all of today's safety fixes)
supabase db push

# Edge functions
supabase functions deploy nfc-resolve accept-invite --project-ref msjmnvegjrycwoedrwym
```

Verify: dashboard → Table Editor shows `profiles`/`children`/`dose_events` etc.; `medications` has 5 rows (4 acetaminophen + Motrin Children's); both functions ACTIVE.

## 2 · Dashboard checklist (prod project, ~5 min)

- Auth → Providers → Email: **Confirm email OFF** (matches the app's immediate-session flow — revisit before public launch), enable **leaked password protection**.
- Auth → URL Configuration: Site URL `https://cappy.closedose.com`; additional redirect `cappy://`.
- Auth → Providers → Apple: enable with client ID `com.closedose.cappy` (pairs with the M2 App ID capability).
- **SEC-1 (both projects):** Project Settings → Database → reset password on `cappy-dev` (the alpha one was shared in plaintext — treat as compromised) and set a strong one on prod. Password manager only.
- Backups: free tier has daily backups only. **Upgrade prod to Pro + enable PITR before external testers** (real families' data).

## 3 · Sentry (staged — activates on native build 3)

Code is already wired (`src/lib/monitoring.ts`, called from App.tsx; PII scrubbed, no-op today). To activate:

```bash
npm install @sentry/react-native
```

Create a project at sentry.io → copy the DSN → add `EXPO_PUBLIC_SENTRY_DSN` to the `production` (and optionally `development`) env in `eas.json` → include in the next build.

## 4 · Production build (after M2's build 3 is verified)

```bash
eas build --profile production --platform ios
```

The production profile now carries the prod URL/key, so this binary talks to `cappy-prod` from first launch. Smoke-test: sign up fresh → onboarding checklist → create family → add child → weight → register a tag → NFC cold-launch → log dose → reminder fires → second device sees it live.

## Notes

- The anon/publishable key is public by design (RLS is the security boundary) — safe in git. The service-role key and DB passwords are NOT; never commit them.
- AASA/universal links need no change: same bundle id + team, host already serves `H2AGCK2WB8.com.closedose.cappy` for `/t/*`.
- Prod advisors: after `db push`, run the security advisors once (dev is clean except the intentional authenticated-EXECUTE warnings + the leaked-password toggle).
