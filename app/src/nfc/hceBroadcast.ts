/**
 * Direct phone-to-phone "tap to send" for Cappy family invites — Android
 * side.
 *
 * DISABLED as of 2026-07-04. This used to emulate an NFC Forum Type 4 Tag
 * via Android Host Card Emulation (the `react-native-hce` package), so any
 * nearby phone could tap this one and read the invite link directly, no
 * physical sticker needed. `react-native-hce`'s Android module turned out
 * to be incompatible with this project's Gradle toolchain (Expo SDK 57 /
 * AGP 8+ — missing namespace, dead jcenter repo, an ancient pinned AGP
 * version in its own buildscript block) and broke the Android build
 * outright. The package has been uninstalled; see plugins/withNfcHce.js
 * for the full diagnosis and how to re-enable this once a Gradle-compatible
 * replacement is in place.
 *
 * Android admins currently fall back to the same share-sheet + QR code flow
 * iOS uses (see ShareViaTapScreen.tsx) — still a real, working way to send
 * an invite, just not a literal NFC tap.
 *
 * This file is kept (rather than deleted) so `isHceAvailable()` has one
 * place to flip back on later, and so nothing that still imports it breaks.
 */

export type HceBroadcastPhase =
  | 'enabling'
  | 'waiting'
  | 'connected'
  | 'read'
  | 'stopped';

export type HceBroadcastHandle = {
  stop: () => Promise<void>;
};

export type HceBroadcastResult =
  | { ok: true; handle: HceBroadcastHandle }
  | { ok: false; message: string };

/** Always false while HCE is disabled — see the file doc comment above. */
export const isHceAvailable = (): boolean => false;

export const startHceBroadcast = async (
  _url: string,
  _onPhase: (phase: HceBroadcastPhase) => void,
): Promise<HceBroadcastResult> => {
  return {
    ok: false,
    message:
      'Direct NFC send is temporarily unavailable on Android. Use "Share link instead" — it works just as well.',
  };
};
