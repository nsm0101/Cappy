/**
 * Cappy Design Tokens
 *
 * Direct translation of the cappy.css design system into TypeScript.
 * The source of truth lives in /handoff/cappy-web/cappy.css. When that
 * file changes, mirror the change here.
 *
 * Tokens are organized as:
 *   - palette: raw color ramps (teal-500, blue-500, etc.)
 *   - semantic: meaning-bearing tokens (bg, fg, brand, focus)
 *   - dose: the dose-safety status system (due/early/recent/overdue)
 *   - typography: font families and scale
 *   - spacing, radii, motion: layout primitives
 *
 * Light and dark variants live side by side. The ThemeProvider picks one.
 */

// ─────────────────────────────────────────────────────────────────────────
// PALETTE — raw color ramps. Same in light and dark.
// ─────────────────────────────────────────────────────────────────────────

export const palette = {
  teal: {
    50: '#E8F6F2',
    100: '#C9EBE1',
    200: '#9FDDCC',
    300: '#6FCBB4',
    400: '#3FB89C',
    500: '#18A78D',
    600: '#128873',
    700: '#0E6D5C',
    800: '#0B5346',
    900: '#083E34',
    950: '#052822',
  },
  blue: {
    50: '#EAF2FB',
    100: '#CFE2F6',
    200: '#A6C9EE',
    300: '#6FA8E0',
    400: '#3E86D2',
    500: '#1E6FC4',
    600: '#155AA6',
    700: '#114887',
    800: '#0E3A6E',
    900: '#0B2D55',
  },
  tan: { 100: '#F2E7D6', 300: '#DCC39B', 500: '#C29A66', 700: '#8F6E43' },
  mint: { 50: '#F1F9F6', 100: '#E8F5F1', 200: '#D6EFE8', 300: '#BFE4D8', 400: '#9ED3C2' },
  sage: { 100: '#DDF1E6', 300: '#8DD2AE', 500: '#4FB088', 600: '#2E9E6E', 700: '#237A56' },
  amber: { 100: '#FCEBD2', 300: '#F2C173', 500: '#E89B2D', 600: '#D97A0E', 700: '#B05E08' },
  coral: { 100: '#FBE3E1', 300: '#F2A8A2', 500: '#E36B62', 600: '#D84A4A', 700: '#B43838' },
  slate: {
    0: '#FFFFFF',
    25: '#FBFAF7',
    50: '#F7F5F0',
    100: '#EFEBE2',
    200: '#DDD8CC',
    300: '#BDB8AC',
    400: '#8F8B82',
    500: '#6A6760',
    600: '#4A4844',
    700: '#322F2C',
    800: '#1F1D1B',
    900: '#131211',
  },
  cream: '#FBF8F2',
  cream2: '#F4EFE5',
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SPACING / RADII / MOTION — same for both themes
// ─────────────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4, // --space-1
  sm: 8, // --space-2
  md: 12, // --space-3
  base: 16, // --space-4
  lg: 20, // --space-5
  xl: 24, // --space-6
  xxl: 32, // --space-8
  xxxl: 40, // --space-10
  huge: 48, // --space-12
  giant: 64, // --space-16
  // Screen-edge gutter (matches --screen-gutter)
  gutter: 20,
  // Min touch target (matches --tap-min)
  tapMin: 44,
  // Tab bar height (matches --tabbar-h)
  tabBar: 84,
} as const;

export const radii = {
  xs: 4, // --radius-1
  sm: 8, // --radius-2
  md: 12, // --radius-3
  base: 16, // --radius-4
  lg: 24, // --radius-5
  pill: 999, // --radius-pill
  sheet: 28, // --sheet-radius
} as const;

export const motion = {
  fast: 200, // --motion-fast
  base: 320, // --motion-base
  slow: 480, // --motion-slow
} as const;

// ─────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────

/**
 * NOTE: React Native uses string font family names that match the loaded
 * font file. We load Inter, NunitoSans, DM Mono, and Baloo 2 via
 * expo-font at app startup. The string here is what RN expects after
 * the font is loaded.
 */
