import { COMPACT_SCALE, PLACE_PIN, SIGNAL_BUBBLE, anchorOf, clusterHaloRadius, clusterLabel, lifetimeFraction, markerScale, ringDash } from '../src/markerGeometry';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

run('anchors put the tip on the coordinate, centred horizontally and inside the view', () => {
  for (const geometry of [PLACE_PIN, SIGNAL_BUBBLE]) {
    const anchor = anchorOf(geometry);
    check(near(anchor.x, 0.5), 'horizontally centred');
    check(anchor.y > 0.8 && anchor.y < 1, 'tip near the bottom, inside the view');
    check(geometry.tipX + geometry.pad <= geometry.width && geometry.tipY + geometry.pad <= geometry.height, 'tip inside the view');
  }
});
run('the head circle fits inside the marker with room for the glow', () => {
  for (const geometry of [PLACE_PIN, SIGNAL_BUBBLE]) {
    check(geometry.headX - geometry.headRadius >= 0 && geometry.headX + geometry.headRadius <= geometry.width - 2 * geometry.pad, 'head inside horizontally');
    check(geometry.headY - geometry.headRadius >= 0, 'head inside at the top');
    check(geometry.headY + geometry.headRadius < geometry.tipY, 'head sits above the tip');
  }
});
run('compact markers are smaller but never tiny', () => {
  check(markerScale(false) === 1 && markerScale(true) === COMPACT_SCALE && COMPACT_SCALE >= 0.7 && COMPACT_SCALE < 1, 'scale');
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
run('cluster halo grows with the count and stays bounded', () => {
  check(clusterHaloRadius(1) === 26, 'single');
  check(clusterHaloRadius(2) < clusterHaloRadius(20) && clusterHaloRadius(20) < clusterHaloRadius(500), 'monotonic');
  check(clusterHaloRadius(1_000_000) === 40, 'bounded');
  check(clusterLabel(7) === '7' && clusterLabel(99) === '99' && clusterLabel(100) === '99+', 'label');
});
