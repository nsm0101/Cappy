/**
 * ADR-0009 ticket 2 — the parts of the notification client that are pure
 * enough to test off-device.
 *
 * Push delivery itself cannot be tested here (or on a simulator at all) — see
 * QA-NOTIFICATIONS.md. What IS worth pinning down is the decoding and routing
 * logic, because a bug there sends a caregiver to the wrong screen or hijacks
 * the existing local "next dose is safe" reminders from lib/reminders.ts.
 */

type ResponseListener = (response: {
  notification: { request: { content: { data: unknown } } };
}) => void;

const mockListeners: ResponseListener[] = [];

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
    easConfig: null,
  },
}));

jest.mock('../client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(),
  },
}));

jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: (listener: ResponseListener) => {
    mockListeners.push(listener);
    return {
      remove: () => {
        const i = mockListeners.indexOf(listener);
        if (i >= 0) mockListeners.splice(i, 1);
      },
    };
  },
  getLastNotificationResponseAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: false })),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: 'ExponentPushToken[x]' })),
  setNotificationChannelAsync: jest.fn(async () => null),
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3 },
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PRIVATE: 2 },
}));

import {
  DOSE_ACTIVITY_CHANNEL_ID,
  getProjectId,
  parseDoseNotification,
  setDoseNotificationNavigator,
  startDoseNotificationRouting,
} from '../notifications';

const emit = (data: unknown) => {
  for (const listener of [...mockListeners]) {
    listener({ notification: { request: { content: { data } } } });
  }
};

afterEach(() => {
  setDoseNotificationNavigator(null);
  mockListeners.length = 0;
});

describe('parseDoseNotification', () => {
  it('reads the canonical camelCase key', () => {
    expect(parseDoseNotification({ doseId: 'abc' })).toEqual({ doseId: 'abc' });
  });

  it('also accepts the snake_case key the server may send', () => {
    expect(parseDoseNotification({ dose_id: 'abc' })).toEqual({ doseId: 'abc' });
  });

  it('ignores a local reminder payload (lib/reminders.ts has no dose id)', () => {
    expect(parseDoseNotification({})).toBeNull();
    expect(parseDoseNotification({ childId: 'c1', medicationId: 'm1' })).toBeNull();
  });

  it('ignores missing, empty, and non-string ids', () => {
    expect(parseDoseNotification(null)).toBeNull();
    expect(parseDoseNotification(undefined)).toBeNull();
    expect(parseDoseNotification('doseId')).toBeNull();
    expect(parseDoseNotification({ doseId: '' })).toBeNull();
    expect(parseDoseNotification({ doseId: 42 })).toBeNull();
  });
});

describe('notification tap routing', () => {
  it('routes a tap to the registered navigator', () => {
    const navigate = jest.fn();
    const stop = startDoseNotificationRouting();
    setDoseNotificationNavigator(navigate);

    emit({ doseId: 'dose-1' });

    expect(navigate).toHaveBeenCalledWith('dose-1');
    stop();
  });

  it('buffers a cold-launch tap until navigation mounts, then flushes once', () => {
    const navigate = jest.fn();
    const stop = startDoseNotificationRouting();

    // Tap arrives before NavigationContainer exists.
    emit({ doseId: 'dose-cold' });
    expect(navigate).not.toHaveBeenCalled();

    setDoseNotificationNavigator(navigate);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('dose-cold');

    // Re-registering must not replay a target that was already delivered.
    setDoseNotificationNavigator(navigate);
    expect(navigate).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not route notifications without a dose id', () => {
    const navigate = jest.fn();
    const stop = startDoseNotificationRouting();
    setDoseNotificationNavigator(navigate);

    emit({ title: 'Next dose window is open' });

    expect(navigate).not.toHaveBeenCalled();
    stop();
  });

  it('survives a navigator that throws', () => {
    const navigate = jest.fn(() => {
      throw new Error('navigation not ready');
    });
    const stop = startDoseNotificationRouting();
    setDoseNotificationNavigator(navigate);

    expect(() => emit({ doseId: 'dose-2' })).not.toThrow();
    stop();
  });

  it('stops routing once disposed', () => {
    const navigate = jest.fn();
    const stop = startDoseNotificationRouting();
    setDoseNotificationNavigator(navigate);
    stop();

    emit({ doseId: 'dose-3' });

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('config', () => {
  it('reads the EAS project id from the runtime config, not a constant', () => {
    expect(getProjectId()).toBe('test-project-id');
  });

  it('pins the Android channel id the Edge Function has to send', () => {
    expect(DOSE_ACTIVITY_CHANNEL_ID).toBe('dose-activity');
  });
});
