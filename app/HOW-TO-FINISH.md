# How to Finish — Cappy ClaudeBuildPlan

These are the concrete remaining tasks to take the bundle from
"foundation" to "runnable app you can demo to one design partner."

Hand each ticket to Claude Code (or any coding agent) one at a time.
Each is sized at roughly 1-3 hours of agent work.

---

## TICKET-NAV — Build navigation layer

**Files to create:**
- `src/navigation/types.ts`
- `src/navigation/linking.ts`
- `src/navigation/RootNavigator.tsx`
- `src/navigation/AuthNavigator.tsx`
- `src/navigation/AppNavigator.tsx`

**Spec:**

`types.ts` defines:
```typescript
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
```

`linking.ts` defines:
```typescript
import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { parseTagUrl } from '@/nfc';

const TAG_URL_HOST =
  process.env.EXPO_PUBLIC_TAG_URL_HOST ?? 'cappy.closedose.com';

export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),
    `https://${TAG_URL_HOST}`,
    'cappy://',
  ],
  config: {
    screens: {
      App: {
        screens: {
          Scan: 't/:tagUid',
        },
      },
    },
  },
};
```

`RootNavigator.tsx` switches based on `useAuth().isSignedIn`. When
signed in → `AppNavigator`. When not → `AuthNavigator`. Wrap with
`<NavigationContainer linking={linkingConfig}>`.

`AuthNavigator.tsx` is a single `Stack.Screen` for `SignInScreen`.

`AppNavigator.tsx` is a stack containing:
- `Tabs` as a bottom-tab navigator using the custom `TabBar` component
  (Home, Scan, Timeline, Settings)
- Modal-presentation screens for DoseSheet, CreateFamily, AcceptInvite,
  AddChild, ChildDetail

---

## TICKET-APP — Create App.tsx and index.js entry

**Files to create:**
- `App.tsx` at project root
- `index.js` at project root

**Spec for App.tsx:**
```tsx
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useCallback, useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts as useInter,
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  NunitoSans_600SemiBold, NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { Baloo2_600SemiBold, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import { ThemeProvider } from '@/theme';
import { AuthProvider } from '@/auth/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [fontsLoaded] = useInter({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'NunitoSans-SemiBold': NunitoSans_600SemiBold,
    'NunitoSans-Bold': NunitoSans_700Bold,
    'DMMono-Regular': DMMono_400Regular,
    'DMMono-Medium': DMMono_500Medium,
    'Baloo2-SemiBold': Baloo2_600SemiBold,
    'Baloo2-Bold': Baloo2_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <StatusBar style="auto" />
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

**Spec for index.js:**
```javascript
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
```

---

## TICKET-SCREENS — Build remaining screens

Build these in this order:

1. **SettingsScreen** — Stack of `RowItem`s. Each row navigates or
   acts: theme (opens an action sheet with light/dark/system), account
   (display email), sign out, privacy policy (opens browser to
   `https://cappy.closedose.com/privacy`), terms, app version (read
   from `Constants.expoConfig.version`).

2. **CreateFamilyScreen** — A single `Field` for "Family name" and a
   `Button`. On submit: `await families.createFamily(name)` then
   `navigation.goBack()`.

3. **AcceptInviteScreen** — Six single-digit `TextInput`s in a row
   (or one `Field` with `maxLength={6}` and `keyboardType="number-pad"`).
   On submit of 6 digits: `await families.acceptInvite(code)`,
   show a success state, navigate to Home.

4. **AddChildScreen** — `Field` for display name, a date picker (use
   `@react-native-community/datetimepicker` — add to package.json),
   optional `Field` for weight in lb. On submit:
   `await children.createChild(...)` and optionally
   `await children.recordWeight(...)`.

5. **ChildDetailScreen** — Header with avatar/name/weight, a chronological
   list of dose events (call `doses.listDosesForChild`), each row
   showing time + amount + who logged it.

6. **TimelineScreen** — Cross-child timeline for the active family.
   Same shape as ChildDetailScreen list, but rolling up multiple
   children.

For each screen, the Definition of Done is:
- TypeScript clean
- Uses the design-system components (no raw `<View style={{...}}>` for
  things that have a component)
- All five UI states covered: default, loading, empty, error, success
- VoiceOver labels on every interactive element

---

## TICKET-UL — Universal Links setup

**Files to create:**
- `public/.well-known/apple-app-site-association` (no `.json` extension)

**Content:**
```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.com.closedose.cappy"],
        "components": [
          { "/": "/t/*", "comment": "NFC tag deep links" }
        ]
      }
    ]
  }
}
```

Replace `TEAMID` with your Apple Developer team ID once you've
enrolled.

**Hosting:**
1. Cloudflare DNS for `cappy.closedose.com` pointing somewhere
2. Either:
   - Cloudflare Pages serving this `public/` folder, OR
   - A redirect on the existing `closedose.com` site that serves
     the AASA file from `/.well-known/apple-app-site-association`
3. Validate using https://branch.io/resources/aasa-validator/

**Verification on device:**
After installing a build with the associated domain, open Safari and
navigate to `https://cappy.closedose.com/t/test123`. iOS should
prompt to open Cappy. If it opens Safari instead, the AASA isn't
being served correctly.

---

## TICKET-COLD-LAUNCH — Wire cold-launch from NFC tap

In `App.tsx` (or a hook called from it), add:

```typescript
import * as Linking from 'expo-linking';

useEffect(() => {
  let mounted = true;
  Linking.getInitialURL().then((url) => {
    if (url && mounted) {
      // The linking config will handle routing automatically,
      // but we can pre-warm the resolve cache here if needed.
    }
  });
  const sub = Linking.addEventListener('url', (event) => {
    // Tag tapped while app already running — handled by linking too.
  });
  return () => {
    mounted = false;
    sub.remove();
  };
}, []);
```

The linking config in `TICKET-NAV` already routes
`/t/:tagUid` → `Scan` screen with `tagUid` as a route param. The
`ScanScreen` reads `route.params.initialTagUid` and auto-triggers
resolution.

---

## TICKET-LEGAL — Draft consumer-app legal documents

Write these in `docs/legal/`:

1. **`privacy-policy.md`** — Consumer-app version, not HIPAA NPP.
   Covers: what we collect (email, family name, child first names,
   doses, optional weight), what we don't (location, contacts,
   biometrics), who sees it (caregivers you invite, our vendors with
   contracts), retention (until you delete), your rights (export,
   delete, correct), COPPA notice (children's data is provided by the
   parent, not collected from the child), security (TLS,
   field-level encryption, RLS), breach notification (FTC rule),
   contact (privacy@closedose.com).

