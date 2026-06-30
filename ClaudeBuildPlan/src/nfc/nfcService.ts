import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { Platform } from 'react-native';

/**
 * Cappy NFC Service
 *
 * Wraps react-native-nfc-manager to provide:
 *   - init() / cleanup() lifecycle
 *   - scanOnce() for a one-shot read with timeout
 *   - parseTagUrl() to extract the tag UID from an NDEF URI record
 *
 * The expected NDEF payload is a single URI record of the form:
 *   https://cappy.closedose.com/t/{TAG_UID}
 *
 * Background tag delivery on iOS is handled by Universal Links —
 * iOS opens the app with the URL, and the linking layer routes to
 * the Scan screen with the UID extracted. See src/navigation/linking.ts.
 */

const TAG_URL_HOST =
  process.env.EXPO_PUBLIC_TAG_URL_HOST ?? 'cappy.closedose.com';
const TAG_URL_PREFIX = `https://${TAG_URL_HOST}/t/`;

export type NfcScanError =
  | { kind: 'unsupported'; message: string }
  | { kind: 'permission_denied'; message: string }
  | { kind: 'no_tag_data'; message: string }
  | { kind: 'invalid_url'; message: string }
  | { kind: 'user_cancelled'; message: string }
  | { kind: 'unknown'; message: string };

export type NfcScanResult =
  | { ok: true; tagUid: string; rawUrl: string }
  | { ok: false; error: NfcScanError };

let initialized = false;
let supported: boolean | null = null;

/**
 * Initialize NFC manager. Safe to call multiple times.
 */
export const initNfc = async (): Promise<boolean> => {
  if (initialized) return supported ?? false;
  try {
    supported = await NfcManager.isSupported();
    if (supported) {
      await NfcManager.start();
    }
    initialized = true;
    return supported;
  } catch {
    initialized = true;
    supported = false;
    return false;
  }
};

/**
 * Tear down active scanning sessions. Safe to call from cleanup paths.
 */
export const cancelNfcScan = async (): Promise<void> => {
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {
    // No active session; ignore.
  }
};

/**
 * Run one NFC tag read and resolve with the parsed result.
 *
 * On iOS, this opens the system NFC scan sheet. On Android, the
 * app must be in the foreground and the device must be unlocked.
 */
export const scanOnce = async (
  options: { alertMessage?: string } = {},
): Promise<NfcScanResult> => {
  const isSupported = await initNfc();
  if (!isSupported) {
    return {
      ok: false,
      error: { kind: 'unsupported', message: 'NFC is not supported on this device.' },
    };
  }

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage:
        options.alertMessage ?? 'Hold your phone near the Cappy sticker on the bottle.',
    });

    const tag = await NfcManager.getTag();
    if (!tag) {
      await cancelNfcScan();
      return {
        ok: false,
        error: { kind: 'no_tag_data', message: 'Could not read the tag. Try again.' },
      };
    }

    // Parse the first NDEF URI record
    const ndef = tag.ndefMessage?.[0];
    if (!ndef) {
      await cancelNfcScan();
      return {
        ok: false,
        error: { kind: 'no_tag_data', message: "This tag isn't a Cappy tag." },
      };
    }

    const decodedUrl = Ndef.uri.decodePayload(new Uint8Array(ndef.payload));
    await cancelNfcScan();

    const parsed = parseTagUrl(decodedUrl);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    return { ok: true, tagUid: parsed.tagUid, rawUrl: decodedUrl };
  } catch (err) {
    await cancelNfcScan();
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(message)) {
      return { ok: false, error: { kind: 'user_cancelled', message: 'Scan cancelled.' } };
    }
    if (Platform.OS === 'android' && /permission/i.test(message)) {
      return {
        ok: false,
        error: { kind: 'permission_denied', message: 'NFC permission denied.' },
      };
    }
    return { ok: false, error: { kind: 'unknown', message } };
  }
};

/**
 * Parse a tag URL like `https://cappy.closedose.com/t/04A1B2C3` →
 * `{ ok: true, tagUid: '04A1B2C3' }`.
 *
 * Used both for live scans and for cold-launch via Universal Links.
 */
export const parseTagUrl = (
  url: string,
):
  | { ok: true; tagUid: string }
  | { ok: false; error: NfcScanError } => {
  if (typeof url !== 'string' || url.length === 0) {
    return {
      ok: false,
      error: { kind: 'invalid_url', message: 'No URL on the tag.' },
    };
  }

  // Strip any trailing whitespace/null bytes (some encoders leave them)
  let clean = url.trim();
  while (clean.endsWith('\0')) {
    clean = clean.slice(0, -1);
  }

  if (!clean.startsWith(TAG_URL_PREFIX)) {
    return {
      ok: false,
      error: { kind: 'invalid_url', message: "This doesn't look like a Cappy tag." },
    };
  }

  const tagUid = clean.slice(TAG_URL_PREFIX.length).split(/[/?#]/)[0]?.trim() ?? '';
  // Allow letters, digits, hyphens and underscores so semantic tag slugs
  // like "ibuprofen-child" work alongside hex hardware UIDs.
  if (!/^[A-Za-z0-9_-]{4,32}$/.test(tagUid)) {
    return {
      ok: false,
      error: { kind: 'invalid_url', message: 'Tag identifier is invalid.' },
    };
  }
  return { ok: true, tagUid };
};

export const isNfcSupported = (): boolean => supported === true;
