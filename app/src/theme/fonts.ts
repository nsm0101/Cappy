import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { NunitoSans_600SemiBold, NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { Baloo2_600SemiBold, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';

/**
 * Cappy uses four font families:
 *   - Nunito Sans (display, numerals)
 *   - Inter (UI body)
 *   - DM Mono (units)
 *   - Baloo 2 (playful "Cappy!" wordmark only)
 *
 * Single source of truth for the family-name → font-asset mapping. App.tsx
 * passes this straight into `useFonts()`; the keys here MUST match the
 * `fonts.*` string values in `theme/tokens.ts` exactly, or a screen will
 * silently fall back to the system font with no error. Keeping the map
 * here (instead of duplicated inline in both files) means there's exactly
 * one place to update when a weight is added or renamed.
 */
export const CAPPY_FONT_MAP = {
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
} as const;
