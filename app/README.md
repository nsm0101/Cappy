# Cappy — React Native App Foundation

Family medication coordination via NFC tap.

This folder is the React Native app foundation built by Claude for the
Cappy alpha. It targets iOS first via Expo + EAS, with Android coming
in month 4.

## Read these in order

1. **`BUILD-STATUS.md`** — what's done, what's not, known issues
2. **`HOW-TO-FINISH.md`** — concrete remaining tasks as tickets
3. **`PUSH-TO-GITHUB.md`** — how to commit this to your repo

## Quick start (after you fill in the missing pieces from
`HOW-TO-FINISH.md`)

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env to add your Supabase URL and anon key

# Start the local Supabase project (requires Docker)
pnpm supabase:start
pnpm supabase:push
pnpm supabase:functions:deploy nfc-resolve accept-invite

# Generate TypeScript types from the schema
pnpm supabase:gen-types

# Run the app
pnpm start
```

Then build a dev client for your physical iPhone:
```bash
eas build --profile development --platform ios
```

NFC does not work in the iOS simulator. You need a real device.

## Architecture decisions

- **Stack**: Expo SDK 51, React Native 0.74, TypeScript strict mode,
  React Navigation v6, Supabase JS v2, react-native-nfc-manager
- **Compliance posture**: C (consumer health app, not HIPAA-covered)
- **Backend**: Supabase only — no separate Node service in alpha
- **Auth**: Supabase Auth with magic links, tokens in Expo SecureStore
- **Authorization**: Postgres Row Level Security policies
- **Audit**: Postgres triggers writing to `audit_events` table
- **NFC URL host**: `https://cappy.closedose.com/t/{TAG_UID}`

For the rationale behind each, see the discussion in the prior Claude
conversation, summarized in the docs to be written per `HOW-TO-FINISH.md`
ticket #6 (`TICKET-DOCS`).

## What this is not

- Not HIPAA-audited (yet — see Posture C decision)
- Not medical advice — coordination tool only
- Not yet beta-ready — see `BUILD-STATUS.md` for the gap

## License

All rights reserved. Proprietary code for the Cappy product.
