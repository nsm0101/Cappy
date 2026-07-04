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
};

export type TabParamList = {
  Home: undefined;
  ScanTab: undefined;
  Timeline: undefined;
  Schedule: undefined;
  Settings: undefined;
};
