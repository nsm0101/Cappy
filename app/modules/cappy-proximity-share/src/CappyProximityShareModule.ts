import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { CappyProximityShareModuleEvents } from './CappyProximityShare.types';

declare class CappyProximityShareModule {
  addListener<E extends keyof CappyProximityShareModuleEvents>(
    event: E,
    handler: CappyProximityShareModuleEvents[E],
  ): { remove: () => void };
  removeListeners(count: number): void;
  /** True on iPhone 11+ (U1/U2 Ultra Wideband chip) running a supported iOS version. False everywhere else, including Android. */
  isSupported(): boolean;
  /** Begin advertising/browsing and, once two phones are held together, send `payload`. */
  startSending(payload: string, thresholdMeters: number): void;
  /** Begin advertising/browsing and wait to receive a payload from a nearby sender. */
  startReceiving(): void;
  /** Tear down the session — safe to call at any time, including when idle. */
  stop(): void;
}

let cached: CappyProximityShareModule | null = null;

/**
 * This native module only exists on iOS (`expo-module.config.json` declares
 * `"platforms": ["apple"]` — there is no Android implementation at all).
 * `requireNativeModule` throws immediately if the native module isn't
 * registered, so we resolve it lazily and only on iOS rather than at import
 * time, so simply importing this file on Android never crashes.
 */
export const getCappyProximityShareModule = (): CappyProximityShareModule | null => {
  if (Platform.OS !== 'ios') return null;
  if (!cached) {
    cached = requireNativeModule<CappyProximityShareModule>('CappyProximityShare');
  }
  return cached;
};
