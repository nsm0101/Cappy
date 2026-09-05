# Decisions Log

A chronological log of every architectural decision. New entries go at the
top. Each entry links to a full ADR in `/docs/adr/`.

| Date | ADR | Decision | Status |
|------|-----|----------|--------|
| 2026-08-01 | [ADR-0009](../docs/adr/0009-cross-platform-caregiver-dose-notifications.md) | Cross-platform caregiver dose notifications: per-child opt-in, trigger → Edge Function → Expo Push | Proposed |
| Day 0 | [ADR-0001](../docs/adr/0001-modular-monolith.md) | Modular monolith, not microservices, for alpha | Accepted |
| Day 0 | [ADR-0002](../docs/adr/0002-supabase-for-alpha.md) | Supabase as primary backend platform for alpha | Accepted |
| Day 0 | [ADR-0003](../docs/adr/0003-cloudflare-r2-storage.md) | Cloudflare R2 for object storage | Accepted |
| Day 0 | [ADR-0004](../docs/adr/0004-native-mobile.md) | Native iOS and Android, not React Native | Accepted |
| Day 0 | [ADR-0005](../docs/adr/0005-encryption-strategy.md) | Field-level envelope encryption for PHI | Accepted |
| Day 0 | [ADR-0006](../docs/adr/0006-typescript-fastify.md) | TypeScript on Node.js with Fastify | Accepted |
| Day 0 | [ADR-0007](../docs/adr/0007-audit-log-strategy.md) | Append-only audit table with periodic Merkle root | Accepted |
| Day 0 | [ADR-0008](../docs/adr/0008-nfc-tag-strategy.md) | NTAG215 with custom URI scheme | Accepted |
