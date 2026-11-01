// Colours live only in src/theme.ts (v4 brief, plan-devam B). Flags raw hex / rgb(a) colour literals anywhere else in src.
// usage: node scripts/lint-ui.cjs   (exit 1 on any finding)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'src');
// Art constants by design (CLAUDE.md §12.1): avatar and lens drawings, the native dark map style.
const ART = new Set([
  'theme.ts', 'avatars.ts', 'cameraEffects.ts', 'mapDarkStyle.ts',
  'components/Avatar.tsx', 'components/camera/FilterOverlay.tsx', 'components/camera/DraggableSticker.tsx',
]);
const COLOUR = /(['"`])#[0-9a-fA-F]{3,8}\1|\brgba?\(/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'i18n') yield* walk(full); }
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) yield full;
  }
}

const findings = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (ART.has(rel)) continue;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*')) return;
    if (COLOUR.test(line)) findings.push(`${rel}:${i + 1}  ${t.slice(0, 100)}`);
  });
}
findings.forEach((f) => console.log(f));
console.log(`lint-ui: ${findings.length} raw colour literal(s) outside theme.ts`);
if (findings.length > 0) process.exit(1);
