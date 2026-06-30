import { useEffect } from 'react';
import * as Linking from 'expo-linking';

import { parseTagUrl } from '@/nfc';

/**
 * COLD-1 — cold-launch / warm-link observer for NFC tag taps.
 *
 * IMPORTANT: actual routing is owned by `NavigationContainer`'s `linking`
 * config (see `navigation/linking.ts`), which maps
 * `https://cappy.closedose.com/t/:initialTagUid` → the `Scan` screen and
 * delivers the UID as a route param. `ScanScreen` then auto-resolves it.
 *
 * This hook does NOT navigate — doing so would double-trigger resolution.
 * It exists to (a) surface the launching URL for debugging and (b) provide
 * a single, obvious extension point for future work such as analytics on
 * tag-tap entry, or pre-warming the resolve cache.
 *
 * @param onTag optional callback invoked with a parsed tag UID. Keep it
 *              side-effect-only (logging, analytics) — never navigation.
 */
export const useTagLinkObserver = (onTag?: (tagUid: string) => void): void => {
  useEffect(() => {
    let mounted = true;

    const handle = (url: string | null, source: 'cold' | 'warm') => {
      if (!url) return;
      const parsed = parseTagUrl(url);
      if (!parsed.ok) return;
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(`[tag-link:${source}] resolved UID ${parsed.tagUid}`);
      }
      onTag?.(parsed.tagUid);
    };

    void Linking.getInitialURL().then((url) => {
      if (mounted) handle(url, 'cold');
    });

    const sub = Linking.addEventListener('url', ({ url }) => handle(url, 'warm'));

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [onTag]);
};
