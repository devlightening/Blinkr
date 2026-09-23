/**
 * Blinkr design tokens - the single source for colour, spacing, radius, type and motion.
 *
 * plan-devam Faz B (D-006): light theme by default, a sage accent, "soft colour + bold form". Dark theme is fully
 * supported. Token names are unchanged from before the redesign so every screen keeps working; only the values moved.
 *
 * How the theme is applied: screens build their styles once, at module load (`StyleSheet.create`). So the mode is
 * chosen before any screen module loads: `src/themeBoot.ts` (imported first in `index.ts`) reads the saved
 * preference and the system scheme and calls `applyThemeMode`, which fills `colors` and the derived tables below in
 * place. Changing the preference in Settings saves it and reloads the JS bundle (see `ThemeProvider`). This module
 * itself stays pure (no native imports) so node tests can use it; untouched, it is the light theme.
 */

// ---- Raw palette (plan-devam B1) -----------------------------------------------------------------------------
export const palette = {
  // Warm paper (light surfaces)
  paper50: '#FCFBF8', paper100: '#F6F4EE', paper200: '#EDEAE2', paper300: '#E1DDD3',
  // Ink (light-theme text)
  ink900: '#15181B', ink700: '#3A4046', ink500: '#636C74', ink400: '#8C949B',
  // Coal (dark surfaces - never pure black)
  coal900: '#16191D', coal800: '#1E2227', coal700: '#272C32', coal600: '#343A41',
  chalk50: '#F3F1EC', chalk300: '#A6AFB7',
  // Sage (brand accent)
  sage200: '#D6F0E4', sage300: '#A8DCC6', sage400: '#7FCAA9', sage500: '#5DB693',
  sage600: '#3E9A7A', sage700: '#2E7A60', sage800: '#256650', sage900: '#16352B',
  // Sun (create/send only)
  sun400: '#FFD86E', sun500: '#FFC83D', sun600: '#D99F1F',
  // Signal types: tint (fill) + ink (text/icon on light)
  apricot: '#FFA45B', apricotInk: '#A85B15',
  butter: '#F4C95D', butterInk: '#8A620B',
  coral: '#FF7A6B', coralInk: '#C23D2E',
  bubblegum: '#F49AC2', bubblegumInk: '#B2517D',
  grape: '#A78BFA', grapeInk: '#6D4AC9',
  sky: '#6EC1F0', skyInk: '#1D72A1',
  periwinkle: '#8E9BFF', periwinkleInk: '#4A57C9',
  stone: '#9AA7B4', stoneInk: '#5A6672',
  white: '#FFFFFF',
  black: '#000000',
} as const;

const p = palette;

/** Every colour a screen may use. Legacy names (ink, muted, green...) stay, pointing at the new palette. */
export type ColorTokens = {
  background: string; surface: string; surfaceElevated: string; glass: string;
  primary: string; primaryPressed: string; mint: string; darkGreen: string;
  text: string; textSecondary: string; textMuted: string; border: string;
  orange: string; purple: string; pink: string; danger: string;
  /** Sun: the create (+) and send actions only. */
  flare: string; flarePressed: string;
  /** Text/icon on the sun create/send fill (dark in both themes). */
  onCreate: string;
  /** Text/icon on a `primary` fill (white in light, ink in dark). */
  ink: string;
  inkSoft: string; textPrimary: string; muted: string; mutedSoft: string; line: string; lineStrong: string;
  surfaceSoft: string; surfaceTint: string; mapCanvas: string;
  green: string; greenDark: string; greenSoft: string; greenLine: string; lime: string;
  coral: string; coralSoft: string; coralLine: string;
  blue: string; blueSoft: string; teal: string; amber: string; warning: string;
  error: string; errorSoft: string; errorLine: string;
  white: string; scrim: string; shadow: string;
  /** Fixed "on dark" values for chrome drawn over photos/video in either theme. */
  mutedOnDark: string; surfaceOnDark: string; lineOnDark: string;
  /** Pin outline (2 px) so pastel pins stay visible on a light map (B9). */
  pinBorder: string;
  /** The accent as a soft fill behind a selected tab/segment or a round accent button. */
  primaryTint: string;
  /** Soft halo around the sun (+) button. */
  createRing: string;
  /** Unfilled steps of a level meter. */
  meterEmpty: string;
};

