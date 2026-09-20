/**
 * Blinkr design tokens - the single source for colour, spacing, radius and type.
 *
 * Names that existed before the redesign (`ink`, `surface`, `muted`, `green`, ...) are kept and
 * re-pointed at the new palette so screens migrate one at a time; new code should prefer the
 * semantic names (`background`, `text`, `textSecondary`, `primary`, `mint`, ...).
 */
export const colors = {
  // --- Palette ---------------------------------------------------------------------------
  background: '#101714',
  surface: '#19221F',
  surfaceElevated: '#202B26',
  glass: 'rgba(15, 23, 20, 0.94)',
  primary: '#D9FF57',
  primaryPressed: '#C5F13D',
  mint: '#65E6B5',
  darkGreen: '#159B72',
  text: '#FFFFFF',
  textSecondary: '#A2ADA7',
  /** Decorative / large text only - it does not reach 4.5:1 on `surface`. */
  textMuted: '#6B7871',
  border: 'rgba(255, 255, 255, 0.10)',
  orange: '#FFB45E',
  purple: '#BA8BFF',
  pink: '#FF74B8',
  danger: '#FF675C',

  // --- Legacy names, mapped onto the palette ---------------------------------------------
  ink: '#101714',
  inkSoft: '#C4CCC6',
  textPrimary: '#FFFFFF',
  muted: '#A2ADA7',
  mutedSoft: '#6B7871',
  line: 'rgba(255, 255, 255, 0.10)',
  lineStrong: 'rgba(255, 255, 255, 0.18)',
  surfaceSoft: '#141C18',
  surfaceTint: '#16241E',
  mapCanvas: '#0B0F0C',
  green: '#159B72',
  greenDark: '#65E6B5',
  greenSoft: '#12241D',
  greenLine: '#1F3A2E',
  lime: '#D9FF57',
  coral: '#FF675C',
  coralSoft: '#2A1712',
  coralLine: '#4A2B22',
  blue: '#5AA7FF',
  blueSoft: '#E9F2FC',
  teal: '#2BD4C6',
  amber: '#FFD25E',
  warning: '#FFB45E',
  error: '#FF675C',
  errorSoft: '#2B1613',
  errorLine: '#4A2521',
  white: '#FFFFFF',
  scrim: 'rgba(3, 7, 5, 0.52)',
  shadow: '#000000',
  mutedOnDark: '#A2ADA7',
  surfaceOnDark: '#202B26',
  lineOnDark: 'rgba(255, 255, 255, 0.14)',
};

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

export const shadow = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.28,
  shadowRadius: 18,
  elevation: 8,
};

export const shadowSoft = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.18,
  shadowRadius: 10,
  elevation: 4,
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
  // Legacy names
  control: 18,
  card: 22,
  panel: 30,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const typography = {
  headline: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: 0 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: 0 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: 0 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '700' as const, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const, letterSpacing: 0 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.4 },
};
export const motion = { fast: 160, sheet: 240 };

/** Reanimated spring configs - shared so every animated surface moves with the same feel. */
export const springs = {
  /** Buttons, chips, marker taps - quick, decisive settle. */
  snappy: { damping: 16, stiffness: 280, mass: 0.7 },
  /** Sheets, cards entering - playful overshoot, BeReal/Snapchat-style bounce. */
  bouncy: { damping: 13, stiffness: 190, mass: 0.9 },
  /** Backdrop fades, large panel transitions - no overshoot. */
  gentle: { damping: 22, stiffness: 170, mass: 1 },
};

/** `touch` is the minimum interactive size (HIG 44pt / Material 48dp). */
export const sizes = { touch: 44, icon: 20, marker: 38, bottomBar: 76, camera: 68 };

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
