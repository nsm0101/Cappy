import { Platform } from 'react-native';
import { HCESession, NFCTagType4, NFCTagType4NDEFContentType } from 'react-native-hce';

/**
 * Direct phone-to-phone "tap to send" for Cappy family invites — Android
 * side.
 *
 * This emulates an NFC Forum Type 4 Tag (via Android Host Card Emulation)
 * containing the invite URL. Any nearby phone — iOS or Android, Cappy
 * installed or not — just taps this phone and reads the link exactly as
 * it would a physical sticker. No tag to write, no pairing step.
 *
 * Apple's CoreNFC gives third-party apps no equivalent API to *emit* NFC
 * data (reader-mode only), so this is Android-only. iPhone admins send the
 * invite a different way — see ShareViaTapScreen's iOS branch.
 */

export type HceBroadcastPhase =
  /** HCE session is being enabled. */
  | 'enabling'
  /** Broadcasting — this is the active "send" signal: hold phones together now. */
  | 'waiting'
  /** A reader (the other phone) has connected and is mid-tap. */
  | 'connected'
  /** The other phone successfully read the full NDEF message — invite sent. */
  | 'read'
  /** Session was stopped (success cleanup, user cancel, or error). */
  | 'stopped';

export type HceBroadcastHandle = {
  /** Stops broadcasting and tears down all listeners. Safe to call more than once. */
  stop: () => Promise<void>;
};

export type HceBroadcastResult =
  | { ok: true; handle: HceBroadcastHandle }
  | { ok: false; message: string };

/** Only Android can emulate an NFC tag; iOS CoreNFC is reader-only. */
export const isHceAvailable = (): boolean => Platform.OS === 'android';

/**
 * Start emulating the invite link as a tappable NFC tag. Resolves once the
 * HCE session is enabled and broadcasting; call `onPhase` to drive an
 * active "hold phones together" UI, and `handle.stop()` to end the session
 * (e.g. on success, cancel, or when the screen unmounts).
 */
export const startHceBroadcast = async (
  url: string,
  onPhase: (phase: HceBroadcastPhase) => void,
): Promise<HceBroadcastResult> => {
  if (!isHceAvailable()) {
    return {
      ok: false,
      message: 'Direct NFC send is only available on Android. iPhones can only read NFC tags, not emit them.',
    };
  }

  try {
    onPhase('enabling');

    const tag = new NFCTagType4({
      type: NFCTagType4NDEFContentType.URL,
      content: url,
      writable: false,
    });

    const session = await HCESession.getInstance();
    await session.setApplication(tag);

    let stopped = false;
    const offEnabled = session.on(HCESession.Events.HCE_STATE_ENABLED, () => {
      if (!stopped) onPhase('waiting');
    });
    const offConnected = session.on(HCESession.Events.HCE_STATE_CONNECTED, () => {
      if (!stopped) onPhase('connected');
    });
    const offDisconnected = session.on(HCESession.Events.HCE_STATE_DISCONNECTED, () => {
      if (!stopped) onPhase('waiting');
    });
    const offRead = session.on(HCESession.Events.HCE_STATE_READ, () => {
      if (!stopped) onPhase('read');
    });

    const stop = async () => {
      if (stopped) return;
      stopped = true;
      offEnabled();
      offConnected();
      offDisconnected();
      offRead();
      try {
        await session.setEnabled(false);
      } catch {
        // Session may already be disabled — nothing to clean up.
      }
      onPhase('stopped');
    };

    await session.setEnabled(true);

    return { ok: true, handle: { stop } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
};
