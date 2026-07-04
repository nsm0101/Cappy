export type RootStackParamList = { Auth: undefined; Setup: undefined; App: undefined };

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