const light: ColorTokens = {
  background: p.paper50, surface: p.white, surfaceElevated: p.paper100, glass: 'rgba(252, 251, 248, 0.92)',
  primary: p.sage700, primaryPressed: p.sage800, mint: p.sage700, darkGreen: p.sage700,
  text: p.ink900, textSecondary: p.ink500, textMuted: p.ink400, border: p.paper300,
  orange: p.apricotInk, purple: p.grapeInk, pink: p.bubblegumInk, danger: p.coralInk,
  flare: p.sun500, flarePressed: p.sun600, onCreate: p.ink900,
  ink: p.white,
  inkSoft: p.ink700, textPrimary: p.ink900, muted: p.ink500, mutedSoft: p.ink400, line: p.paper300, lineStrong: 'rgba(21, 24, 27, 0.14)',
  surfaceSoft: p.paper100, surfaceTint: '#EEF7F2', mapCanvas: p.paper100,
  green: p.sage700, greenDark: p.sage700, greenSoft: p.sage200, greenLine: p.sage300, lime: p.sage700,
  coral: p.coralInk, coralSoft: '#FDE7E4', coralLine: '#F6C6BF',
  blue: p.skyInk, blueSoft: '#E4F2FB', teal: '#1E7F76', amber: p.butterInk, warning: p.apricotInk,
  error: p.coralInk, errorSoft: '#FDE7E4', errorLine: '#F6C6BF',
  white: p.white, scrim: 'rgba(21, 24, 27, 0.32)', shadow: p.ink900,
  mutedOnDark: p.chalk300, surfaceOnDark: p.coal700, lineOnDark: 'rgba(255, 255, 255, 0.14)',
  pinBorder: p.ink900,
  primaryTint: 'rgba(46, 122, 96, 0.12)', createRing: 'rgba(255, 200, 61, 0.45)', meterEmpty: 'rgba(21, 24, 27, 0.10)',
};

const dark: ColorTokens = {
  background: p.coal900, surface: p.coal800, surfaceElevated: p.coal700, glass: 'rgba(30, 34, 39, 0.92)',
  primary: p.sage400, primaryPressed: p.sage300, mint: p.sage400, darkGreen: p.sage600,
  text: p.chalk50, textSecondary: p.chalk300, textMuted: '#7C858D', border: p.coal600,
  orange: p.apricot, purple: p.grape, pink: p.bubblegum, danger: p.coral,
  flare: p.sun500, flarePressed: p.sun600, onCreate: p.ink900,
  ink: p.ink900,
  inkSoft: '#C6CFD3', textPrimary: p.chalk50, muted: p.chalk300, mutedSoft: '#7C858D', line: p.coal600, lineStrong: 'rgba(255, 255, 255, 0.14)',
  surfaceSoft: '#1A1E22', surfaceTint: '#1B2A24', mapCanvas: p.coal900,
  green: p.sage600, greenDark: p.sage400, greenSoft: p.sage900, greenLine: '#1E3A30', lime: p.sage400,
  coral: p.coral, coralSoft: '#2A1816', coralLine: '#4A2B26',
  blue: p.sky, blueSoft: '#16293A', teal: '#5CCBC0', amber: p.butter, warning: p.apricot,
  error: p.coral, errorSoft: '#2B1714', errorLine: '#4A2622',
  white: p.white, scrim: 'rgba(10, 12, 14, 0.56)', shadow: p.black,
  mutedOnDark: p.chalk300, surfaceOnDark: p.coal700, lineOnDark: 'rgba(255, 255, 255, 0.14)',
  pinBorder: p.chalk50,
  primaryTint: 'rgba(127, 202, 169, 0.16)', createRing: 'rgba(255, 200, 61, 0.35)', meterEmpty: 'rgba(255, 255, 255, 0.12)',
};

/**
 * Overlays for chrome drawn on top of live camera, photos and video (same in both themes): scrims that keep white
 * text readable over any picture, dark chips for round buttons, soft whites for secondary text and tracks (B11).
 */
export const media = {
  black: p.black,
  scrimTop: 'rgba(0, 0, 0, 0.32)', scrim: 'rgba(0, 0, 0, 0.45)', scrimStrong: 'rgba(0, 0, 0, 0.58)',
  chip: 'rgba(16, 20, 23, 0.62)', chipStrong: 'rgba(16, 20, 23, 0.85)', panel: 'rgba(16, 20, 23, 0.92)',
  textSoft: 'rgba(255, 255, 255, 0.75)', textFaint: 'rgba(255, 255, 255, 0.6)',
  line: 'rgba(255, 255, 255, 0.35)', lineSoft: 'rgba(255, 255, 255, 0.16)', track: 'rgba(255, 255, 255, 0.28)',
  sunSoft: 'rgba(255, 200, 61, 0.22)', textShadow: 'rgba(0, 0, 0, 0.6)',
} as const;

export type ThemeMode = 'dark' | 'light';
export type ThemePreference = ThemeMode | 'system';

/** Resolution order (B3): the person's choice > the system scheme > light. */
export const resolveThemeMode = (preference: ThemePreference, systemScheme: ThemeMode | null | undefined): ThemeMode =>
  preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

