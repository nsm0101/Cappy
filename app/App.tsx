// Cappy app root.
// URL polyfill must be imported before anything that constructs URLs.
// (UUID generation uses a JS fallback in src/lib/uuid.ts — no native
// crypto polyfill required for the alpha.)
import 'react-native-url-polyfill/auto';

import { useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from '@expo-google-fonts/inter';

import { ThemeProvider, CAPPY_FONT_MAP } from '@/theme';
import { AuthProvider } from '@/auth/AuthContext';
import { CaregiverProfileProvider } from '@/auth/CaregiverProfileContext';
import { ActiveFamilyProvider } from '@/family/ActiveFamilyContext';
import { RootNavigator } from '@/navigation';
import { useTagLinkObserver } from '@/navigation/useTagLinkObserver';
import * as Notifications from 'expo-notifications';
import { initMonitoring } from '@/lib/monitoring';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// M3: Sentry crash reporting — no-op until the package + DSN exist.
initMonitoring();

// FLOW-2: present "next dose is safe" local reminders even when the app is
// foregrounded. Reminders are nudges only — the dose sheet re-checks safety.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // SDK 57: banner/list replace the deprecated shouldShowAlert.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  // COLD-1: observe NFC tag cold-launch / warm links. Routing itself is
  // handled by NavigationContainer's linking config — this is a safe,
  // non-navigating diagnostic + extension point.
  useTagLinkObserver();

  // CAPPY_FONT_MAP (theme/fonts.ts) is the single source of truth for these
  // family names — they must match the `fonts.*` strings in theme/tokens.ts.
  const [fontsLoaded] = useFonts(CAPPY_FONT_MAP);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <CaregiverProfileProvider>
              <ActiveFamilyProvider>
                <StatusBar style="auto" />
                <RootNavigator />
              </ActiveFamilyProvider>
            </CaregiverProfileProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
