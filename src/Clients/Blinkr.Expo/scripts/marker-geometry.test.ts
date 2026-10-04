import { LIVE_PIN, SIGNAL_BUBBLE, anchorOf, clusterLabel, lifetimeFraction, livePinAnchor, livePinSize, ringDash } from '../src/markerGeometry';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

run('anchors put the tip on the coordinate, centred horizontally and inside the view', () => {
  for (const geometry of [SIGNAL_BUBBLE]) {
    const anchor = anchorOf(geometry);
    check(near(anchor.x, 0.5), 'horizontally centred');
    check(anchor.y > 0.8 && anchor.y < 1, 'tip near the bottom, inside the view');
    check(geometry.tipX + geometry.pad <= geometry.width && geometry.tipY + geometry.pad <= geometry.height, 'tip inside the view');
  }
});
run('the head circle fits inside the marker with room for the glow', () => {
  for (const geometry of [SIGNAL_BUBBLE]) {
    check(geometry.headX - geometry.headRadius >= 0 && geometry.headX + geometry.headRadius <= geometry.width - 2 * geometry.pad, 'head inside horizontally');
    check(geometry.headY - geometry.headRadius >= 0, 'head inside at the top');
    check(geometry.headY + geometry.headRadius < geometry.tipY, 'head sits above the tip');
  }
});
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
run('lifetime fraction: fresh, half-way, expired, default three hours', () => {
  const now = Date.parse('2026-09-21T12:00:00Z');
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
  check(near(lifetimeFraction(at(0), at(180), now), 1), 'just posted');
  check(near(lifetimeFraction(at(-90), at(90), now), 0.5), 'half of the lifetime left');
  check(lifetimeFraction(at(-200), at(-20), now) === 0, 'expired');
  check(near(lifetimeFraction(at(-90), null, now), 0.5), 'no expiry: three hours from creation');
  check(lifetimeFraction(null, null, now) === 0 && lifetimeFraction('nonsense', null, now) === 0, 'unknown creation');
  check(lifetimeFraction(at(0), at(-5), now) === 0, 'expiry before creation');
});
run('ring dash shows the requested share and is clamped', () => {
  const circumference = 2 * Math.PI * 10;
  const half = ringDash(0.5, 10).split(' ').map(Number);
  check(near(half[0], circumference / 2, 0.01) && near(half[1], circumference, 0.01), 'half ring');
  check(ringDash(2, 10).split(' ')[0] === ringDash(1, 10).split(' ')[0], 'clamped above');
  check(Number(ringDash(-1, 10).split(' ')[0]) === 0 && Number(ringDash(Number.NaN, 10).split(' ')[0]) === 0, 'clamped below / NaN');
});
run('cluster count label', () => {
  check(clusterLabel(7) === '7' && clusterLabel(99) === '99' && clusterLabel(100) === '99+', 'label');
});
