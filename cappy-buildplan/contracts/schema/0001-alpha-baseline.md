# Canonical Schema Specification — Alpha

**Status:** Source of truth for alpha database design
**Owner:** Architect
**Last reviewed:** [DATE]
**Implementing migrations:** `/server/migrations/0001_alpha_baseline.sql`

This document defines every table, column, constraint, and index for
the Cappy alpha. The Backend Engineer implements this exactly. Changes
to this document require an ADR.

## Conventions

- **IDs**: UUIDv7 (time-ordered) generated server-side, stored as `uuid`
- **Timestamps**: `timestamptz` (always with timezone)
- **Encrypted fields**: stored as `jsonb` with shape
  `{c: <ciphertext>, iv: <iv>, k: <wrapped_dek>, v: <key_version>}`
- **Lookup hashes**: `text` columns named `{field}_hash` storing a salted
  HMAC for equality lookup of encrypted fields
- **Soft deletes**: every table has `deleted_at timestamptz NULL`; queries
  filter `WHERE deleted_at IS NULL` by default
- **Naming**: snake_case tables and columns, plural table names
- **Foreign keys**: always declared, always indexed

## PHI flag legend

Each column is marked:
- 🔒 **PHI** — encrypted at rest, never in logs
- 📊 **Operational** — non-PHI, freely indexable and loggable
- 🔑 **Auth** — secrets or tokens, treated like PHI

## Tables

### users

Identity. Mostly delegates to Supabase Auth; this table is the
application-side mirror with our extensions.

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | Same as Supabase auth.users.id |
| email_encrypted | jsonb | 🔒 | Encrypted email |
| email_hash | text UNIQUE | 📊 | HMAC for lookup |
| phone_encrypted | jsonb NULL | 🔒 | |
| phone_hash | text UNIQUE NULL | 📊 | |
| display_name_encrypted | jsonb NULL | 🔒 | What other caregivers see |
| mfa_enrolled | boolean NOT NULL DEFAULT false | 📊 | |
| created_at | timestamptz NOT NULL DEFAULT now() | 📊 | |
| updated_at | timestamptz NOT NULL DEFAULT now() | 📊 | |
| deleted_at | timestamptz NULL | 📊 | |

Indexes: `email_hash`, `phone_hash`, `(deleted_at)` partial.

### families

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | |
| name_encrypted | jsonb NOT NULL | 🔒 | "The Smiths", "Aiden's family" |
| created_by | uuid NOT NULL REFERENCES users(id) | 📊 | |
| created_at | timestamptz NOT NULL DEFAULT now() | 📊 | |
| updated_at | timestamptz NOT NULL DEFAULT now() | 📊 | |
| deleted_at | timestamptz NULL | 📊 | |

Indexes: `created_by`, `(deleted_at)` partial.

### family_caregivers

Membership table. Every relationship between a user and a family.

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | |
| family_id | uuid NOT NULL REFERENCES families(id) | 📊 | |
| user_id | uuid NOT NULL REFERENCES users(id) | 📊 | |
| role | text NOT NULL CHECK (role IN ('admin','caregiver','readonly')) | 📊 | |
| status | text NOT NULL CHECK (status IN ('active','revoked','pending')) DEFAULT 'pending' | 📊 | |
| joined_at | timestamptz NULL | 📊 | NULL until accepted |
| revoked_at | timestamptz NULL | 📊 | |
| created_at | timestamptz NOT NULL DEFAULT now() | 📊 | |

Indexes: `(family_id, user_id) UNIQUE`, `user_id`, `family_id`.

### caregiver_child_access

Per-child access overrides within a family.

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | |
| family_caregiver_id | uuid NOT NULL REFERENCES family_caregivers(id) | 📊 | |
| child_id | uuid NOT NULL REFERENCES children(id) | 📊 | |
| access_level | text NOT NULL CHECK (access_level IN ('full','readonly','none')) | 📊 | |
| created_at | timestamptz NOT NULL DEFAULT now() | 📊 | |

