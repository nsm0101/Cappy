// Well-known NFC tag slugs — Edge Function copy.
//
// Keep in sync with the app copy at src/lib/tags.ts. A well-known slug
// identifies a medication (not a family); the family comes from the
// caller's active family passed by the client. This is what makes the
// mass-produced "tylenol-child" / "ibuprofen-child" stickers resolve for
// every household with the same URL.

export const WELL_KNOWN_TAG_SLUGS: Record<string, string> = {
  'tylenol-child': 'acetaminophen',
  'ibuprofen-child': 'ibuprofen',
};

/** The generic medication a well-known slug maps to, or null if unknown. */
export const genericForTagSlug = (tagUid: string): string | null =>
  WELL_KNOWN_TAG_SLUGS[(tagUid ?? '').trim().toLowerCase()] ?? null;
