/**
 * Blinkr design tokens - the single source for colour, spacing, radius and type.
 *
 * Names that existed before the redesign (`ink`, `surface`, `muted`, `green`, ...) are kept and
 * re-pointed at the new palette so screens migrate one at a time; new code should prefer the
 * semantic names (`background`, `text`, `textSecondary`, `primary`, `mint`, ...).
 */
export const colors = {
  // --- Palette: "Graphite & Mint" ---------------------------------------------------------
  // Cool graphite neutrals carry the structure; one calm green is the brand; the semantic
  // accents are muted so nothing on screen glows. Every text pair is checked in
  // scripts/theme-contrast.test.ts.
  background: '#0F1316',
  surface: '#171C20',
  surfaceElevated: '#1F262B',
  glass: 'rgba(20, 25, 28, 0.94)',
  primary: '#5FD3A0',
  primaryPressed: '#4EBE8E',
  mint: '#6FDDB4',
  darkGreen: '#1F8F6B',
  text: '#F3F6F7',
  textSecondary: '#9BA6AC',
  /** Decorative / large text only - it does not reach 4.5:1 on `surface`. */
  textMuted: '#6E7A81',
  border: 'rgba(255, 255, 255, 0.08)',
  orange: '#F0B267',
  purple: '#AB98EF',
  pink: '#EE9EC0',
  danger: '#EE7C71',
  /**
   * Warm flash-gold, used only by the camera and snap-sending screens (shutter ring, selected lens, zoom pill,
   * send action). It gives capture its own distinct, energetic voice - the way Snapchat's yellow reads instantly
   * as "camera" - while the rest of the app keeps the calm mint identity. Never used outside camera/snap chrome.
   */
  flare: '#FFC845',
  flarePressed: '#F0B72E',

  // --- Legacy names, mapped onto the palette ---------------------------------------------
  ink: '#0A1F18',
  inkSoft: '#C6CFD3',
  textPrimary: '#F3F6F7',
  muted: '#9BA6AC',
  mutedSoft: '#6E7A81',
  line: 'rgba(255, 255, 255, 0.08)',
  lineStrong: 'rgba(255, 255, 255, 0.14)',
  surfaceSoft: '#13181B',
  surfaceTint: '#15211D',
  mapCanvas: '#0B0F11',
  green: '#1F8F6B',
  greenDark: '#6FDDB4',
  greenSoft: '#12251F',
  greenLine: '#1E3A30',
  lime: '#5FD3A0',
  coral: '#EE7C71',
  coralSoft: '#2A1816',
  coralLine: '#4A2B26',
  blue: '#7FAEF0',
  blueSoft: '#E9F2FC',
  teal: '#5CCBC0',
  amber: '#E8C86A',
  warning: '#F0B267',
  error: '#EE7C71',
  errorSoft: '#2B1714',
  errorLine: '#4A2622',
  white: '#FFFFFF',
  scrim: 'rgba(3, 6, 8, 0.55)',
  shadow: '#000000',
  mutedOnDark: '#9BA6AC',
  surfaceOnDark: '#1F262B',
  lineOnDark: 'rgba(255, 255, 255, 0.14)',

  // --- Raw palette from docs/sinyal-mvp-plan/docs/plan/03_DESIGN_SYSTEM.md §2.1 (P1.1) -------------
  // Additive only: nothing above is renamed or repointed, so every existing screen is unaffected.
  // `flare`/`flarePressed` above already equal this palette's `sun500`/`sun600` (independently chosen
  // for the camera/snap accent, then found to match the plan almost exactly - kept as the canonical
  // names since 5 files already reference them; `sun*` are here so new work can use the plan's own
  // vocabulary). Light-mode semantic tokens and a runtime ThemeProvider are P1.2, not yet built.
  ink950: '#07090B', ink900: '#0C1014', ink850: '#11161B', ink800: '#171D23',
  ink700: '#212932', ink600: '#2C3540', ink500: '#46515D', ink400: '#6B7682',
  ink300: '#98A2AE', ink200: '#C4CBD3', ink100: '#E6EAEE', ink50: '#F4F6F8',
  mint500: '#3DDC97', mint600: '#22B97A', mint400: '#6BE8B1', mint900: '#0E2A20',
  sun500: '#FFC83D', sun600: '#E5A800', sun400: '#FFD86E',
  red500: '#FF5A5F', orange500: '#FF8A4C', amber500: '#FFC83D',
  pink500: '#F472B6', violet500: '#B98BFF', sky500: '#38BDF8',
  indigo500: '#818CF8', slate500: '#8FA3BF', blue500: '#4DA3FF',
};

