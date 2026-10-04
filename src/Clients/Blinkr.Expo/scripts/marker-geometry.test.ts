import { LIVE_PIN, clusterLabel, livePinAnchor, livePinSize } from '../src/markerGeometry';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

run('live pins: anchored at the ring centre with or without the tag; quiet < normal < selected; 44 pt target', () => {
  check(livePinSize(true, false) < livePinSize(false, false) && livePinSize(false, false) < livePinSize(false, true), 'sizes');
  check(livePinSize(false, false) >= 44, 'touch target');
  for (const quiet of [true, false]) for (const selected of [true, false]) {
    const size = livePinSize(quiet, selected);
    const bare = livePinAnchor(quiet, selected, false);
    check(near(bare.x, 0.5) && near(bare.y, 0.5), 'no tag: centre');
    const tagged = livePinAnchor(quiet, selected, true);
    const height = LIVE_PIN.pad * 2 + size + LIVE_PIN.tagGap + LIVE_PIN.tagHeight;
    check(near(tagged.y * height, LIVE_PIN.pad + size / 2) && tagged.y < 0.5, 'tag below: anchor moves up to the ring centre');
  }
});
run('cluster count label', () => {
  check(clusterLabel(7) === '7' && clusterLabel(99) === '99' && clusterLabel(100) === '99+', 'label');
});
