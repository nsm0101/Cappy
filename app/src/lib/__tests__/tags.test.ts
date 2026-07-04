import { genericForTagSlug, isWellKnownTagSlug, WELL_KNOWN_TAG_SLUGS } from '../tags';

describe('well-known tag slugs', () => {
  it('maps ace-child → acetaminophen', () => {
    expect(genericForTagSlug('ace-child')).toBe('acetaminophen');
  });

  it('maps ibu-child → ibuprofen', () => {
    expect(genericForTagSlug('ibu-child')).toBe('ibuprofen');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(genericForTagSlug('  Ace-Child ')).toBe('acetaminophen');
  });

  it('returns null for unknown slugs / hardware UIDs', () => {
    expect(genericForTagSlug('04A1B2C3')).toBeNull();
    expect(isWellKnownTagSlug('04A1B2C3')).toBe(false);
  });

  it('recognises both launch stickers', () => {
    expect(Object.keys(WELL_KNOWN_TAG_SLUGS).sort()).toEqual([
      'ace-child',
      'ibu-child',
    ]);
    expect(isWellKnownTagSlug('ibu-child')).toBe(true);
    expect(isWellKnownTagSlug('ace-child')).toBe(true);
  });
});
