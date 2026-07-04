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
   * "Tap to send" screen: writes a Quick Share invite link to a blank
   * physical NFC tag so another phone (iOS or Android) can tap it to
   * join the family. See src/screens/ShareViaTapScreen.tsx.
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