/** The live tokens. Filled in place by `applyThemeMode`; light until then. */
export const colors: ColorTokens = { ...light };

/**
 * Always the dark palette, whatever the theme: for chrome drawn over live camera, photos and video (camera,
 * photo editor, snap and story viewers), where white-on-dark is the only readable choice.
 */
export const mediaColors: ColorTokens = { ...dark };

type SignalKey = 'GeneralObservation' | 'Crowd' | 'Queue' | 'TemporaryStatus' | 'Event' | 'Offer' | 'NewOpening';

/** B8: every signal type is a tint (fill) + ink (text/icon) pair. Blinkr's types mapped onto the plan's colours (D-017). */
export const signalTints: Record<SignalKey, string> = {
  GeneralObservation: p.stone, Crowd: p.apricot, Queue: p.butter, TemporaryStatus: p.coral,
  Event: p.grape, Offer: p.bubblegum, NewOpening: p.sky,
};
export const signalInks: Record<SignalKey, string> = {
  GeneralObservation: p.stoneInk, Crowd: p.apricotInk, Queue: p.butterInk, TemporaryStatus: p.coralInk,
  Event: p.grapeInk, Offer: p.bubblegumInk, NewOpening: p.skyInk,
};

/**
 * Per-signal-type colour for text and icons (badges, type pickers, cards): the ink on light, the tint itself on dark.
 * Fills use it at low opacity (`${tone}24`), which reads as the soft tint in both themes.
 */
export const signalColors: Record<SignalKey, string> = { ...signalInks };

const categoryKeys = {
  sage: ['RESTAURANT', 'FAST_FOOD', 'CAFE', 'BAKERY', 'PARK', 'PLAYGROUND'],
  bubblegum: ['BAR', 'ENTERTAINMENT', 'TOURISM'],
  apricot: ['SHOP', 'SUPERMARKET', 'FUEL'],
  grape: ['SPORT', 'MOSQUE', 'PLACE_OF_WORSHIP'],
  sky: ['EDUCATION', 'TRANSPORT'],
  coral: ['HEALTH', 'PHARMACY'],
} as const;

/** Accent for a Place category: marker outline, icon and place chips share it. */
export const categoryTones: Record<string, string> = {};

/** Occupancy/wait level scale (0 = calm, 3 = packed): tints, readable as bars in both themes. */
export const levelScale = [p.sage500, p.butter, p.apricot, p.coral] as const;

/** B6: soft shadows on light; dark uses borders and surface steps instead (shadow opacity 0). */
export const shadow = { shadowColor: p.ink900, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 6 };
export const shadowSoft = { shadowColor: p.ink900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 };

let currentMode: ThemeMode = 'light';
export const getThemeMode = () => currentMode;

/** Fills every token table for a mode. Called once at boot (`themeBoot.ts`), before any screen module loads. */
export function applyThemeMode(mode: ThemeMode) {
  currentMode = mode;
  const source = mode === 'dark' ? dark : light;
  Object.assign(colors, source);
  Object.assign(signalColors, mode === 'dark' ? signalTints : signalInks);
  const tone = (tint: string, ink: string) => (mode === 'dark' ? tint : ink);
  const tones: Record<keyof typeof categoryKeys, string> = {
    sage: mode === 'dark' ? p.sage400 : p.sage700,
    bubblegum: tone(p.bubblegum, p.bubblegumInk),
    apricot: tone(p.apricot, p.apricotInk),
    grape: tone(p.grape, p.grapeInk),
    sky: tone(p.sky, p.skyInk),
    coral: tone(p.coral, p.coralInk),
  };
  for (const [group, keys] of Object.entries(categoryKeys)) for (const key of keys) categoryTones[key] = tones[group as keyof typeof categoryKeys];
  shadow.shadowOpacity = mode === 'dark' ? 0 : 0.1;
  shadow.elevation = mode === 'dark' ? 0 : 6;
  shadowSoft.shadowOpacity = mode === 'dark' ? 0 : 0.06;
  shadowSoft.elevation = mode === 'dark' ? 0 : 2;
}
applyThemeMode('light');

export const categoryTone = (category?: string | null) => categoryTones[(category ?? '').toUpperCase()] ?? colors.mint;

/**
 * Semantic names from the plan (plan-devam B2), for new code and the component preview. They are views onto
 * `colors`, so they follow the active mode.
 */
