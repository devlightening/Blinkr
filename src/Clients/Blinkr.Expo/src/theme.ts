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
