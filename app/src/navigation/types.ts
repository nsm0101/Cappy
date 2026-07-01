export type RootStackParamList = { Auth: undefined; App: undefined };

export type AuthStackParamList = { SignIn: undefined };

export type AppStackParamList = {
  Tabs: undefined;
  DoseSheet: { resolved: import('@/api').ResolvedTag };
  CreateFamily: undefined;
  AcceptInvite: undefined;
  AddChild: { familyId: string };
  ChildDetail: { childId: string };
  Scan: { initialTagUid?: string };
};

export type TabParamList = {
  Home: undefined;
  ScanTab: undefined;
  Timeline: undefined;
  Settings: undefined;
};
