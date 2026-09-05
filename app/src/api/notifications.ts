import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from './client';

/**
 * ADR-0009 ticket 2 + 9 — caregiver dose notifications, client side.
 *
 * Responsibilities, in order:
 *  1. Permission state (`hasPermission` / `requestPermission`). The OS dialog
 *     is NEVER fired from here as a side effect — there is exactly one chance
 *     at it per install and the priming sheet owns that moment.
 *  2. Expo push token capture, upserted into `device_tokens` on every
 *     foreground (tokens rotate — ADR-0009 decision 4).
 *  3. Per-child subscription read/toggle against `notification_subscriptions`.
 *  4. Routing a tapped notification to the read-only dose view.
 *  5. The Android `dose-activity` channel, which must be created at runtime.
 *
 * EVERYTHING IN THIS FILE FAILS SOFT. Notifications are awareness, not the
 * safety mechanism (ADR-0009 Context) — a failure here must never break
 * sign-in, dose logging, or navigation. Functions return `false`/`null`/`[]`
 * and never throw to the UI, matching `src/lib/reminders.ts`.
 *
 * PHI: nothing in this file logs a notification payload, a child name, or a
 * dose. The only identifier that crosses this boundary is an opaque dose UUID
 * (AGENTS.md §3 — never log PHI, never put PHI in a push payload).
 *
 * This file coexists with `src/lib/reminders.ts`, which schedules *local*
 * "next dose is safe" reminders. Both use expo-notifications; neither owns the
 * global `setNotificationHandler` (that lives in `App.tsx`). Remote dose
 * notifications are distinguished by a `doseId` in their data payload — the
 * response router below ignores anything without one, so local reminders are
 * never mistaken for a dose deep link.
 */

/**
 * `device_tokens` and `notification_subscriptions` land in the ADR-0009
 * ticket-1 migration and are not in the generated `Database` type yet. Until
 * `npm run supabase:gen-types` is re-run against a project that has them, they
 * are reached through a deliberately untyped view of the *same* client — the
 * Supabase specifics stay inside `src/api` either way (ADR-0002). Every row
 * that leaves this file is given an explicit type below. Delete this cast once
 * the generated types include both tables.
 */
const db: SupabaseClient = supabase as unknown as SupabaseClient;

/** Android channel id. Ticket 3's push payload must send this as `channelId`. */
export const DOSE_ACTIVITY_CHANNEL_ID = 'dose-activity';

/** Matches the `platform` check constraint on `device_tokens`. */
export type PushPlatform = 'ios' | 'android';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/** One row of the per-child notification settings list. */
export type ChildSubscription = {
  childId: string;
  enabled: boolean;
};

/** What a tapped dose notification resolves to. `doseId` is an opaque UUID. */
export type DoseNotificationTarget = { doseId: string };

// ---------------------------------------------------------------------------
// Project id
// ---------------------------------------------------------------------------

/**
 * The EAS projectId an Expo push token is attributed to. Read from the runtime
 * config rather than hardcoded so a project transfer or a second EAS project
 * doesn't silently mint tokens against the wrong id.
 *
 * `expoConfig.extra.eas.projectId` is the app.json value; `easConfig` is what
 * EAS Build injects. Either is authoritative; neither exists on a bare
 * `expo start` without EAS, in which case token capture is skipped.
 */
export const getProjectId = (): string | null => {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
};

const currentPlatform = (): PushPlatform | null =>
  Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/**
 * Current OS permission state. Purely a read — this never shows a dialog, so
 * it is safe to call on mount, on the settings screen, or anywhere else.
 *
 * `undetermined` means the prompt has not been shown yet and priming should
 * offer it. `denied` means the one prompt was spent and the only remaining
 * path is the OS settings deep link (ADR-0009 "Permission-denied state").
 */
export const getPermissionStatus = async (): Promise<NotificationPermission> => {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      return 'granted';
    }
    return settings.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
};

/** Convenience wrapper: true only when notifications can actually be delivered. */
export const hasPermission = async (): Promise<boolean> =>
  (await getPermissionStatus()) === 'granted';

/**
 * Fires the OS permission dialog and, on success, captures the push token.
 *
 * CALL THIS ONLY FROM THE PRIMING SHEET'S ACCEPT ACTION. iOS gives an app
 * exactly one shot at this dialog per install; a cold prompt wastes it
 * (ADR-0009 "Permission priming"). Declining the priming sheet must not reach
 * this function at all.
 *
 * Returns whether permission is now granted. Never throws.
 */
