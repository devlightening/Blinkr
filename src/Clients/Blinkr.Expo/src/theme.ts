export const colors = {
  ink: '#101713',
  inkSoft: '#26312B',
  muted: '#68736C',
  mutedSoft: '#8B958F',
  line: '#DCE4DF',
  lineStrong: '#C7D2CB',
  surface: '#FFFFFF',
  surfaceSoft: '#F3F6F4',
  surfaceTint: '#EAF4EE',
  green: '#0E7650',
  greenDark: '#064832',
  greenSoft: '#DDF3E7',
  lime: '#D8F65A',
  coral: '#F36C52',
  coralSoft: '#FFF0EC',
  blue: '#2878D0',
  blueSoft: '#E9F2FC',
  amber: '#D58A19',
  amberSoft: '#FFF4DC',
  warning: '#9A5524',
  error: '#AE3F3A',
  errorSoft: '#FCECEA',
  white: '#FFFFFF',
  scrim: 'rgba(8, 18, 12, 0.48)',
  shadow: '#081A10',
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
  control: 8,
  panel: 8,
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
export const sizes = { touch: 44, icon: 20, marker: 38 };
