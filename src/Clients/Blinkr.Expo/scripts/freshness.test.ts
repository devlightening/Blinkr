import { confidenceKey, freshnessLabelKey, freshnessOpacity, freshnessTier, isLive } from '../src/freshness';
import { filterActivity, type ActivityItem } from '../src/nearbyActivity';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const now = Date.parse('2026-09-23T12:00:00Z');
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

run('tiers: live < 15 min, recent < 45 min, then old; expired and none', () => {
  check(freshnessTier(ago(0), null, now) === 'live', '0 min');
  check(freshnessTier(ago(14.9), null, now) === 'live', '14.9 min');
  check(freshnessTier(ago(15), null, now) === 'recent', '15 min');
  check(freshnessTier(ago(44.9), null, now) === 'recent', '44.9 min');
  check(freshnessTier(ago(45), null, now) === 'old', '45 min');
  check(freshnessTier(ago(5), ago(1), now) === 'expired', 'expired wins');
  check(freshnessTier(null, null, now) === 'none' && freshnessTier('not a date', null, now) === 'none', 'none');
});

run('"Canlı" only for server-verified live observations; otherwise "Taze"', () => {
  check(freshnessLabelKey('live', true) === 'common:freshness.live', 'verified live');
  check(freshnessLabelKey('live', false) === 'common:freshness.fresh', 'unverified live is fresh');
  check(freshnessLabelKey('recent', true) === 'common:freshness.recent', 'recent');
  check(isLive(ago(3), null, true, now) && !isLive(ago(3), null, false, now) && !isLive(ago(20), null, true, now), 'isLive');
});

run('opacity and confidence follow the same rule', () => {
  check(freshnessOpacity(ago(5), now) === 1 && freshnessOpacity(ago(30), now) === 0.9 && freshnessOpacity(ago(90), now) === 0.65, 'opacity');
  check(confidenceKey('HIGH') === 'common:confidence.high' && confidenceKey('medium') === 'common:confidence.medium' && confidenceKey(null) === 'common:confidence.low', 'confidence');
});

run('the "Canlı" chip counts exactly the rows called live', () => {
  const row = (key: string, live: boolean): ActivityItem => ({ key, kind: 'place', title: key, distanceMeters: 10, signalType: 'Crowd', signalValue: null, observedAtUtc: ago(1), verifiedLive: true, live, activeSignalCount: 1 });
  const items = [row('a', true), row('b', false), row('c', true)];
  check(filterActivity(items, 'live').length === 2, 'live chip count');
  check(filterActivity(items, 'all').length === 3, 'all count');
});
