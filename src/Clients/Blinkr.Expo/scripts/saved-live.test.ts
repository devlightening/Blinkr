import { liveLookupIds, mergeLive, orderSavedByLive, savedLiveStatus } from '../src/savedLive';
import type { BlinkrPlace } from '../src/types';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };
const place = (id: string, state?: BlinkrPlace['currentState']): BlinkrPlace => ({ id, name: `Yer ${id}`, latitude: 37, longitude: 36, category: 'CAFE', currentState: state });
const fresh = { signalType: 'Crowd' as const, signalValue: 'Busy', freshness: 'FRESH', activeSignalCount: 2, observedAtUtc: '2026-09-21T10:00:00Z' };

run('live status: verified, fresh activity only; a stale or empty state says nothing', () => {
  const live = savedLiveStatus(place('a', fresh));
  check(live?.headline === 'Doluluk · Kalabalık' && live.signals === 2 && live.observedAtUtc === '2026-09-21T10:00:00Z', 'fresh crowd');
  check(savedLiveStatus(place('b', { ...fresh, freshness: 'RECENT' })) !== null, 'recent counts');
  check(savedLiveStatus(place('c', { ...fresh, freshness: 'STALE' })) === null, 'stale is not shown as current');
  check(savedLiveStatus(place('d', { ...fresh, freshness: 'NONE' })) === null && savedLiveStatus(place('e', { ...fresh, activeSignalCount: 0 })) === null, 'none or no signals');
  check(savedLiveStatus(place('f')) === null && savedLiveStatus(null) === null && savedLiveStatus(undefined) === null, 'no state');
  check(savedLiveStatus(place('g', { ...fresh, signalType: 'GeneralObservation', signalValue: null }))?.headline === 'Gözlem', 'no value: just the type');
});
run('ordering: live places first, saved order kept otherwise and the input is not mutated', () => {
  const saved = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const live = { c: savedLiveStatus(place('c', fresh)) ?? undefined, b: undefined, d: savedLiveStatus(place('d', fresh)) ?? undefined };
  check(orderSavedByLive(saved, live).map((item) => item.id).join() === 'c,d,a,b', 'live first, then original order');
  check(saved.map((item) => item.id).join() === 'a,b,c,d', 'input untouched');
  check(orderSavedByLive(saved, {}).map((item) => item.id).join() === 'a,b,c,d', 'nothing live: unchanged');
});
run('lookup ids are capped at the server limit', () => {
  const many = Array.from({ length: 30 }, (_, index) => ({ id: `p${index}` }));
  check(liveLookupIds(many).length === 20 && liveLookupIds(many)[0] === 'p0', 'cap 20');
  check(liveLookupIds([]).length === 0, 'empty');
});
run('a failed refresh keeps what was shown; a good one replaces it, including "no longer live"', () => {
  const previous = { a: savedLiveStatus(place('a', fresh)) ?? undefined };
  check(mergeLive(previous, null, ['a']) === previous, 'failure keeps the previous statuses');
  const cooled = mergeLive(previous, [place('a', { ...fresh, freshness: 'STALE' })], ['a']);
  check(cooled.a === undefined, 'a place that cooled down loses its live line');
  const gone = mergeLive(previous, [], ['a']);
  check(gone.a === undefined, 'a place the server no longer returns loses it too');
  const added = mergeLive({}, [place('b', fresh)], ['b']);
  check(added.b?.headline === 'Doluluk · Kalabalık', 'a new live place appears');
});
