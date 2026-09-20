import { colors } from '../src/theme';

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
  ['white on darkGreen (marker glyph, 3:1 large/graphic)', colors.white, colors.darkGreen],
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
console.log('theme contrast tests passed');
