import { applyThemeMode } from '../src/theme';

// Must be the first import of the preview entry: `?theme=dark` renders the scene in the dark theme (plan-devam B10),
// light otherwise - the same "before any screen builds its styles" rule as src/themeBoot.ts in the app. The choice is
// also saved as the app's preference, so themeBoot (pulled in by ThemeProvider) resolves the same mode.
const mode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';
try { localStorage.setItem('blinkr.theme.preference.v1', mode); } catch { /* storage blocked: the explicit apply below still holds for styles */ }
applyThemeMode(mode);