/**
 * Occupancy/wait/traffic/parking level scale (03_DESIGN_SYSTEM.md §2.4): 0 = calm/plenty, 3 = packed.
 * Parking reads the opposite way (plenty of spots = level 0 = still the calm colour); invert the count
 * before indexing this array for that one signal, never the array itself.
 */
export const levelScale = [colors.mint500, '#D9E36B', colors.orange500, colors.red500] as const;

/**
 * Semantic dark/light tokens (03_DESIGN_SYSTEM.md §2.2), for `ThemeProvider`/`useTheme()` (P1.2). No
 * screen reads this yet - the app stays visually dark-only (the flat `colors` above) until a screen is
 * migrated to consume `useTheme().palette`; ships as infrastructure first, on purpose, rather than a
 * "light mode" toggle that looks like it does something and does not.
 */
export type SemanticPalette = {
  bgCanvas: string; bgSurface: string; bgSurfaceRaised: string; bgSurfaceSunken: string;
  bgOverlay: string; bgGlass: string;
  borderSubtle: string; borderDefault: string;
  textPrimary: string; textSecondary: string; textTertiary: string; textOnAccent: string;
  accentPrimary: string; accentPrimarySoft: string; accentCreate: string;
  stateDanger: string; stateSuccess: string; stateInfo: string;
};

export const semanticColors: { dark: SemanticPalette; light: SemanticPalette } = {
  dark: {
    bgCanvas: colors.ink950, bgSurface: colors.ink900, bgSurfaceRaised: colors.ink850, bgSurfaceSunken: colors.ink800,
    bgOverlay: 'rgba(7, 9, 11, 0.55)', bgGlass: 'rgba(17, 22, 27, 0.72)',
    borderSubtle: 'rgba(255, 255, 255, 0.06)', borderDefault: colors.ink700,
    textPrimary: colors.ink50, textSecondary: colors.ink300, textTertiary: colors.ink400, textOnAccent: colors.ink950,
    accentPrimary: colors.mint500, accentPrimarySoft: colors.mint900, accentCreate: colors.sun500,
    stateDanger: colors.red500, stateSuccess: colors.mint500, stateInfo: colors.blue500,
  },
  light: {
    bgCanvas: colors.white, bgSurface: colors.ink50, bgSurfaceRaised: colors.white, bgSurfaceSunken: colors.ink100,
    bgOverlay: 'rgba(7, 9, 11, 0.35)', bgGlass: 'rgba(255, 255, 255, 0.78)',
    borderSubtle: 'rgba(7, 9, 11, 0.06)', borderDefault: colors.ink100,
    textPrimary: colors.ink950, textSecondary: colors.ink500, textTertiary: colors.ink400, textOnAccent: colors.ink950,
    accentPrimary: colors.mint600, accentPrimarySoft: '#DDF7EC', accentCreate: colors.sun500,
    stateDanger: '#E5484D', stateSuccess: colors.mint600, stateInfo: '#2F7FE0',
  },
};

export type ThemeMode = 'dark' | 'light';
export type ThemePreference = ThemeMode | 'system';

/** "system" follows the device; `systemScheme` is whatever `useColorScheme()` returned (RN can report `null`). */
export const resolveThemeMode = (preference: ThemePreference, systemScheme: ThemeMode | null | undefined): ThemeMode =>
  preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

/** Per-signal-type accent, shared by the map pins, the composer's type picker and signal cards. */
export const signalColors: Record<
  'GeneralObservation' | 'Crowd' | 'Queue' | 'TemporaryStatus' | 'Event' | 'Offer' | 'NewOpening',
  string
> = {
  GeneralObservation: colors.blue,
  Crowd: colors.orange,
  Queue: colors.amber,
  TemporaryStatus: colors.danger,
  Event: colors.mint,
  Offer: colors.purple,
  NewOpening: colors.pink,
};

