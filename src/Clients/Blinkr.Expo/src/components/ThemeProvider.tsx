import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Appearance, NativeModules } from 'react-native';

import { getThemeMode, resolveThemeMode, semanticColors, type SemanticPalette, type ThemeMode, type ThemePreference } from '../theme';
import { bootPreference, THEME_PREFERENCE_KEY } from '../themeBoot';

type ThemeContextValue = {
  preference: ThemePreference;
  mode: ThemeMode;
  palette: SemanticPalette;
  /** Saves the choice and reloads the app so every surface (the map included) repaints in the new theme. */
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Screens build their styles once at load, so a theme change is applied by reloading the JS bundle (about a second,
 * no data lost: the session is in secure storage). `Updates.reloadAsync` works in release builds and Expo Go; in a
 * development build it is not allowed, so the dev-settings module reloads there.
 */
export const reloadApp = async () => {
  try {
    await Updates.reloadAsync();
  } catch {
    // Development build: expo-updates refuses to reload there, the dev menu module does not.
    (NativeModules.DevSettings as { reload?: () => void } | undefined)?.reload?.();
  }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(bootPreference);
  const preferenceRef = useRef(preference);
  preferenceRef.current = preference;
  const mode = getThemeMode();

  // Following the system: when the device switches between light and dark, repaint to match.
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (preferenceRef.current !== 'system') return;
      const next = resolveThemeMode('system', colorScheme === 'dark' || colorScheme === 'light' ? colorScheme : null);
      if (next !== getThemeMode()) void reloadApp();
    });
    return () => subscription.remove();
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    const systemScheme = Appearance.getColorScheme();
    const nextMode = resolveThemeMode(next, systemScheme === 'dark' || systemScheme === 'light' ? systemScheme : null);
    SecureStore.setItemAsync(THEME_PREFERENCE_KEY, next)
      .catch(() => { /* not saved: applies to this session only */ })
      .finally(() => { if (nextMode !== getThemeMode()) void reloadApp(); });
  };

  const value = useMemo<ThemeContextValue>(() => ({ preference, mode, palette: semanticColors[mode], setPreference }), [preference, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be called inside <ThemeProvider>.');
  return context;
}
