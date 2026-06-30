import * as Font from 'expo-font';

/**
 * Cappy uses four font families:
 *   - Nunito Sans (display, numerals)
 *   - Inter (UI body)
 *   - DM Mono (units)
 *   - Baloo 2 (playful "Cappy!" wordmark only)
 *
 * Strategy: load via Google Fonts URLs at runtime in dev (fast iteration),
 * bundle the .ttf files in production. For now we use the @expo-google-fonts
 * packages, which is the simplest path on Expo SDK 51.
 *
 * To install:
 *   pnpm add @expo-google-fonts/inter @expo-google-fonts/nunito-sans \
 *           @expo-google-fonts/dm-mono @expo-google-fonts/baloo-2
 *
 * Then this file imports the weights directly. For now, this returns a
 * promise that resolves immediately; the actual font loading is wired up
 * in App.tsx when fonts are installed.
 */
export const loadCappyFonts = async (): Promise<void> => {
  // When the @expo-google-fonts/* packages are installed, replace with:
  //
  // const [loaded] = useFonts({
  //   'Inter-Regular': require('@expo-google-fonts/inter/Inter_400Regular.ttf'),
  //   'Inter-Medium': require('@expo-google-fonts/inter/Inter_500Medium.ttf'),
  //   'Inter-SemiBold': require('@expo-google-fonts/inter/Inter_600SemiBold.ttf'),
  //   'Inter-Bold': require('@expo-google-fonts/inter/Inter_700Bold.ttf'),
  //   'NunitoSans-SemiBold': require('@expo-google-fonts/nunito-sans/NunitoSans_600SemiBold.ttf'),
  //   'NunitoSans-Bold': require('@expo-google-fonts/nunito-sans/NunitoSans_700Bold.ttf'),
  //   'DMMono-Regular': require('@expo-google-fonts/dm-mono/DMMono_400Regular.ttf'),
  //   'DMMono-Medium': require('@expo-google-fonts/dm-mono/DMMono_500Medium.ttf'),
  //   'Baloo2-SemiBold': require('@expo-google-fonts/baloo-2/Baloo2_600SemiBold.ttf'),
  //   'Baloo2-Bold': require('@expo-google-fonts/baloo-2/Baloo2_700Bold.ttf'),
  // });
  //
  // For now the app falls back to the system font. The design still works,
  // just less brand-perfect. Install the fonts as a Day-1 polish task.

  await Font.loadAsync({});
};