/** Elevation is quiet: a low, soft shadow on floating surfaces only (bar, sheets). Cards use a border instead. */
export const shadow = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.2,
  shadowRadius: 12,
  elevation: 4,
};

export const shadowSoft = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.14,
  shadowRadius: 6,
  elevation: 2,
};

/** Corner radii follow the platform norm (HIG 10-14, Material 12-16 for cards); `pill` is for chips and avatars only. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
  // Legacy names
  control: 12,
  card: 14,
  panel: 20,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/**
 * Type scale on the system font (SF Pro / Roboto), the same steps social and messaging apps use:
 * 26 screen title, 20 sheet title, 17 section, 15 body, 13 caption, 12 label, 11 tab label.
 * Weights stop at 700; nothing is set in extra-bold.
 */
export const typography = {
  headline: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.2 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.1 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const, letterSpacing: 0 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing: 0 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.1 },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.1 },
};

/**
 * P1.3 (sinyal-mvp-plan Faz 1): "Bricolage Grotesque" for large display text (03_DESIGN_SYSTEM.md §3).
 * `displayFontFamily` is the loaded-font name; `App.tsx` loads the two weights via `useFonts` and only
 * ever shows the app once loading has *settled* (loaded, or genuinely failed - never blocked forever).
 * Google Fonts lists this family's subsets as `latin`/`latin-ext`/`vietnamese`; `latin-ext` is the block
 * that carries Turkish ğ/ş/ı/İ/ç/ö/ü, so it should render correctly - **not yet visually confirmed on a
 * physical device this session**, per this project's rule against claiming native-only results without
 * one. `useDisplayFont` below reports whether the font actually loaded, so `BlinkrText` can fall back to
 * the system font rather than show tofu glyphs if it did not.
 */
export const displayFontFamily = { semibold: 'BricolageGrotesque_600SemiBold', bold: 'BricolageGrotesque_700Bold' };
export const displayTypography = {
  display: { fontSize: 30, lineHeight: 36, fontFamily: displayFontFamily.bold, letterSpacing: -0.3 },
  title1: { fontSize: 22, lineHeight: 28, fontFamily: displayFontFamily.bold, letterSpacing: -0.2 },
  title2: { fontSize: 18, lineHeight: 24, fontFamily: displayFontFamily.semibold, letterSpacing: -0.1 },
};
/** Short and quiet: things ease into place, they do not bounce. */
export const motion = { fast: 140, base: 200, sheet: 240 };

/** Reanimated spring configs - shared so every animated surface moves with the same feel. All are (near) critically damped. */
export const springs = {
  /** Press feedback on buttons, chips, rows. */
  snappy: { damping: 32, stiffness: 380, mass: 0.8 },
  /** Sheets and panels settling - a soft landing, no overshoot. */
  bouncy: { damping: 30, stiffness: 240, mass: 1 },
  /** Backdrop fades, large panel transitions - no overshoot. */
  gentle: { damping: 26, stiffness: 180, mass: 1 },
};

/** `touch` is the minimum interactive size (HIG 44pt / Material 48dp). The tab bar is 56 (HIG 49 + breathing room for a floating bar); `camera` is the share action in it. */
export const sizes = { touch: 44, icon: 20, marker: 38, bottomBar: 56, camera: 44 };

/** Same tokens under the names used in the design package's reference code. */
export const blinkrTheme = { colors, spacing, radius: radii, typography } as const;

/** Accent for a Place category: marker outline, icon and place chips share it. */
export const categoryTones: Record<string, string> = {
  RESTAURANT: colors.mint,
  FAST_FOOD: colors.mint,
  CAFE: colors.mint,
  BAKERY: colors.mint,
  BAR: colors.pink,
  ENTERTAINMENT: colors.pink,
  SHOP: colors.orange,
  SUPERMARKET: colors.orange,
  PARK: colors.mint,
  PLAYGROUND: colors.mint,
  SPORT: colors.purple,
  TOURISM: colors.pink,
  MOSQUE: colors.purple,
  PLACE_OF_WORSHIP: colors.purple,
  EDUCATION: colors.blue,
  HEALTH: colors.danger,
  PHARMACY: colors.danger,
  TRANSPORT: colors.blue,
  FUEL: colors.orange,
};
export const categoryTone = (category?: string | null) => categoryTones[(category ?? '').toUpperCase()] ?? colors.mint;
