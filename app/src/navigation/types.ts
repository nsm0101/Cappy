import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * `App` carries `NavigatorScreenParams` rather than `undefined` so a tapped
 * dose notification can address a screen inside the app stack from the
 * container ref — `navigate('App', { screen: 'DoseDetail', params: … })`.
 */
export type RootStackParamList = {
  Auth: undefined;
  Setup: undefined;
  App: NavigatorScreenParams<AppStackParamList> | undefined;
};

export type AuthStackParamList = { SignIn: undefined };

export type AppStackParamList = {
  Tabs: undefined;
  DoseSheet: { resolved: import('@/api').ResolvedTag };
  CreateFamily: undefined;
  AcceptInvite: { code?: string } | undefined;
  AddChild: { familyId: string };
  ChildDetail: { childId: string };
  FamilyDashboard: undefined;
  Scan: { initialTagUid?: string };
  /** Per-child dose-notification toggles. Reached from Settings. */
  Notifications: undefined;
  /**
   * Read-only view of a single logged dose — the destination when a
   * caregiver taps a dose notification. Deliberately has no Log action:
   * it reports what someone else already recorded.
   */
  DoseDetail: { doseId: string };
  /**
   * "Send to a nearby phone" screen: direct phone-to-phone family invite
   * transfer without a code or physical tag. iPhone 11+ uses a real
   * proximity handshake (hold phones together); everything else falls
   * back to a share-sheet handoff + on-screen QR code. See
   * src/screens/ShareViaTapScreen.tsx.
   */
  ShareViaTap: {
    code: string;
    link: string;
    familyName?: string;
    role: 'caregiver' | 'guest';
  };
};

export type TabParamList = {
  Home: undefined;
  ScanTab: undefined;
  Timeline: undefined;
  Schedule: undefined;
  Settings: undefined;
};
