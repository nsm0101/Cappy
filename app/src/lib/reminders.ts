import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * FLOW-2: local "next dose is safe" reminders.
 *
 * One scheduled local notification per (child, medication) pair, fired at the
 * server-computed `next_safe_at`. Logging a newer dose for the same pair
 * cancels and replaces the previous reminder. The reminder is a nudge, not a
 * dose instruction — copy tells the caregiver to confirm in Cappy first
 * (SAFE-3 re-checks at log time regardless).
 *
 * Storage:
 *  - `cappy.reminders.enabled` — the user's opt-in preference.
 *  - `cappy.reminders.map` — { "childId:medicationId": notificationId }.
 */

const PREF_KEY = 'cappy.reminders.enabled';
const MAP_KEY = 'cappy.reminders.map';

export const getReminderPref = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(PREF_KEY)) === 'true';

export const setReminderPref = async (enabled: boolean): Promise<void> =>
  AsyncStorage.setItem(PREF_KEY, enabled ? 'true' : 'false');

const readMap = async (): Promise<Record<string, string>> => {
  try {
    return JSON.parse((await AsyncStorage.getItem(MAP_KEY)) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
};

const writeMap = async (map: Record<string, string>): Promise<void> =>
  AsyncStorage.setItem(MAP_KEY, JSON.stringify(map));

/** Cancel the pending reminder for a (child, medication) pair, if any. */
export const cancelDoseReminder = async (
  childId: string,
  medicationId: string,
): Promise<void> => {
  const map = await readMap();
  const key = `${childId}:${medicationId}`;
  const id = map[key];
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or missing — nothing to clean up.
  }
  delete map[key];
  await writeMap(map);
};

/**
 * Schedule (or replace) the reminder for a (child, medication) pair at
 * `nextSafeAt`. Returns false when the time is already past or the user
 * denied notification permission — never throws to the UI.
 */
export const scheduleNextDoseReminder = async (opts: {
  childId: string;
  medicationId: string;
  recipientName: string;
  medName: string;
  nextSafeAt: string;
}): Promise<boolean> => {
  try {
    const at = new Date(opts.nextSafeAt);
    if (!(at.getTime() > Date.now())) return false;

    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return false;

    await cancelDoseReminder(opts.childId, opts.medicationId);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Next dose window is open',
        body: `${opts.recipientName}'s next ${opts.medName} dose can be given now if still needed. Open Cappy to confirm before giving.`,
      },
      // SDK 57: bare Date triggers were removed; use the explicit date shape.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });

    const map = await readMap();
    map[`${opts.childId}:${opts.medicationId}`] = id;
    await writeMap(map);
    return true;
  } catch {
    return false;
  }
};
