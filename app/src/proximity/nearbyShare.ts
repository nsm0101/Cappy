import { getCappyProximityShareModule } from '@modules/cappy-proximity-share';
import type { ProximityPhase } from '@modules/cappy-proximity-share';

/**
 * "Hold phones together" — direct iPhone-to-iPhone invite transfer.
 *
 * Thin wrapper around the native CappyProximityShare module (see
 * modules/cappy-proximity-share/), translating its four separate native
 * events (onPhase/onRange/onReceive/onError) into a single callback so
 * screens don't need to juggle four listeners each.
 *
 * iOS 11+ with a U1/U2 chip only — see isProximityShareSupported(). On any
 * other device (older iPhone, Android) the start functions return null and
 * callers should fall back to AirDrop/QR (send side) or the 6-digit code /
 * universal link (receive side).
 */

export type ProximityEvent =
  | { type: 'phase'; phase: ProximityPhase }
  | { type: 'range'; distanceMeters: number }
  | { type: 'receive'; payload: string }
  | { type: 'error'; message: string };

export type ProximityHandle = {
  /** Ends the session. Safe to call more than once. */
  stop: () => void;
};

const DEFAULT_THRESHOLD_METERS = 0.3;

/** True on iPhone 11+ (U1/U2 chip) running a supported iOS version. */
export const isProximityShareSupported = (): boolean => {
  try {
    return getCappyProximityShareModule()?.isSupported() ?? false;
  } catch {
    return false;
  }
};

const attachListeners = (
  mod: NonNullable<ReturnType<typeof getCappyProximityShareModule>>,
  onEvent: (event: ProximityEvent) => void,
): (() => void) => {
  const subscriptions = [
    mod.addListener('onPhase', (e) => onEvent({ type: 'phase', phase: e.phase })),
    mod.addListener('onRange', (e) => onEvent({ type: 'range', distanceMeters: e.distanceMeters })),
    mod.addListener('onReceive', (e) => onEvent({ type: 'receive', payload: e.payload })),
    mod.addListener('onError', (e) => onEvent({ type: 'error', message: e.message })),
  ];
  return () => subscriptions.forEach((s) => s.remove());
};

/**
 * Start advertising this phone and, once another phone running the
 * receiving side is held against it (within `thresholdMeters`), send
 * `payload` (the invite link) directly over the air.
 *
 * Returns null on unsupported devices — check isProximityShareSupported()
 * first if you want to avoid ever calling this on an incompatible phone.
 */
export const startProximitySend = (
  payload: string,
  onEvent: (event: ProximityEvent) => void,
  thresholdMeters: number = DEFAULT_THRESHOLD_METERS,
): ProximityHandle | null => {
  const mod = getCappyProximityShareModule();
  if (!mod || !mod.isSupported()) return null;

  const detach = attachListeners(mod, onEvent);
  mod.startSending(payload, thresholdMeters);

  return {
    stop: () => {
      mod.stop();
      detach();
    },
  };
};

/**
 * Start listening for a nearby phone to send an invite. Fires
 * `{ type: 'receive', payload }` once the link arrives.
 */
export const startProximityReceive = (
  onEvent: (event: ProximityEvent) => void,
): ProximityHandle | null => {
  const mod = getCappyProximityShareModule();
  if (!mod || !mod.isSupported()) return null;

  const detach = attachListeners(mod, onEvent);
  mod.startReceiving();

  return {
    stop: () => {
      mod.stop();
      detach();
    },
  };
};
