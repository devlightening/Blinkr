export const colors = {
  ink: '#101713',
  inkSoft: '#C4CCC6',
  textPrimary: '#F4F7F1',
  muted: '#8A968D',
  mutedSoft: '#5C665F',
  line: '#262C26',
  lineStrong: '#3A423B',
  surface: '#171D19',
  surfaceSoft: '#12170F',
  surfaceTint: '#122019',
  mapCanvas: '#0B0F0C',
  green: '#22A876',
  greenDark: '#5EE8A5',
  greenSoft: '#132019',
  greenLine: '#25392E',
  lime: '#D8F65A',
  coral: '#F36C52',
  coralSoft: '#2A1712',
  coralLine: '#4A2B22',
  purple: '#7957C8',
  purpleSoft: '#1E1830',
  teal: '#2BB5AE',
  tealSoft: '#132523',
  blue: '#4A94E8',
  blueSoft: '#E9F2FC',
  amber: '#D58A19',
  amberSoft: '#241C0C',
  warning: '#E08A3C',
  error: '#F47066',
  errorSoft: '#2B1613',
  errorLine: '#4A2521',
  white: '#FFFFFF',
  scrim: 'rgba(3, 7, 5, 0.62)',
  shadow: '#000000',
  // Dark-surface variants, for the hero/header sections that are always-dark
  // by brand design (Auth hero, PostDetailSheet current-state panel) -
  // not an OS dark-mode palette.
  mutedOnDark: '#BCC7C0',
  surfaceOnDark: '#29342E',
  lineOnDark: '#3B4941',
};

/** Per-signal-type marker/accent color, shared by the map pins and the composer's type picker. */
export const signalColors: Record<
  'GeneralObservation' | 'Crowd' | 'Queue' | 'TemporaryStatus' | 'Event' | 'Offer' | 'NewOpening',
  string
> = {
  GeneralObservation: colors.blue,
  Crowd: colors.coral,
  Queue: colors.amber,
  TemporaryStatus: colors.error,
  Event: colors.green,
  Offer: colors.purple,
  NewOpening: colors.teal,
};

export const shadow = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 7 },
  shadowOpacity: 0.14,
  shadowRadius: 16,
  elevation: 7,
};

export const shadowSoft = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.08,
  shadowRadius: 9,
  elevation: 3,
};

export const radii = {
  control: 16,
  panel: 28,
  card: 20,
  pill: 999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
};

export const typography = {
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const, letterSpacing: 0 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '500' as const, letterSpacing: 0 },
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

export const sizes = { touch: 44, icon: 20, marker: 38 };