Indexes: `(family_caregiver_id, child_id) UNIQUE`.

Default behavior when no row exists for a (caregiver, child): caregiver
gets the access implied by their role on the family.

### invites

Family invitation codes.

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | |
| family_id | uuid NOT NULL REFERENCES families(id) | 📊 | |
| code | text NOT NULL UNIQUE | 🔑 | 6-digit, single use |
| proposed_role | text NOT NULL | 📊 | |
| created_by | uuid NOT NULL REFERENCES users(id) | 📊 | |
| created_at | timestamptz NOT NULL DEFAULT now() | 📊 | |
| expires_at | timestamptz NOT NULL | 📊 | 24 hours from creation |
| accepted_at | timestamptz NULL | 📊 | |
| accepted_by | uuid NULL REFERENCES users(id) | 📊 | |

Indexes: `code UNIQUE`, `family_id`, `(expires_at, accepted_at)` partial.

### children

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | |
| family_id | uuid NOT NULL REFERENCES families(id) | 📊 | |
| display_name_encrypted | jsonb NOT NULL | 🔒 | "Aiden", "Baby Sam" |
| date_of_birth_encrypted | jsonb NOT NULL | 🔒 | YYYY-MM-DD |
| avatar_url | text NULL | 📊 | Pointer to storage; non-PHI URL |
| created_at | timestamptz NOT NULL DEFAULT now() | 📊 | |
| updated_at | timestamptz NOT NULL DEFAULT now() | 📊 | |
| deleted_at | timestamptz NULL | 📊 | |

Indexes: `family_id`, `(deleted_at)` partial.

### weight_records

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | |
| child_id | uuid NOT NULL REFERENCES children(id) | 📊 | |
| value_grams_encrypted | jsonb NOT NULL | 🔒 | Stored in grams as integer |
| recorded_at | timestamptz NOT NULL | 📊 | |
| recorded_by | uuid NOT NULL REFERENCES users(id) | 📊 | |
| created_at | timestamptz NOT NULL DEFAULT now() | 📊 | |

Indexes: `child_id`, `(child_id, recorded_at DESC)`.

### medications

The medication catalog. Hardcoded for alpha (acetaminophen variants
only). Read-only from the application.

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | |
| generic_name | text NOT NULL | 📊 | "acetaminophen" |
| brand_name | text NULL | 📊 | "Tylenol" |
| concentration_label | text NOT NULL | 📊 | "160 mg / 5 mL" |
| concentration_mg_per_ml | numeric(8,3) NOT NULL | 📊 | 32.000 |
| formulation | text NOT NULL CHECK (formulation IN ('liquid_suspension','infant_drops','chewable','oral_disintegrating')) | 📊 | |
| rx_status | text NOT NULL CHECK (rx_status IN ('otc','rx')) DEFAULT 'otc' | 📊 | Alpha = otc only |
| min_age_months | integer NOT NULL | 📊 | |
| created_at | timestamptz NOT NULL DEFAULT now() | 📊 | |

Indexes: `generic_name`, `rx_status`.

Seed data for alpha: see `/server/migrations/seed-medications-alpha.sql`.

### nfc_tags

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | |
| tag_uid | text NOT NULL UNIQUE | 📊 | Hardware UID, hex string |
| family_id | uuid NOT NULL REFERENCES families(id) | 📊 | |
| medication_id | uuid NOT NULL REFERENCES medications(id) | 📊 | |
| status | text NOT NULL CHECK (status IN ('active','revoked','pending')) DEFAULT 'pending' | 📊 | |
| label_encrypted | jsonb NULL | 🔒 | Optional human label |
| registered_by | uuid NOT NULL REFERENCES users(id) | 📊 | |
| registered_at | timestamptz NOT NULL DEFAULT now() | 📊 | |
| revoked_at | timestamptz NULL | 📊 | |

Indexes: `tag_uid UNIQUE`, `family_id`.

### dose_events

