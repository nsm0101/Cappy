// Cappy app root.
// URL polyfill must be imported before anything that constructs URLs.
// (UUID generation uses a JS fallback in src/lib/uuid.ts — no native
// crypto polyfill required for the alpha.)
import 'react-native-url-polyfill/auto';

import React, { useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from '@expo-google-fonts/inter';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { Baloo2_600SemiBold, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';

import { ThemeProvider } from '@/theme';
import { AuthProvider } from '@/auth/AuthContext';
import { ActiveFamilyProvider } from '@/family/ActiveFamilyContext';
import { RootNavigator } from '@/navigation';
import { useTagLinkObserver } from '@/navigation/useTagLinkObserver';
import * as Notifications from 'expo-notifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// FLOW-2: present "next dose is safe" local reminders even when the app is
// foregrounded. Reminders are nudges only — the dose sheet re-checks safety.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  // COLD-1: observe NFC tag cold-launch / warm links. Routing itself is
  // handled by NavigationContainer's linking config — this is a safe,
  // non-navigating diagnostic + extension point.
  useTagLinkObserver();

  // Font family names here must match the strings in theme/tokens.ts.
  const [fontsLoaded] = useFonts({
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
            <ActiveFamilyProvider>
              <StatusBar style="auto" />
              <RootNavigator />
            </ActiveFamilyProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
