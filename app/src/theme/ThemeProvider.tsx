import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Theme,
  lightTokens,
  darkTokens,
  palette,
  spacing,
  radii,
  motion,
  fonts,
  fontSize,
  lineHeight,
  shadows,
} from './tokens';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = '@cappy/theme-mode';

const buildTheme = (mode: 'light' | 'dark'): Theme => {
  const tokens = mode === 'dark' ? darkTokens : lightTokens;
  return {
    mode,
    tokens,
    palette,
    spacing,
    radii,
    motion,
    fonts,
    fontSize,
    lineHeight,
    shadows: shadows(tokens.shadow),
  };
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Load saved mode preference once
  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
      } catch {
        // Silent — fall back to system
      }
    })();
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  };

  const resolved: 'light' | 'dark' = useMemo(() => {
    if (mode === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
    return mode;
  }, [mode, systemScheme]);

  const theme = useMemo(() => buildTheme(resolved), [resolved]);

  // Apply to the OS navigation bar / status bar background hint
  useEffect(() => {
    // RN 0.86's types narrowed to 'light' | 'dark', but the runtime still
    // treats null as "reset to follow the OS" - cast to keep prior behavior.
    Appearance.setColorScheme?.((mode === 'system' ? null : mode) as 'light' | 'dark');
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode }}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): Theme => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx.theme;
};

export const useThemeMode = (): { mode: ThemeMode; setMode: (m: ThemeMode) => void } => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used inside <ThemeProvider>');
  }
  return { mode: ctx.mode, setMode: ctx.setMode };
};
