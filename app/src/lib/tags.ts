import type { MedicationKind } from './dosing';

/**
 * Well-known NFC tag slugs.
 *
 * These are the mass-produced Cappy stickers that ship on/with a bottle.
 * Unlike per-family hardware-UID tags, a well-known slug tag does NOT
 * belong to a single family — it just identifies the *medication*. The
 * family context comes from the caller's active family at resolve time,
 * so the exact same sticker URL works for every household.
 *
 * The two launch stickers (matching the development build) are:
 *   https://cappy.closedose.com/t/tylenol-child    → acetaminophen
 *   https://cappy.closedose.com/t/ibuprofen-child  → ibuprofen
 *
 * NOTE: keep this map in sync with the Edge Function copy at
 * supabase/functions/_shared/tagSlugs.ts (Deno can't import from src/).
 */
export const WELL_KNOWN_TAG_SLUGS: Record<string, MedicationKind> = {
  'tylenol-child': 'acetaminophen',
  'ibuprofen-child': 'ibuprofen',
};

/** The generic medication a well-known slug maps to, or null if unknown. */
export const genericForTagSlug = (tagUid: string): MedicationKind | null =>
  WELL_KNOWN_TAG_SLUGS[tagUid.trim().toLowerCase()] ?? null;

/** True when the tag UID is one of the mass-produced medication stickers. */
export const isWellKnownTagSlug = (tagUid: string): boolean =>
  genericForTagSlug(tagUid) != null;
