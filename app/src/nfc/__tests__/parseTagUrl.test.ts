jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: { isSupported: jest.fn(), start: jest.fn(), cancelTechnologyRequest: jest.fn() },
  NfcTech: { Ndef: 'Ndef' },
  Ndef: { uri: { decodePayload: jest.fn() } },
}));

import { parseTagUrl } from '../nfcService';

describe('parseTagUrl', () => {
  describe('valid URLs', () => {
    it('parses hex UID: https://cappy.closedose.com/t/04A1B2C3 → ok, uid 04A1B2C3', () => {
      const result = parseTagUrl('https://cappy.closedose.com/t/04A1B2C3');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tagUid).toBe('04A1B2C3');
      }
    });

    it('parses hyphen slugs: https://cappy.closedose.com/t/ibu-child → ok, uid ibu-child', () => {
      const result = parseTagUrl('https://cappy.closedose.com/t/ibu-child');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tagUid).toBe('ibu-child');
      }
    });

    it('strips trailing null bytes: https://cappy.closedose.com/t/abc123\\0\\0 → ok, uid abc123', () => {
      const result = parseTagUrl('https://cappy.closedose.com/t/abc123\0\0');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tagUid).toBe('abc123');
      }
    });

    it('strips query string: /t/abc123?x=1 → ok, uid abc123', () => {
      const result = parseTagUrl('https://cappy.closedose.com/t/abc123?x=1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tagUid).toBe('abc123');
      }
    });

    it('strips fragment: /t/abc123#anchor → ok, uid abc123', () => {
      const result = parseTagUrl('https://cappy.closedose.com/t/abc123#anchor');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tagUid).toBe('abc123');
      }
    });
  });

  describe('invalid URLs', () => {
    it('wrong host: https://evil.com/t/abc123 → invalid_url', () => {
      const result = parseTagUrl('https://evil.com/t/abc123');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('invalid_url');
      }
    });

    it('non-https: http://cappy.closedose.com/t/abc123 → invalid_url', () => {
      const result = parseTagUrl('http://cappy.closedose.com/t/abc123');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('invalid_url');
      }
    });

    it('empty string → invalid_url', () => {
      const result = parseTagUrl('');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('invalid_url');
      }
    });

    it('uid too short (< 4 chars): /t/abc → invalid_url', () => {
      const result = parseTagUrl('https://cappy.closedose.com/t/abc');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('invalid_url');
      }
    });

    it('uid too long (> 32 chars) → invalid_url', () => {
      const longUid = 'a'.repeat(33);
      const result = parseTagUrl(`https://cappy.closedose.com/t/${longUid}`);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('invalid_url');
      }
    });

    it('uid with illegal chars: /t/ab$c1 → invalid_url', () => {
      const result = parseTagUrl('https://cappy.closedose.com/t/ab$c1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('invalid_url');
      }
    });
  });
});