export const requestPermission = async (): Promise<boolean> => {
  try {
    const settings = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    if (!settings.granted) return false;
    // Granted just now — capture the token immediately rather than waiting
    // for the next foreground.
    await syncDeviceToken({ force: true });
    return true;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Android channel (ticket 9)
// ---------------------------------------------------------------------------

/**
 * Create the `dose-activity` channel at IMPORTANCE_HIGH (ADR-0009 decision 5 —
 * the Android counterpart to iOS Time Sensitive). Channels only exist at
 * runtime, so this runs on every launch; re-creating an existing channel is a
 * no-op and cannot override a user's own tweaks, which is the intended Android
 * behaviour.
 *
 * `lockscreenVisibility: PRIVATE` hides the body on a secure lock screen. The
 * notification copy carries a child's name and a medication (AGENTS.md §3
 * forbids PHI in a push payload), so hiding it behind an unlock is the
 * conservative default. Flip to PUBLIC only with a deliberate decision.
 *
 * Note: Android's `category: msg` from the ADR is a *per-notification* field,
 * not a channel field — expo-notifications' channel API has no `category`
 * option. It has to be set by the sender (ticket 3) if it is set at all.
 *
 * No-op off Android. Never throws.
 */
export const ensureDoseActivityChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(DOSE_ACTIVITY_CHANNEL_ID, {
      name: 'Dose activity',
      description: 'When another caregiver logs a dose for a child you follow.',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      enableVibrate: true,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      showBadge: true,
    });
  } catch {
    // Best effort — a missing channel degrades importance, it does not break
    // delivery, and it must not break launch.
  }
};

// ---------------------------------------------------------------------------
// Device token capture (ticket 2)
// ---------------------------------------------------------------------------

/**
 * The device's Expo push token, or null when one can't be obtained —
 * simulator/emulator, no EAS projectId, missing FCM/APNs credentials, or
 * offline. All of those are expected states, not errors.
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  const projectId = getProjectId();
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data || null;
  } catch {
    return null;
  }
};

/**
 * Foregrounding twice in a second shouldn't produce two writes. Purely a write
 * -amplification guard; `force: true` bypasses it for the moments that matter
 * (permission just granted, user just signed in).
 */
const MIN_SYNC_INTERVAL_MS = 60_000;
let lastSyncAt = 0;

/**
 * Upsert this device's push token for the signed-in caregiver.
 *
 * Conflict target is `token` (unique on `device_tokens`), so the same physical
 * device re-registering under a different account moves the row rather than
 * duplicating it — which is exactly what must happen, or the previous user
 * keeps receiving another family's dose notifications.
 *
 * Returns false — never throws — when there is no session, no permission, no
 * token, or the write fails.
 */
export const syncDeviceToken = async (
  opts: { force?: boolean } = {},
): Promise<boolean> => {
  try {
    const platform = currentPlatform();
    if (!platform) return false;
    if (!opts.force && Date.now() - lastSyncAt < MIN_SYNC_INTERVAL_MS) return false;

    // getSession() reads the persisted session locally; getUser() would hit
    // the network on every foreground for no added guarantee here.
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return false;

    if (!(await hasPermission())) return false;

    await ensureDoseActivityChannel();

    const token = await getExpoPushToken();
    if (!token) return false;

    const { error } = await db.from('device_tokens').upsert(
      {
        user_id: userId,
        token,
        platform,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
    if (error) return false;

    lastSyncAt = Date.now();
    return true;
  } catch {
    return false;
  }
};

/**
 * Drop this device's token row. Intended for sign-out: without it the device
 * keeps receiving dose notifications for the account that just signed out.
 *
 * Wired into `signOut` in `src/api/auth.ts`, which calls this *before*
 * `supabase.auth.signOut()` — the RLS policy on `device_tokens` is keyed on
 * `auth.uid()`, so the delete only lands while the session is still live.
 */
export const unregisterDeviceToken = async (): Promise<boolean> => {
  try {
    const token = await getExpoPushToken();
    lastSyncAt = 0;
    if (!token) return false;
    const { error } = await db.from('device_tokens').delete().eq('token', token);
    return !error;
  } catch {
    return false;
  }
};

/**
 * Start keeping `device_tokens` current: sync now, on every foreground, and on
 * sign-in. Returns a dispose function. Call once from `App.tsx`.
 *
 * `src/api/client.ts` already installs a module-level AppState listener for
 * Supabase's auto-refresh. This is a second, additive listener rather than a
 * change to that one: RN supports many subscribers, the two concerns have
 * different lifetimes, and `client.ts` is the vendor-swap boundary file this
 * ticket does not own. The pattern (an AppState `change` listener that acts
 * only on `active`) is deliberately identical.
 */
export const startDeviceTokenSync = (): (() => void) => {
  void syncDeviceToken({ force: true });

  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncDeviceToken();
  });

  // A cold launch reaches here before auth resolves, so the first sync above
  // usually finds no session. Re-run once auth settles.
  const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      void syncDeviceToken({ force: true });
    }
  });

  return () => {
    appStateSub.remove();
    authSub.subscription.unsubscribe();
  };
};

