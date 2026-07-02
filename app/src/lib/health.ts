/**
 * D13: Apple Health weight import (read-only bodyMass).
 *
 * STAGED FOR NATIVE BUILD 3: `@kingstinct/react-native-healthkit` is lazily
 * required so this module is safe to ship before the package/native build
 * exists — every path degrades to `null` ("Health data unavailable").
 * After `npm i @kingstinct/react-native-healthkit` + EAS build (HealthKit
 * entitlement + NSHealthShareUsageDescription are already in app.json),
 * verify the call shape against the installed version's API.
 *
 * SAFETY: imports NEVER auto-save. The caller must show the provenance
 * caveat (Health data is usually the phone owner's weight) and let the
 * caregiver review + save through the normal validated weight sheet.
 */

export type HealthWeightSample = { kg: number; recordedAt: string };

export const getLatestBodyMassKg = async (): Promise<HealthWeightSample | null> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
    const HK: any = require('@kingstinct/react-native-healthkit');
    const HealthKit = HK.default ?? HK;

    const available = await HealthKit.isHealthDataAvailable?.();
    if (available === false) return null;

    const bodyMass = HK.HKQuantityTypeIdentifier?.bodyMass ?? 'HKQuantityTypeIdentifierBodyMass';
    await HealthKit.requestAuthorization?.([bodyMass]);

    const sample = await HealthKit.getMostRecentQuantitySample?.(bodyMass, 'kg');
    if (!sample || typeof sample.quantity !== 'number' || sample.quantity <= 0) return null;

    const recordedAt =
      sample.endDate instanceof Date
        ? sample.endDate.toISOString()
        : typeof sample.endDate === 'string'
          ? sample.endDate
          : new Date().toISOString();

    return { kg: sample.quantity, recordedAt };
  } catch {
    // Module not installed (pre-build-3), permission denied, or no samples.
    return null;
  }
};
