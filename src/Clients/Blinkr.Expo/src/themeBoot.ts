import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';

import { applyThemeMode, resolveThemeMode, type ThemePreference } from './theme';

/**
 * Runs before any screen module is evaluated (first import in `index.ts`), so every `StyleSheet.create` sees the
 * chosen theme (plan-devam B3, V2 D-024): the saved choice, else dark (Blinkr's default look). "Sistem" in Settings
 * still follows the device. Reads the preference synchronously;
 * where secure storage is unavailable (web preview) the system scheme or light applies.
 */
export const THEME_PREFERENCE_KEY = 'blinkr.theme.preference.v1';

export const isThemePreference = (value: unknown): value is ThemePreference => value === 'system' || value === 'dark' || value === 'light';

export const readThemePreference = (): ThemePreference => {
  try {
    const stored = SecureStore.getItem(THEME_PREFERENCE_KEY);
    return isThemePreference(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
};

export const bootPreference = readThemePreference();
export const bootSystemScheme = Appearance.getColorScheme();
applyThemeMode(resolveThemeMode(bootPreference, bootSystemScheme === 'dark' || bootSystemScheme === 'light' ? bootSystemScheme : null));