export type SemanticPalette = {
  bgCanvas: string; bgSurface: string; bgSurfaceRaised: string; bgSurfaceSunken: string;
  bgOverlay: string; bgGlass: string;
  borderSubtle: string; borderDefault: string; borderStrong: string;
  textPrimary: string; textSecondary: string; textTertiary: string; textOnAccent: string; textOnCreate: string;
  accentPrimary: string; accentPrimaryBold: string; accentPrimarySoft: string; accentCreate: string;
  stateDanger: string; stateSuccess: string; stateInfo: string;
};
const semantic = (c: ColorTokens, mode: ThemeMode): SemanticPalette => ({
  bgCanvas: c.background, bgSurface: c.surface, bgSurfaceRaised: mode === 'dark' ? p.coal700 : p.white, bgSurfaceSunken: c.surfaceElevated,
  bgOverlay: c.scrim, bgGlass: c.glass,
  borderSubtle: mode === 'dark' ? 'rgba(255, 255, 255, 0.07)' : 'rgba(21, 24, 27, 0.06)', borderDefault: c.border, borderStrong: c.pinBorder,
  textPrimary: c.text, textSecondary: c.textSecondary, textTertiary: c.textMuted, textOnAccent: c.ink, textOnCreate: c.onCreate,
  accentPrimary: c.primary, accentPrimaryBold: mode === 'dark' ? p.sage300 : p.sage800, accentPrimarySoft: c.greenSoft, accentCreate: c.flare,
  stateDanger: c.danger, stateSuccess: c.primary, stateInfo: c.blue,
});
export const semanticColors: { dark: SemanticPalette; light: SemanticPalette } = { dark: semantic(dark, 'dark'), light: semantic(light, 'light') };
export const lightColors: Readonly<ColorTokens> = light;
export const darkColors: Readonly<ColorTokens> = dark;

/** B5: soft, rounded forms. `pill` for chips, avatars and pill buttons. */
export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
  // Legacy names
  control: 16,
  card: 16,
  panel: 24,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/** B5: the screen's side padding. */
export const screenPadding = 16;

/**
 * B4: Outfit (Google Fonts, OFL; Turkish ğ ş ı İ ç ö ü checked in the font's cmap) for titles, numbers and buttons;
 * the system font for body text. `App.tsx` loads these three weights before the first screen shows.
 */
export const displayFontFamily = { semibold: 'Outfit_600SemiBold', bold: 'Outfit_700Bold', extraBold: 'Outfit_800ExtraBold' };

/**
 * B4 type scale. Old step names are kept and repointed: headline = screen title (title1), title = sheet title
 * (title2), heading = section (headline). Sentence case everywhere - no ALL CAPS labels.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontFamily: displayFontFamily.extraBold, letterSpacing: -0.4 },
  headline: { fontSize: 24, lineHeight: 30, fontFamily: displayFontFamily.bold, letterSpacing: -0.2 },
  title: { fontSize: 19, lineHeight: 25, fontFamily: displayFontFamily.bold, letterSpacing: -0.1 },
  heading: { fontSize: 16, lineHeight: 21, fontFamily: displayFontFamily.semibold, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const, letterSpacing: 0 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const, letterSpacing: 0 },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: '500' as const, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.1 },
  micro: { fontSize: 11, lineHeight: 13, fontWeight: '600' as const, letterSpacing: 0.1 },
  /** Buttons and numbers: Outfit, tabular figures. */
  button: { fontSize: 16, lineHeight: 21, fontFamily: displayFontFamily.semibold, letterSpacing: 0 },
  number: { fontSize: 15, lineHeight: 21, fontFamily: displayFontFamily.semibold, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
};

/** The plan's own step names (B4), for `BlinkrText` and the component preview. */
export const displayTypography = {
  display: typography.display,
  title1: typography.headline,
  title2: typography.title,
};

/** Durations (ms). Things move briefly and with a little life. */
export const motion = { fast: 140, base: 200, sheet: 280, card: 350 };

/**
 * B7 springs. `bouncy` is the default: a small, friendly overshoot for cards, sheets and pins. `calm` has no overshoot,
 * for serious moments (errors, delete confirmation). Presses stay tight. When "Reduce motion" is on, `AnimatedPressable`
 * and the sheets pass `reduceMotion: system` so the device setting wins (no overshoot, no pulse).
 */
export const springs = {
  /** Press feedback on buttons, chips, rows. */
  snappy: { damping: 18, stiffness: 320, mass: 0.8 },
  /** Default: cards, sheets, pins - a slight overshoot. */
  bouncy: { damping: 14, stiffness: 200, mass: 1 },
  /** Serious contexts - no overshoot. */
  gentle: { damping: 22, stiffness: 240, mass: 1 },
};
export const pressScale = 0.96;

/** `touch` is the minimum interactive size. Buttons are 40 / 48 / 56 tall (B5). */
export const sizes = { touch: 44, icon: 20, marker: 38, bottomBar: 56, camera: 48, buttonSm: 40, buttonMd: 48, buttonLg: 56 };

/** Same tokens under the names used in the design package's reference code. */
export const blinkrTheme = { colors, spacing, radius: radii, typography } as const;
