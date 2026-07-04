import { genericForTagSlug, isWellKnownTagSlug, WELL_KNOWN_TAG_SLUGS } from '../tags';

describe('well-known tag slugs', () => {
  it('maps tylenol-child → acetaminophen', () => {
    expect(genericForTagSlug('tylenol-child')).toBe('acetaminophen');
  });

  it('maps ibuprofen-child → ibuprofen', () => {
    expect(genericForTagSlug('ibuprofen-child')).toBe('ibuprofen');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(genericForTagSlug('  Tylenol-Child ')).toBe('acetaminophen');
  });

  it('returns null for unknown slugs / hardware UIDs', () => {
    expect(genericForTagSlug('04A1B2C3')).toBeNull();
    expect(isWellKnownTagSlug('04A1B2C3')).toBe(false);
  });

  it('recognises both launch stickers', () => {
    expect(Object.keys(WELL_KNOWN_TAG_SLUGS).sort()).toEqual([
      'ibuprofen-child',
      'tylenol-child',
    ]);
    expect(isWellKnownTagSlug('ibuprofen-child')).toBe(true);
    expect(isWellKnownTagSlug('tylenol-child')).toBe(true);
  });
});
