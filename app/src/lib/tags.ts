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
 *   https://cappy.closedose.com/t/ace-child  → acetaminophen
 *   https://cappy.closedose.com/t/ibu-child  → ibuprofen
 *
 * Slugs are kept short on purpose: NFC Type 2/4 tags (NTAG213/215/216)
 * carry a single NDEF URI record with limited capacity, and a short,
 * easy-to-read slug leaves the most headroom and stays simple to hand off
 * during early testing. Keep any future well-known slug at or under
 * ~12 characters.
 *
 * NOTE: keep this map in sync with the Edge Function copy at
 * supabase/functions/_shared/tagSlugs.ts (Deno can't import from src/).
 */
export const WELL_KNOWN_TAG_SLUGS: Record<string, MedicationKind> = {
  'ace-child': 'acetaminophen',
  'ibu-child': 'ibuprofen',
};

/** The generic medication a well-known slug maps to, or null if unknown. */
export const genericForTagSlug = (tagUid: string): MedicationKind | null =>
  WELL_KNOWN_TAG_SLUGS[tagUid.trim().toLowerCase()] ?? null;

/** True when the tag UID is one of the mass-produced medication stickers. */
export const isWellKnownTagSlug = (tagUid: string): boolean =>
  genericForTagSlug(tagUid) != null;
