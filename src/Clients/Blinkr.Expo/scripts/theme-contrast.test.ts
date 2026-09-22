import { colors, motion, radii, resolveThemeMode, semanticColors, sizes, springs, typography } from '../src/theme';

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Text that users must be able to read at 12-16pt needs WCAG AA (4.5:1).
const readable: Array<[string, string, string]> = [
  ['text on background', colors.text, colors.background],
  ['text on surface', colors.text, colors.surface],
  ['text on surfaceElevated', colors.text, colors.surfaceElevated],
  ['textSecondary on background', colors.textSecondary, colors.background],
  ['textSecondary on surface', colors.textSecondary, colors.surface],
  ['textSecondary on surfaceElevated', colors.textSecondary, colors.surfaceElevated],
  ['ink on primary (CTA label)', colors.ink, colors.primary],
  ['ink on primaryPressed', colors.ink, colors.primaryPressed],
  ['mint on surface', colors.mint, colors.surface],
  ['primary on surface', colors.primary, colors.surface],
  ['orange on surface', colors.orange, colors.surface],
  ['purple on surface', colors.purple, colors.surface],
  ['pink on surface', colors.pink, colors.surface],
  ['danger on surface', colors.danger, colors.surface],
  ['blue on surface', colors.blue, colors.surface],
  ['amber on surface', colors.amber, colors.surface],
  ['teal on surface', colors.teal, colors.surface],
  ['primary on surfaceElevated', colors.primary, colors.surfaceElevated],
  ['text on own chat bubble', colors.text, '#1D3D33'],
  ['white on darkGreen (marker glyph, 3:1 large/graphic)', colors.white, colors.darkGreen],
  ['ink on flare (camera/snap actions)', colors.ink, colors.flare],
  ['flare on camera black', colors.flare, '#000000'],
];

let failed = 0;
for (const [name, fg, bg] of readable) {
  const ratio = contrast(fg, bg);
  const required = name.includes('graphic') ? 3 : 4.5;
  const ok = ratio >= required;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${ratio.toFixed(2)}:1 (>=${required}) ${name}`);
}

const muted = contrast(colors.textMuted, colors.surface);
console.log(`info ${muted.toFixed(2)}:1 textMuted on surface - decorative/large text only`);
if (muted >= 4.5) throw new Error('textMuted is now AA-readable; update its doc comment in theme.ts');

if (failed > 0) throw new Error(`${failed} colour pair(s) below the required contrast`);

// ---- Sizing, type and motion guardrails: the scale follows platform norms (HIG / Material) and stays calm.
const guard = (name: string, ok: boolean, detail = '') => {
  if (!ok) throw new Error(`design guardrail failed: ${name} ${detail}`);
  console.log(`ok   ${name}`);
};
guard('body text is 14-17pt', typography.body.fontSize >= 14 && typography.body.fontSize <= 17, String(typography.body.fontSize));
guard('caption is 12-13pt and label 11-12pt', typography.caption.fontSize >= 12 && typography.caption.fontSize <= 13 && typography.label.fontSize >= 11 && typography.label.fontSize <= 12);
guard('screen title is at most 28pt, sheet title at most 22pt', typography.headline.fontSize <= 28 && typography.title.fontSize <= 22);
guard('no type step is heavier than 700', Object.values(typography).every((step) => Number(step.fontWeight) <= 700));
guard('line height gives every step room to breathe (>= 1.15x)', Object.values(typography).every((step) => step.lineHeight >= step.fontSize * 1.15));
guard('touch target is at least 44', sizes.touch >= 44);
guard('tab bar is 49-60 (HIG 49 plus a floating margin)', sizes.bottomBar >= 49 && sizes.bottomBar <= 60);
guard('cards use a 12-16 radius, sheets at most 24', radii.card >= 12 && radii.card <= 16 && radii.panel <= 24);
guard('animations are short (<= 260ms)', motion.fast <= 200 && motion.base <= 260 && motion.sheet <= 260);
for (const [name, spring] of Object.entries(springs)) {
  const dampingRatio = spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass));
  guard(`spring "${name}" does not overshoot (damping ratio >= 0.9)`, dampingRatio >= 0.9, dampingRatio.toFixed(2));
}
// ---- P1.2 theme mode resolution: "system" follows the device; a null/unknown scheme never crashes into light.
guard('an explicit preference always wins over the system scheme', resolveThemeMode('dark', 'light') === 'dark' && resolveThemeMode('light', 'dark') === 'light');
guard('"system" follows a known device scheme', resolveThemeMode('system', 'light') === 'light' && resolveThemeMode('system', 'dark') === 'dark');
guard('"system" with an unreported scheme (null/undefined) defaults to dark, not light', resolveThemeMode('system', null) === 'dark' && resolveThemeMode('system', undefined) === 'dark');
guard('both palettes define every semantic token the same shape', JSON.stringify(Object.keys(semanticColors.dark).sort()) === JSON.stringify(Object.keys(semanticColors.light).sort()));
guard('every semantic colour is a real colour string, not left blank', [...Object.values(semanticColors.dark), ...Object.values(semanticColors.light)].every((value) => typeof value === 'string' && value.length > 0));

console.log('theme contrast tests passed');
