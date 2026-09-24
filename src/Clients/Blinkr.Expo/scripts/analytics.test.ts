import { cleanProps, recentEvents, setAnalyticsConsent, setAnalyticsSink, track, zoomBucket } from '../src/analytics';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('nothing is recorded without consent', () => {
  setAnalyticsConsent(false);
  track('app_opened', { cold_start: true });
  check(recentEvents().length === 0, 'no consent, no event');
});
run('only schema properties pass; personal data is dropped', () => {
  const clean = cleanProps('signal_created', { signal_type: 'Crowd', has_media: true, latitude: 39.9, email: 'a@b.c', content: 'metin', is_anonymous: false, source: 'x'.repeat(80) });
  check(JSON.stringify(clean) === JSON.stringify({ signal_type: 'Crowd', has_media: true, is_anonymous: false }), JSON.stringify(clean));
});
run('with consent events reach the sink, cleaned', () => {
  const got: unknown[] = [];
  setAnalyticsSink((event, props) => got.push([event, props]));
  setAnalyticsConsent(true);
  track('pin_tapped', { signal_type: 'Queue', is_place: true, lat: 1 });
  check(JSON.stringify(got) === JSON.stringify([['pin_tapped', { signal_type: 'Queue', is_place: true }]]), JSON.stringify(got));
  setAnalyticsSink(() => { throw new Error('boom'); });
  track('app_opened', {});
  check(recentEvents().length === 2, 'a throwing sink never breaks tracking');
  setAnalyticsConsent(false);
  check(recentEvents().length === 0, 'withdrawing consent clears the buffer');
});
run('zoom is bucketed', () => { check(zoomBucket(17) === 'street' && zoomBucket(11) === 'city' && zoomBucket(5) === 'region', 'buckets'); });