export const fonts = {
  display: 'NunitoSans-Bold', // headings / numerals
  displaySemibold: 'NunitoSans-SemiBold',
  sans: 'Inter-Regular', // UI body
  sansMedium: 'Inter-Medium',
  sansSemibold: 'Inter-SemiBold',
  sansBold: 'Inter-Bold',
  mono: 'DMMono-Regular', // units (mL, mg, °F)
  monoMedium: 'DMMono-Medium',
  brand: 'Baloo2-SemiBold', // "Cappy!" wordmark only
  brandBold: 'Baloo2-Bold',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  smPlus: 15,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 32,
  displayLg: 40,
  doseNumeral: 48,
} as const;

export const lineHeight = {
  xs: 16,
  sm: 20,
  base: 22,
  lg: 26,
  xl: 28,
  xxl: 32,
  display: 36,
  doseNumeral: 48,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SEMANTIC TOKENS — light and dark
// ─────────────────────────────────────────────────────────────────────────

export type SemanticTokens = {
  // Backgrounds
  bg: string;
  bgMuted: string;
  bgCard: string;
  bgInset: string;
  bgTint: string;
  bgTint2: string;
  // Foreground / text
  fg: string;
  fg1: string;
  fg2: string;
  fg3: string;
  fgMuted: string;
  fgOnBrand: string;
  // Lines
  border: string;
  borderStrong: string;
  hairline: string;
  // Brand & accents
  brand: string;
  brandHover: string;
  brandPress: string;
  brandTint: string;
  link: string;
  // Capybara-blue accent (used for "log dose" CTA)
  accent2: string;
  accent2Hover: string;
  accent2Press: string;
  accent2Tint: string;
  accent2Fg: string;
  // Status
  success: string;
  warn: string;
  error: string;
  // Focus
  focus: string;
  focusHalo: string;
  // Dose-safety palette
  doseDueSolid: string;
  doseDueFg: string;
  doseDueBg: string;
  doseDueRing: string;
  doseEarlySolid: string;
  doseEarlyFg: string;
  doseEarlyBg: string;
  doseEarlyRing: string;
  doseRecentSolid: string;
  doseRecentFg: string;
  doseRecentBg: string;
  doseRecentRing: string;
  doseOverdueSolid: string;
  doseOverdueFg: string;
  doseOverdueBg: string;
  doseOverdueRing: string;
  // NFC
  nfcCore: string;
  nfcGlow: string;
  nfcRing: string;
  // Scrim / sheet
  scrim: string;
  sheetGrabber: string;
  // Shadow color (RN uses shadowColor + opacity)
  shadow: string;
};

export const lightTokens: SemanticTokens = {
  bg: palette.cream,
  bgMuted: palette.cream2,
  bgCard: palette.slate[0],
  bgInset: palette.slate[50],
  bgTint: palette.mint[100],
  bgTint2: palette.mint[200],
  fg: palette.slate[800],
  fg1: palette.slate[800],
  fg2: palette.slate[600],
  fg3: palette.slate[500],
  fgMuted: palette.slate[400],
  fgOnBrand: '#FFFFFF',
  border: 'rgba(11,30,29,0.08)',
  borderStrong: 'rgba(11,30,29,0.14)',
  hairline: 'rgba(11,30,29,0.06)',
  brand: palette.teal[500],
  brandHover: palette.teal[600],
  brandPress: palette.teal[700],
  brandTint: palette.teal[50],
  link: palette.teal[600],
  accent2: palette.blue[500],
  accent2Hover: palette.blue[600],
  accent2Press: palette.blue[700],
  accent2Tint: palette.blue[50],
  accent2Fg: '#FFFFFF',
  success: palette.sage[600],
  warn: palette.amber[600],
  error: palette.coral[600],
  focus: palette.teal[500],
  focusHalo: 'rgba(24,167,141,0.22)',
  // Dose status
  doseDueSolid: palette.teal[500],
  doseDueFg: palette.teal[800],
  doseDueBg: palette.teal[50],
  doseDueRing: 'rgba(24,167,141,0.30)',
  doseEarlySolid: palette.amber[600],
  doseEarlyFg: palette.amber[700],
  doseEarlyBg: palette.amber[100],
  doseEarlyRing: 'rgba(217,122,14,0.28)',
  doseRecentSolid: palette.blue[500],
  doseRecentFg: palette.blue[700],
  doseRecentBg: palette.blue[50],
  doseRecentRing: 'rgba(30,111,196,0.26)',
  doseOverdueSolid: palette.coral[600],
  doseOverdueFg: palette.coral[700],
  doseOverdueBg: palette.coral[100],
  doseOverdueRing: 'rgba(216,74,74,0.28)',
  // NFC
  nfcCore: palette.blue[500],
  nfcGlow: 'rgba(30,111,196,0.22)',
  nfcRing: 'rgba(30,111,196,0.40)',
  scrim: 'rgba(8,26,24,0.42)',
  sheetGrabber: 'rgba(11,30,29,0.18)',
  shadow: '#0B1E1D',
};

export const darkTokens: SemanticTokens = {
  bg: '#0B1717',
  bgMuted: '#0F1C1B',
  bgCard: '#13201F',
  bgInset: '#1A2A29',
  bgTint: '#14302C',
  bgTint2: '#1B3F39',
  fg: '#ECECE6',
  fg1: '#ECECE6',
  fg2: '#B5B7B0',
  fg3: '#8A8C85',
  fgMuted: '#5E605A',
  fgOnBrand: '#FFFFFF',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  hairline: 'rgba(255,255,255,0.05)',
  brand: palette.teal[400],
  brandHover: palette.teal[300],
  brandPress: palette.teal[200],
  brandTint: 'rgba(54,169,154,0.16)',
  link: palette.teal[300],
  accent2: '#4D93DD',
  accent2Hover: '#6FA8E0',
  accent2Press: palette.blue[200],
  accent2Tint: 'rgba(77,147,221,0.16)',
  accent2Fg: '#06121F',
  success: palette.sage[500],
  warn: palette.amber[500],
  error: palette.coral[500],
  focus: palette.teal[300],
  focusHalo: 'rgba(111,195,179,0.25)',
  doseDueSolid: palette.teal[400],
  doseDueFg: '#8FE6CF',
  doseDueBg: 'rgba(24,167,141,0.16)',
  doseDueRing: 'rgba(63,184,156,0.34)',
  doseEarlySolid: palette.amber[500],
  doseEarlyFg: '#F4C173',
  doseEarlyBg: 'rgba(217,122,14,0.18)',
  doseEarlyRing: 'rgba(232,155,45,0.30)',
  doseRecentSolid: '#4D93DD',
  doseRecentFg: palette.blue[200],
  doseRecentBg: 'rgba(77,147,221,0.16)',
  doseRecentRing: 'rgba(77,147,221,0.32)',
  doseOverdueSolid: palette.coral[500],
  doseOverdueFg: palette.coral[300],
  doseOverdueBg: 'rgba(216,74,74,0.18)',
  doseOverdueRing: 'rgba(227,107,98,0.32)',
  nfcCore: '#4D93DD',
  nfcGlow: 'rgba(77,147,221,0.26)',
  nfcRing: 'rgba(77,147,221,0.46)',
  scrim: 'rgba(0,0,0,0.58)',
  sheetGrabber: 'rgba(255,255,255,0.22)',
  shadow: '#000000',
};

// Shadow presets (RN-specific shape; iOS uses these directly, Android uses elevation)
export const shadows = (color: string) => ({
  shadow1: {
    shadowColor: color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  shadow2: {
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  shadow3: {
    shadowColor: color,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
});

// Convenience type for the full theme passed through context
export type Theme = {
  mode: 'light' | 'dark';
  tokens: SemanticTokens;
  palette: typeof palette;
  spacing: typeof spacing;
  radii: typeof radii;
  motion: typeof motion;
  fonts: typeof fonts;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  shadows: ReturnType<typeof shadows>;
};