2. **`terms-of-service.md`** — Standard consumer terms. Plus the
   non-medical-advice disclaimer in bold somewhere prominent: "Cappy
   is a coordination tool. It is not medical advice. Always follow
   the medication label and consult your child's pediatrician."

3. **`caregiver-consent.md`** — The text shown in-app on first
   launch. One page, plain language. The user taps "I agree" and we
   record the timestamp + version on their `profiles.consent_accepted_at`
   and `profiles.consent_version`.

Every document carries the banner:
> **DRAFT — must be reviewed by counsel before publication.**

After counsel review, the founder removes the banner.

---

## TICKET-DOCS — Project documentation

Create:

- `README.md` at project root — quick start instructions:
  ```
  pnpm install
  cp .env.example .env  # then fill in
  pnpm supabase:start   # local Supabase
  pnpm supabase:push    # apply migrations
  pnpm start            # Expo dev server
  ```

- `docs/posture.md` — codifies Posture C. References this conversation:
  not HIPAA-covered, consumer health app, secure architecture +
  consumer privacy policy, upgrade path to Posture A when needed.

- `docs/audit-evolution.md` — the 6 signals (from prior conversation
  in this build) for when to migrate from triggers to explicit audit
  calls.

- `docs/migration-to-real-backend.md` — when and how to leave
  Supabase. Roughly: stand up Fastify + Postgres, move RLS logic to
  application authz, swap each `src/api/*.ts` implementation, retire
  Edge Functions.

---

## TICKET-FONTS — Wire Google Fonts

In `src/theme/fonts.ts`, replace the stub with the real `useFonts`
hook from `@expo-google-fonts/*` packages. Already done in `App.tsx`
in `TICKET-APP`; if you do that ticket, this one is automatic.

---

## TICKET-CI — GitHub Actions CI

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
```

Optional: `eas-preview.yml` for PR preview builds via EAS Update.

---

## TICKET-REALTIME — Wire realtime to HomeScreen

**Done.** In `HomeScreen.tsx`, a `useEffect` that:
1. Once `activeFamily` is loaded
2. Calls `realtime.subscribeFamilyDoses(familyId, onDose)` — filtered on
   `family_id` (covers caregiver self-doses too, not just children; see
   src/api/realtime.ts for why a child-id-list filter was replaced)
3. On any new dose event for the family, refetches and updates state
4. Cleans up on unmount or when family changes

Also wired the same way in `ScheduleScreen.tsx` and `TimelineScreen.tsx`.

---

## TICKET-OPTIMIZE — Image optimization

Run `cappy-mark.png` (1.2 MB) and `cappy-icon.png` (280 KB) through:
```bash
brew install pngquant
pngquant --quality=70-90 --strip src/assets/cappy-mark.png
pngquant --quality=70-90 --strip src/assets/cappy-icon.png
```
Target: mark <200 KB, icon <100 KB.

---

## TICKET-TESTS — Smoke tests

Add Jest setup and one test per critical helper:

- `src/nfc/__tests__/parseTagUrl.test.ts` — happy path, invalid URL,
  wrong host, malformed UID
- `src/lib/__tests__/format.test.ts` — formatDoseAmount for all
  formulation variants, formatRelativeTime edges
- `src/lib/__tests__/uuid.test.ts` — produces valid UUIDv4

Run with `pnpm test`. CI should fail on any failing test.

---

## After all tickets: minimum viable test

1. Create a Supabase project, copy URL + anon key into `.env`
2. `pnpm supabase:push` to apply migrations to the cloud project
3. `pnpm supabase:functions:deploy nfc-resolve accept-invite`
4. `eas build --profile development --platform ios` to build a dev
   client for your device
5. Install on a real iPhone (NFC won't work in the simulator)
6. Sign up with your email, create a family, add a child
7. Buy 10 NTAG215 stickers, program one with the URL
   `https://cappy.closedose.com/t/ibu-child` using NFC Tools app
8. Open the app, go to Settings, find a hidden "Register tag" dev
   action (or use the Supabase dashboard to insert directly into
   `nfc_tags`)
9. Tap the tag — the app should resolve it and open the dose sheet
10. Log a dose — verify it appears in `dose_events` and in
    `audit_events`

If all 10 steps work end-to-end, you have a functioning beta of the
core interaction.