// ---------------------------------------------------------------------------
// Per-child subscriptions (ticket 2)
// ---------------------------------------------------------------------------

/**
 * The signed-in caregiver's per-child subscription rows.
 *
 * A child with no row is subscribed by default (ADR-0009 decision 1 — the safe
 * state is the automatic one, because the failure mode of silence is worse
 * than the failure mode of noise). The settings screen should therefore treat
 * a missing entry as ON, not OFF.
 *
 * Returns `[]` on any failure — never throws.
 */
export const listMySubscriptions = async (): Promise<ChildSubscription[]> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return [];

    // RLS already scopes this to the caller; the explicit filter keeps the
    // query honest if a policy is ever loosened.
    const { data, error } = await db
      .from('notification_subscriptions')
      .select('child_id, enabled')
      .eq('user_id', userId);
    if (error || !data) return [];

    return (data as { child_id: string; enabled: boolean }[]).map((row) => ({
      childId: row.child_id,
      enabled: row.enabled,
    }));
  } catch {
    return [];
  }
};

/**
 * Turn dose notifications for one child on or off. Upserts on the
 * (user_id, child_id) primary key, so this works whether or not the
 * auto-subscribe row from invite acceptance exists yet.
 *
 * Returns whether the write landed — never throws. The settings screen should
 * revert its optimistic toggle on `false`.
 */
export const setSubscriptionEnabled = async (
  childId: string,
  enabled: boolean,
): Promise<boolean> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return false;

    const { error } = await db.from('notification_subscriptions').upsert(
      {
        user_id: userId,
        child_id: childId,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,child_id' },
    );
    return !error;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Tap → read-only dose view
// ---------------------------------------------------------------------------

/**
 * Pull the dose id out of a notification's data payload.
 *
 * `doseId` is the canonical key; `dose_id` is accepted because the payload is
 * built server-side by a different ticket and snake_case is the house style
 * there. Anything without one (a local reminder from `lib/reminders.ts`, a
 * future notification type) returns null and is ignored by the router.
 *
 * The payload is never logged — see the PHI note at the top of this file.
 */
export const parseDoseNotification = (data: unknown): DoseNotificationTarget | null => {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const raw = record.doseId ?? record.dose_id;
  return typeof raw === 'string' && raw.length > 0 ? { doseId: raw } : null;
};

type DoseNavigator = (doseId: string) => void;

let doseNavigator: DoseNavigator | null = null;
let pendingDoseId: string | null = null;

/**
 * Register the function that actually navigates to the dose view.
 *
 * This mirrors the split already used for NFC deep links
 * (`navigation/useTagLinkObserver.ts`): this module observes and decodes, and
 * something inside `NavigationContainer` owns routing. There is no navigation
 * ref in this repo today, so the navigation side registers a callback here
 * instead — `src/api` must not import from `src/navigation`.
 *
 * Expected wiring (owned by the navigation ticket):
 *   setDoseNotificationNavigator((doseId) =>
 *     navigation.navigate('DoseDetail', { doseId }));
 * and `setDoseNotificationNavigator(null)` on unmount.
 *
 * A tap that cold-launches the app arrives before navigation is mounted, so
 * one target is buffered and flushed the moment a navigator registers.
 */
export const setDoseNotificationNavigator = (navigate: DoseNavigator | null): void => {
  doseNavigator = navigate;
  if (!navigate || !pendingDoseId) return;
  const doseId = pendingDoseId;
  pendingDoseId = null;
  try {
    navigate(doseId);
  } catch {
    // A navigation failure must not take down the notification listener.
  }
};

const routeToDose = (target: DoseNotificationTarget | null): void => {
  if (!target) return;
  if (!doseNavigator) {
    pendingDoseId = target.doseId;
    return;
  }
  try {
    doseNavigator(target.doseId);
  } catch {
    // Same reasoning as above.
  }
};

/**
 * Begin routing notification taps. Handles both the warm case (a tap while the
 * process is alive) and the cold case (the tap that launched the process).
 * Returns a dispose function. Call once from `App.tsx`.
 */
export const startDoseNotificationRouting = (): (() => void) => {
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      routeToDose(parseDoseNotification(response.notification.request.content.data));
    })
    .catch(() => undefined);

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    routeToDose(parseDoseNotification(response.notification.request.content.data));
  });

  return () => {
    sub.remove();
  };
};
