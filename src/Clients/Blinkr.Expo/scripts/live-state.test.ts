import {
  clusterMix, compareByLiveness, computeLiveState, freshnessFromAge, ageParts, kindFromSignal, levelFromSignal,
  liveRenderKey, liveStateFromCurrent, matchesNowFilters, openByHours, shouldPulse, type LiveSignal, type NowFilter,
} from '../src/live/liveState';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const eq = (actual: unknown, expected: unknown, message: string) => check(JSON.stringify(actual) === JSON.stringify(expected), `${message}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const NOW = Date.parse('2026-10-04T12:00:00Z');
const ago = (min: number) => new Date(NOW - min * 60000).toISOString();
const later = (min: number) => new Date(NOW + min * 60000).toISOString();
const sig = (p: Partial<LiveSignal> & { value: string; min: number; by: string }): LiveSignal => ({
  type: p.type ?? 'Crowd', value: p.value, atUtc: ago(p.min), reporterId: p.by, verified: p.verified ?? true,
});

run('backend value names: Calm/Moderate/Busy (Busy = crowded), None/5To15/Over15, legacy upper case', () => {
  eq(levelFromSignal({ type: 'Crowd', value: 'Calm' }), 0, 'Calm');
  eq(levelFromSignal({ type: 'Crowd', value: 'Moderate' }), 1, 'Moderate');
  eq(levelFromSignal({ type: 'Crowd', value: 'Busy' }), 2, 'Busy is crowded');
  eq(levelFromSignal({ type: 'crowd', value: 'BUSY' }), 2, 'legacy BUSY');
  eq(levelFromSignal({ type: 'Crowd', value: 'EMPTY' }), 0, 'legacy EMPTY');
  eq(levelFromSignal({ type: 'Queue', value: 'None' }), 0, 'None');
  eq(levelFromSignal({ type: 'Queue', value: '5To15' }), 1, '5To15');
  eq(levelFromSignal({ type: 'Queue', value: 'Over15' }), 2, 'Over15');
  eq(levelFromSignal({ type: 'Queue', value: 'LONG' }), 2, 'legacy LONG');
  eq(levelFromSignal({ type: 'Crowd', value: 'nonsense' }), null, 'unknown value is no vote');
});

run('other types map to a ring kind, or to nothing', () => {
  eq(kindFromSignal('TemporaryStatus', 'Closed'), 'closed', 'closed');
  eq(kindFromSignal('TemporaryStatus', 'Open'), 'info', 'open');
  eq(kindFromSignal('TemporaryStatus', 'Notice'), 'unknown', 'notice');
  eq(kindFromSignal('Event', 'Started'), 'event', 'event');
  eq(kindFromSignal('Event', 'Ended'), null, 'ended event');
  eq(kindFromSignal('Offer', 'Available'), 'deal', 'offer');
  eq(kindFromSignal('NewOpening', 'Opened'), 'deal', 'new opening');
  eq(kindFromSignal('GeneralObservation', null), null, 'observation has no state');
});

run('freshness curve: full to 15 min, 0.7 at 1 h, 0.2 at 3 h, empty after', () => {
  eq(freshnessFromAge(0), 1, '0');
  eq(freshnessFromAge(15), 1, '15');
  check(Math.abs(freshnessFromAge(60) - 0.7) < 1e-9, '60');
  check(Math.abs(freshnessFromAge(180) - 0.2) < 1e-9, '180');
  eq(freshnessFromAge(181), 0, '181');
});

run('server summary -> ring: verified, unexpired, within 3 h; anything else is no live info', () => {
  const st = liveStateFromCurrent({ signalType: 'Crowd', signalValue: 'Calm', freshness: 'FRESH', observedAtUtc: ago(4), expiresAtUtc: later(50), activeSignalCount: 3 }, NOW);
  eq([st.kind, st.source, st.confirmations, Math.round(st.ageMinutes ?? -1)], ['calm', 'live', 3, 4], 'fresh calm');
  check(shouldPulse(st), 'pulses when fresh');
  eq(liveStateFromCurrent({ signalType: 'Crowd', signalValue: 'Busy', freshness: 'RECENT', observedAtUtc: ago(40), activeSignalCount: 1 }, NOW).kind, 'crowded', 'Busy is crowded');
  eq(liveStateFromCurrent({ signalType: 'Crowd', signalValue: 'Calm', freshness: 'FRESH', observedAtUtc: ago(4), expiresAtUtc: ago(1) }, NOW).source, 'none', 'expired');
  eq(liveStateFromCurrent({ signalType: 'Crowd', signalValue: 'Calm', freshness: 'RECENT', observedAtUtc: ago(200) }, NOW).source, 'none', 'older than 3 h is not live');
  eq(liveStateFromCurrent({ signalType: 'Crowd', signalValue: 'Calm', freshness: 'STALE', observedAtUtc: ago(20) }, NOW).source, 'none', 'server says stale');
  eq(liveStateFromCurrent({ signalType: null, freshness: 'NONE', activeSignalCount: 0 }, NOW).kind, 'unknown', 'no state');
  eq(liveStateFromCurrent(null, NOW).isStale, true, 'missing state is stale');
  eq(liveStateFromCurrent({ signalType: 'GeneralObservation', signalValue: null, freshness: 'FRESH', observedAtUtc: ago(2) }, NOW).source, 'none', 'observation alone has no state');
  const hours = liveStateFromCurrent(null, NOW, true);
  eq([hours.kind, hours.source], ['info', 'hours'], 'falls back to hours (dashed)');
});

run('client fallback: verified only, one vote per person, fresh beats old, ties go cautious', () => {
  let st = computeLiveState([sig({ value: 'Calm', min: 4, by: 'a' })], NOW);
  eq([st.kind, st.source, st.confirmations], ['calm', 'live', 1], 'single fresh');
  eq(computeLiveState([sig({ value: 'Busy', min: 2, by: 'a', verified: false })], NOW).source, 'none', 'unverified');
  st = computeLiveState([sig({ value: 'Busy', min: 40, by: 'a' }), sig({ value: 'Calm', min: 5, by: 'a' })], NOW);
  eq([st.kind, st.confirmations], ['calm', 1], 'same person newest');
  st = computeLiveState([sig({ value: 'Busy', min: 120, by: 'a' }), sig({ value: 'Calm', min: 3, by: 'b' }), sig({ value: 'Calm', min: 10, by: 'c' })], NOW);
  eq([st.kind, st.confirmations], ['calm', 3], 'fresh votes win');
  eq(computeLiveState([sig({ value: 'Calm', min: 10, by: 'a' }), sig({ value: 'Busy', min: 10, by: 'b' })], NOW).kind, 'crowded', 'tie -> cautious');
  eq(computeLiveState([sig({ value: 'Calm', min: 200, by: 'a' })], NOW, true).source, 'hours', 'old vote -> hours');
  eq(computeLiveState([], NOW, false).kind, 'closed', 'closed by hours');
  const expired = { ...sig({ value: 'Busy', min: 70, by: 'a' }), expiresAtUtc: ago(10) };
  eq(computeLiveState([expired], NOW).source, 'none', 'a 70 min crowd vote past its 60 min lifetime is no vote');
});

run('a recent "closed" status beats crowd votes for 90 minutes', () => {
  eq(computeLiveState([sig({ type: 'TemporaryStatus', value: 'Closed', min: 20, by: 'a' }), sig({ value: 'Busy', min: 30, by: 'b' })], NOW).kind, 'closed', 'recent closed');
  eq(computeLiveState([sig({ type: 'TemporaryStatus', value: 'Closed', min: 120, by: 'a' }), sig({ value: 'Calm', min: 30, by: 'b' })], NOW).kind, 'calm', 'old closed');
});

run('opening hours, including past midnight; complex formats are unknown', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 4, h, m);
  eq(openByHours('08:00-23:00', at(12)), true, 'open');
  eq(openByHours('08:00-23:00', at(7, 59)), false, 'before');
  eq(openByHours('18:00-02:00', at(1)), true, 'past midnight');
  eq(openByHours('18:00-02:00', at(3)), false, 'after');
  eq(openByHours('Mo-Fr 08:00-18:00', at(12)), null, 'complex');
  eq(openByHours(null, at(12)), null, 'missing');
});

run('age parts, cluster mix, pulse window', () => {
  eq(ageParts(4), { unit: 'min', n: 4 }, '4 min');
  eq(ageParts(125), { unit: 'hour', n: 2 }, '2 h');
  eq(ageParts(60 * 50), { unit: 'day', n: 2 }, '2 d');
  const mix = clusterMix([
    computeLiveState([sig({ value: 'Calm', min: 1, by: 'a' })], NOW),
    computeLiveState([sig({ value: 'Moderate', min: 1, by: 'a' })], NOW),
    computeLiveState([sig({ value: 'Busy', min: 1, by: 'a' })], NOW),
    computeLiveState([], NOW),
  ]);
  eq(mix, { calm: 1, busy: 1, crowded: 1, other: 1 }, 'mix');
  check(!shouldPulse(computeLiveState([sig({ value: 'Calm', min: 25, by: 'a' })], NOW)), 'no pulse after 15 min');
});

run('"Şimdi" filters: any active filter matches; closed and no-info never count as open', () => {
  const calm = liveStateFromCurrent({ signalType: 'Crowd', signalValue: 'Calm', freshness: 'FRESH', observedAtUtc: ago(3) }, NOW);
  const closed = liveStateFromCurrent({ signalType: 'TemporaryStatus', signalValue: 'Closed', freshness: 'FRESH', observedAtUtc: ago(3) }, NOW);
  const event = liveStateFromCurrent({ signalType: 'Event', signalValue: 'Started', freshness: 'FRESH', observedAtUtc: ago(3) }, NOW);
  const none = liveStateFromCurrent(null, NOW);
  const f = (...ids: NowFilter[]) => new Set<NowFilter>(ids);
  check(matchesNowFilters(none, f()), 'no filter passes all');
  check(matchesNowFilters(calm, f('open')) && matchesNowFilters(event, f('open')), 'open');
  check(!matchesNowFilters(closed, f('open')) && !matchesNowFilters(none, f('open')), 'closed/none not open');
  check(matchesNowFilters(event, f('calm', 'event')) && !matchesNowFilters(calm, f('event')), 'OR across filters');
});

run('render key changes with the ring step only; lists put fresh live first, then distance', () => {
  const at = (min: number) => liveStateFromCurrent({ signalType: 'Crowd', signalValue: 'Calm', freshness: 'FRESH', observedAtUtc: ago(min) }, NOW);
  eq(liveRenderKey(at(2)), liveRenderKey(at(14)), 'same step within 15 min');
  check(liveRenderKey(at(2)) !== liveRenderKey(at(150)), 'later step differs');
  const rows = [
    { id: 'near-none', state: liveStateFromCurrent(null, NOW), distanceMeters: 10 },
    { id: 'far-fresh', state: at(3), distanceMeters: 900 },
    { id: 'near-old', state: at(150), distanceMeters: 50 },
  ].sort(compareByLiveness).map((r) => r.id);
  eq(rows, ['far-fresh', 'near-old', 'near-none'], 'order');
});