The core entity. Append-only conceptually; corrections are separate
rows.

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | UUIDv7 |
| client_idempotency_key | uuid NOT NULL | 📊 | From Idempotency-Key header |
| child_id | uuid NOT NULL REFERENCES children(id) | 📊 | |
| medication_id | uuid NOT NULL REFERENCES medications(id) | 📊 | |
| logged_by | uuid NOT NULL REFERENCES users(id) | 📊 | |
| given_at | timestamptz NOT NULL | 📊 | When dose was given |
| amount_mg | numeric(8,3) NOT NULL | 📊 | Computed dose in mg |
| amount_volume_ml | numeric(8,3) NULL | 📊 | If liquid |
| unit_count | integer NULL | 📊 | If chewable |
| note_encrypted | jsonb NULL | 🔒 | Caregiver's free-text note |
| status | text NOT NULL CHECK (status IN ('active','superseded')) DEFAULT 'active' | 📊 | |
| logged_at | timestamptz NOT NULL DEFAULT now() | 📊 | When the row was inserted |

Indexes:
- `(child_id, given_at DESC)` for timeline queries
- `(logged_by, created_at)` partial active for "what did I log"
- `(client_idempotency_key, logged_by) UNIQUE` for idempotency

### dose_corrections

A correction creates a new `dose_events` row and links to the original
via this table. The original `dose_events.status` becomes `superseded`.

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | uuid PK | 📊 | |
| original_dose_event_id | uuid NOT NULL REFERENCES dose_events(id) | 📊 | |
| correction_dose_event_id | uuid NOT NULL REFERENCES dose_events(id) | 📊 | |
| corrected_by | uuid NOT NULL REFERENCES users(id) | 📊 | |
| reason_encrypted | jsonb NULL | 🔒 | |
| corrected_at | timestamptz NOT NULL DEFAULT now() | 📊 | |

Indexes: `original_dose_event_id`, `correction_dose_event_id`.

### audit_events

Hash-chained audit log. See ADR-0007.

| Column | Type | PHI | Notes |
|--------|------|-----|-------|
| id | bigserial PK | 📊 | |
| occurred_at | timestamptz NOT NULL DEFAULT now() | 📊 | |
| actor_user_id | uuid NULL | 📊 | NULL for system actions |
| actor_kind | text NOT NULL | 📊 | 'user' \| 'system' \| 'admin' |
| action | text NOT NULL | 📊 | e.g. 'dose.created' |
| entity_type | text NOT NULL | 📊 | e.g. 'dose_event' |
| entity_id | uuid NULL | 📊 | |
| request_id | uuid NULL | 📊 | |
| ip_hash | text NULL | 📊 | Hashed, never plaintext IP |
| metadata | jsonb NOT NULL DEFAULT '{}' | 📊 | Non-PHI only |
| prev_hash | text NULL | 📊 | NULL for genesis row |
| row_hash | text NOT NULL | 📊 | |

Indexes: `(actor_user_id, occurred_at DESC)`, `(entity_type, entity_id)`,
`(occurred_at)` BRIN.

Permissions:
```sql
GRANT INSERT, SELECT ON audit_events TO cappy_app;
REVOKE UPDATE, DELETE ON audit_events FROM cappy_app;
```

## Forbidden columns / patterns

The Architect rejects any spec that includes:
- Plaintext PHI in any column not marked encrypted
- A `name` column on users (we use display name on family_caregivers
  if the family-specific identity matters, otherwise display_name on
  users)
- Soft-delete via `is_deleted` boolean (use `deleted_at` timestamp)
- A `password` column (auth lives in Supabase Auth)
- A column named `data` or `info` (anti-pattern; be specific)

## Migration strategy

Migrations are forward-only. Reversal happens by writing a new forward
migration that undoes the previous one, never by editing or dropping
applied migrations. Drizzle handles the migration journal.

Every migration ships with:
1. The forward migration SQL
2. A documented manual rollback SQL (in a comment block at top of the
   migration file)
3. An updated schema doc if the migration adds tables or columns
