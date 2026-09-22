import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { resolveThemeMode, semanticColors, type SemanticPalette, type ThemeMode, type ThemePreference } from '../theme';

const PREFERENCE_KEY = 'blinkr.theme.preference.v1';
const isPreference = (value: unknown): value is ThemePreference => value === 'system' || value === 'dark' || value === 'light';

type ThemeContextValue = {
  preference: ThemePreference;
  mode: ThemeMode;
  palette: SemanticPalette;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Infrastructure for P1.2 (sinyal-mvp-plan Faz 1): tracks the appearance preference (system/dark/light),
 * persists it, and resolves the effective mode. Wrapping the app in this changes nothing visually by
 * itself - no screen reads `useTheme()` yet, so everything keeps using the existing flat dark tokens
 * from `theme.ts` until it is migrated. That migration, and the "Görünüm" setting that lets someone
 * change `preference`, come with the screens that actually consume `palette`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(PREFERENCE_KEY)
      .then((stored) => { if (!cancelled && isPreference(stored)) setPreferenceState(stored); })
      .catch(() => { /* default preference ("system") stands */ });
    return () => { cancelled = true; };
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    SecureStore.setItemAsync(PREFERENCE_KEY, next).catch(() => { /* preference still applies this session */ });
  };

  const mode = resolveThemeMode(preference, systemScheme as ThemeMode | null | undefined);
  const value = useMemo<ThemeContextValue>(() => ({ preference, mode, palette: semanticColors[mode], setPreference }), [preference, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be called inside <ThemeProvider>.');
  return context;
}
