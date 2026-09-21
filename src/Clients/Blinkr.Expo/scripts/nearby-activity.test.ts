import { ACTIVITY_LIMIT, boundsAround, buildNearbyActivity, filterActivity } from '../src/nearbyActivity';
import { distanceMeters } from '../src/nearbyRequestOwnership';
import type { BlinkrPlace, CoordinateSignal, UnifiedMapResponse } from '../src/types';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const now = Date.parse('2026-09-21T12:00:00Z');
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const minutesAhead = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
const origin = { latitude: 37.0742, longitude: 36.2478 };
// ~111 m per 0.001 degrees of latitude
const at = (metersNorth: number) => ({ latitude: origin.latitude + metersNorth / 111_320, longitude: origin.longitude });

const place = (id: string, metersNorth: number, over: Partial<BlinkrPlace> = {}): BlinkrPlace => ({
  id,
  name: `Yer ${id}`,
  latitude: at(metersNorth).latitude,
  longitude: at(metersNorth).longitude,
  currentState: { signalType: 'Crowd', signalValue: 'Busy', freshness: 'FRESH', observedAtUtc: minutesAgo(5), expiresAtUtc: minutesAhead(60), activeSignalCount: 2 },
  ...over,
});
const signal = (id: string, metersNorth: number, over: Partial<CoordinateSignal> = {}): CoordinateSignal => ({
  postId: id,
  title: `Sinyal ${id}`,
  textPreview: '',
  latitude: at(metersNorth).latitude,
  longitude: at(metersNorth).longitude,
  signalType: 'GeneralObservation',
  createdAtUtc: minutesAgo(10),
  expiresAt: minutesAhead(60),
  ...over,
});
const build = (response: Partial<UnifiedMapResponse>) => buildNearbyActivity({ places: [], signals: [], ...response }, origin, now);

run('catalog places without live state never appear', () => {
  const items = build({ places: [place('a', 100, { currentState: null }), place('b', 100, { currentState: { freshness: 'NONE' } })] });
  check(items.length === 0, 'places without an active state must be skipped');
});
run('STALE and expired place state is skipped, FRESH and RECENT are kept', () => {
  const items = build({ places: [
    place('stale', 100, { currentState: { signalType: 'Crowd', freshness: 'STALE', expiresAtUtc: minutesAhead(30) } }),
    place('expired', 100, { currentState: { signalType: 'Crowd', freshness: 'FRESH', expiresAtUtc: minutesAgo(1) } }),
    place('recent', 100, { currentState: { signalType: 'Queue', freshness: 'RECENT', observedAtUtc: minutesAgo(50), expiresAtUtc: minutesAhead(30) } }),
    place('fresh', 200),
  ] });
  check(items.map((i) => i.key).join() === 'place:fresh,place:recent', `unexpected ${items.map((i) => i.key).join()}`);
});
run('coordinate signals older than 3 hours or expired are skipped', () => {
  const items = build({ signals: [signal('old', 100, { createdAtUtc: minutesAgo(200) }), signal('gone', 100, { expiresAt: minutesAgo(1) }), signal('ok', 100)] });
  check(items.length === 1 && items[0].key === 'signal:ok', 'only the fresh signal may remain');
});
run('anything beyond the 1.5 km discovery radius is dropped', () => {
  const items = build({ places: [place('near', 1400), place('far', 1700)] });
  check(items.length === 1 && items[0].key === 'place:near', 'radius filter');
});
run('distance is measured from the device, not taken from the server row', () => {
  const items = build({ places: [place('x', 500, { distanceMeters: 5 })] });
  check(Math.abs(items[0].distanceMeters - distanceMeters(origin, items[0].place!)) < 0.01 && items[0].distanceMeters > 400, 'server distanceMeters must be ignored');
});
run('a fresher report outranks a nearer stale one; within a bucket the closest wins', () => {
  const items = build({ places: [
    place('older-near', 50, { currentState: { signalType: 'Crowd', freshness: 'RECENT', observedAtUtc: minutesAgo(90), expiresAtUtc: minutesAhead(30) } }),
    place('fresh-far', 900),
    place('fresh-near', 300),
  ] });
  check(items.map((i) => i.key).join() === 'place:fresh-near,place:fresh-far,place:older-near', `unexpected ${items.map((i) => i.key).join()}`);
});
run('only place state can be verified live', () => {
  const items = build({ places: [place('p', 100)], signals: [signal('s', 100)] });
  check(items.find((i) => i.kind === 'place')!.verifiedLive === true, 'place state is server verified');
  check(items.find((i) => i.kind === 'signal')!.verifiedLive === false, 'coordinate signals are never verified live');
});
run('the list is capped and deterministic', () => {
  const many = Array.from({ length: 60 }, (_, index) => place(`p${index}`, 100 + index));
  const first = build({ places: many }); const second = build({ places: [...many].reverse() });
  check(first.length === ACTIVITY_LIMIT, 'limit');
  check(first.map((i) => i.key).join() === second.map((i) => i.key).join(), 'input order must not change the ranking');
});
run('filters', () => {
  const items = build({ places: [place('crowd', 100), place('queue', 120, { currentState: { signalType: 'Queue', freshness: 'FRESH', observedAtUtc: minutesAgo(3), expiresAtUtc: minutesAhead(30) } })], signals: [signal('obs', 140)] });
  check(filterActivity(items, 'all').length === 3, 'all');
  check(filterActivity(items, 'live').length === 2, 'live = places only');
  check(filterActivity(items, 'crowd').map((i) => i.key).join() === 'place:crowd', 'crowd');
  check(filterActivity(items, 'queue').map((i) => i.key).join() === 'place:queue', 'queue');
  check(filterActivity(items, 'other').map((i) => i.key).join() === 'signal:obs', 'other');
});
run('boundsAround contains the whole search circle', () => {
  const box = boundsAround(origin, 1500);
  const north = { latitude: origin.latitude + 1500 / 111_320, longitude: origin.longitude };
  check(north.latitude <= box.maxLat + 1e-9 && box.minLat < origin.latitude && box.minLng < origin.longitude && box.maxLng > origin.longitude, 'box must contain the circle');
  check(distanceMeters({ latitude: box.minLat, longitude: origin.longitude }, { latitude: box.maxLat, longitude: origin.longitude }) > 2900, 'box spans at least the diameter');
});
