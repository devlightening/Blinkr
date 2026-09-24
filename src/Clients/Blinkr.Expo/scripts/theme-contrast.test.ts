import { applyThemeMode, colors, darkColors, gradients, lightColors, mediaColors, motion, radii, resolveThemeMode, semanticColors, signalInks, signalTints, sizes, springs, typography, type ThemeMode } from '../src/theme';

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

let failed = 0;
const check = (mode: string, name: string, fg: string, bg: string, required = 4.5) => {
  const ratio = contrast(fg, bg);
  const ok = ratio >= required;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${mode}] ${ratio.toFixed(2)}:1 (>=${required}) ${name}`);
};

// plan-devam B10: every text pair people must read at 12-16pt reaches WCAG AA (4.5:1) in both themes;
// graphics and large text 3:1.
for (const mode of ['light', 'dark'] as ThemeMode[]) {
  applyThemeMode(mode);
  const c = colors;
  for (const [bgName, bg] of [['background', c.background], ['surface', c.surface], ['surfaceElevated', c.surfaceElevated]] as const) {
    check(mode, `text on ${bgName}`, c.text, bg);
    check(mode, `textSecondary on ${bgName}`, c.textSecondary, bg);
    check(mode, `mint (accent text) on ${bgName}`, c.mint, bg);
    check(mode, `danger on ${bgName}`, c.danger, bg);
  }
  check(mode, 'CTA label (ink) on primary', c.ink, c.primary);
  check(mode, 'CTA label (ink) on primaryPressed', c.ink, c.primaryPressed);
  check(mode, 'text on primary soft (own chat bubble)', c.text, c.greenSoft);
  check(mode, 'onCreate on sun (create/send)', c.onCreate, c.flare);
  for (const name of ['orange', 'purple', 'pink', 'blue', 'amber', 'teal'] as const) check(mode, `${name} on surface`, c[name], c.surface);
  for (const type of Object.keys(signalInks) as (keyof typeof signalInks)[]) {
    // Badges: the type colour as text on its own soft fill (tone at ~14% over the surface).
    const tone = mode === 'dark' ? signalTints[type] : signalInks[type];
    check(mode, `${type} badge text on surface`, tone, c.surface);
  }
  check(mode, 'pin border against the canvas (graphic)', c.pinBorder, c.background, 3);
  const muted = contrast(c.textMuted, c.surface);
  console.log(`info [${mode}] ${muted.toFixed(2)}:1 textMuted on surface - decorative/large text only`);
}
applyThemeMode('light');
check('media', 'white chrome on camera black', mediaColors.text, '#000000');
check('media', 'sun on camera black', mediaColors.flare, '#000000');
if (failed > 0) throw new Error(`${failed} colour pair(s) below the required contrast`);

// ---- Sizing, type and motion guardrails (plan-devam B4/B5/B7).
const guard = (name: string, ok: boolean, detail = '') => {
  if (!ok) throw new Error(`design guardrail failed: ${name} ${detail}`);
  console.log(`ok   ${name}`);
};
guard('type scale matches B4 (display 34, title1 24, title2 19, headline 16, body 15, callout 14, caption 12, micro 11)',
  typography.display.fontSize === 34 && typography.headline.fontSize === 24 && typography.title.fontSize === 19 && typography.heading.fontSize === 16
  && typography.body.fontSize === 15 && typography.callout.fontSize === 14 && typography.caption.fontSize === 12 && typography.micro.fontSize === 11);
guard('titles, buttons and numbers use Outfit', [typography.display, typography.headline, typography.title, typography.heading, typography.button, typography.number].every((s) => 'fontFamily' in s && String(s.fontFamily).startsWith('Outfit_')));
guard('body text stays on the system font', !('fontFamily' in typography.body) && !('fontFamily' in typography.caption));
guard('line height gives every step room (>= 1.15x)', Object.values(typography).every((step) => step.lineHeight >= step.fontSize * 1.15));
guard('touch target is at least 44', sizes.touch >= 44);
guard('buttons are 40 / 48 / 56', sizes.buttonSm === 40 && sizes.buttonMd === 48 && sizes.buttonLg === 56);
guard('radius steps are 10 / 16 / 24 / 32', radii.sm === 10 && radii.md === 16 && radii.lg === 24 && radii.xl === 32);
guard('animations are short (<= 350ms)', motion.fast <= 200 && motion.base <= 260 && motion.card <= 350);
const ratio = (s: { damping: number; stiffness: number; mass: number }) => s.damping / (2 * Math.sqrt(s.stiffness * s.mass));
guard('default spring overshoots a little (damping ratio 0.4-0.8)', ratio(springs.bouncy) >= 0.4 && ratio(springs.bouncy) <= 0.8, ratio(springs.bouncy).toFixed(2));
guard('serious spring does not overshoot (>= 0.7) and presses stay tight (>= 0.5)', ratio(springs.gentle) >= 0.7 && ratio(springs.snappy) >= 0.5, `${ratio(springs.gentle).toFixed(2)} ${ratio(springs.snappy).toFixed(2)}`);
// ---- B3 theme resolution: the person's choice > the system scheme > light.
guard('an explicit preference always wins over the system scheme', resolveThemeMode('dark', 'light') === 'dark' && resolveThemeMode('light', 'dark') === 'light');
guard('"system" follows a known device scheme', resolveThemeMode('system', 'light') === 'light' && resolveThemeMode('system', 'dark') === 'dark');
guard('"system" with no reported scheme falls back to light', resolveThemeMode('system', null) === 'light' && resolveThemeMode('system', undefined) === 'light');
guard('palettes: paper light, night dark (V2 D-024)', lightColors.background === '#FCFBF8' && darkColors.background === '#0E0F12' && darkColors.surface === '#17191D');
guard('brand gradient is sun -> rose -> violet', gradients.brand.join() === '#FFC83D,#FF6B6B,#B06BFF' && gradients.story.join() === gradients.brand.join());
// Text on the gradient is dark (onCreate): it must read on every stop.
for (const stop of gradients.brand) check('gradient', `onCreate on ${stop}`, lightColors.onCreate, stop);
if (failed > 0) throw new Error('text on the brand gradient is below 4.5:1');
guard('dark canvas is not pure black', darkColors.background.toLowerCase() !== '#000000');
guard('both semantic palettes have the same shape', JSON.stringify(Object.keys(semanticColors.dark).sort()) === JSON.stringify(Object.keys(semanticColors.light).sort()));
guard('every semantic colour is a real colour string', [...Object.values(semanticColors.dark), ...Object.values(semanticColors.light)].every((value) => typeof value === 'string' && value.length > 0));
guard('sun appears only as flare/onCreate tokens (create/send)', Object.entries(lightColors).filter(([, v]) => v === '#FFC83D').every(([k]) => k === 'flare'));

console.log('theme contrast tests passed');
