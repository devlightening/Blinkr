import { selectMapData, filterBySignalTypes } from '../src/mapSelection';
import { parseTypeFilter, serializeTypeFilter } from '../src/mapTypeFilter';
import type { BlinkrPlace, CoordinateSignal } from '../src/types';

const assert = {
  equal: (actual: unknown, expected: unknown, message = '') => { if (actual !== expected) throw new Error(`${message} expected ${String(expected)}, got ${String(actual)}`); },
  deepEqual: (actual: unknown, expected: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); },
};

const now = Date.parse('2026-09-20T12:00:00Z');
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const inMinutes = (m: number) => new Date(now + m * 60_000).toISOString();

const place = (id: string, extra: Partial<BlinkrPlace> = {}): BlinkrPlace => ({ id, name: id, latitude: 39.9, longitude: 32.8, ...extra });
const signal = (postId: string, createdMinutesAgo: number, expiresAt?: string): CoordinateSignal => ({
  postId, title: postId, textPreview: '', latitude: 39.9, longitude: 32.8, signalType: 'GeneralObservation',
  createdAtUtc: minutesAgo(createdMinutesAgo), expiresAt,
});

const places = [
  place('catalog-only'),
  place('recent-activity', { lastActivityUtc: minutesAgo(10) }),
  place('stale-activity', { lastActivityUtc: minutesAgo(400) }),
  place('live', { lastActivityUtc: minutesAgo(5), currentState: { activeSignalCount: 2, observedAtUtc: minutesAgo(5), expiresAtUtc: inMinutes(60) } }),
  place('live-expired', { currentState: { activeSignalCount: 1, observedAtUtc: minutesAgo(30), expiresAtUtc: minutesAgo(1) } }),
  place('no-active-signals', { currentState: { activeSignalCount: 0, observedAtUtc: minutesAgo(5), expiresAtUtc: inMinutes(60) } }),
];
const signals = [
  signal('fresh', 20),
  signal('old', 300),
  signal('expired', 20, minutesAgo(1)),
];
const ids = (items: Array<{ id?: string; postId?: string }>) => items.map((item) => item.id ?? item.postId).sort();

// Tümü: Places whose last activity (or last observation) is inside the freshness window, plus fresh
// signals. A catalog-only or stale Place is not activity. A Place whose live state has expired but was
// observed recently still counts as recent activity here - the server already drops inactive Places
// from the non-catalog response, and `Canlı` (below) is the layer that requires an unexpired state.
let result = selectMapData('all', places, signals, now);
assert.deepEqual(ids(result.places), ['live', 'live-expired', 'no-active-signals', 'recent-activity']);
assert.deepEqual(ids(result.signals), ['fresh']);

// Canlı: only Places with verified, unexpired active signals - not merely a non-empty signals array.
result = selectMapData('live', places, signals, now);
assert.deepEqual(ids(result.places), ['live']);
assert.deepEqual(ids(result.signals), ['fresh']);

// Yerler: the whole catalog, no signals.
result = selectMapData('places', places, signals, now);
assert.equal(result.places.length, places.length);
assert.equal(result.signals.length, 0);

// Sinyaller: coordinate signals only, still freshness-filtered.
result = selectMapData('signals', places, signals, now);
assert.equal(result.places.length, 0);
assert.deepEqual(ids(result.signals), ['fresh']);

// Inputs are never mutated and results are fresh arrays.
const before = JSON.stringify(places);
selectMapData('places', places, signals, now).places.pop();
assert.equal(JSON.stringify(places), before);

// filterBySignalTypes: an empty/missing selection is "no filter" - every type still shows.
const typedPlaces = [
  place('crowd-place', { currentState: { activeSignalCount: 1, observedAtUtc: minutesAgo(5), expiresAtUtc: inMinutes(60), signalType: 'Crowd' } }),
  place('queue-place', { currentState: { activeSignalCount: 1, observedAtUtc: minutesAgo(5), expiresAtUtc: inMinutes(60), signalType: 'Queue' } }),
  place('typeless-place', { currentState: { activeSignalCount: 1, observedAtUtc: minutesAgo(5), expiresAtUtc: inMinutes(60) } }),
];
const typedSignals = [
  { ...signal('crowd-signal', 5), signalType: 'Crowd' as const },
  { ...signal('event-signal', 5), signalType: 'Event' as const },
];
let selection = { places: typedPlaces, signals: typedSignals };
assert.deepEqual(ids(filterBySignalTypes('all', selection, null).places), ids(typedPlaces));
assert.deepEqual(ids(filterBySignalTypes('all', selection, new Set()).places), ids(typedPlaces));

// A real filter keeps only matching types, and drops a Place with no signal type at all.
let filtered = filterBySignalTypes('all', selection, new Set(['Crowd']));
assert.deepEqual(ids(filtered.places), ['crowd-place']);
assert.deepEqual(ids(filtered.signals), ['crowd-signal']);

// The `places` (Yerler) layer is catalogue browsing, not an activity filter - it is left untouched.
filtered = filterBySignalTypes('places', selection, new Set(['Crowd']));
assert.deepEqual(ids(filtered.places), ids(typedPlaces));

// mapTypeFilter persistence: round-trips, and drops anything that is not a real SignalType.
assert.deepEqual(Array.from(parseTypeFilter('Crowd,Queue')).sort(), ['Crowd', 'Queue']);
assert.deepEqual(Array.from(parseTypeFilter('Crowd,Bogus,Queue')).sort(), ['Crowd', 'Queue']);
assert.deepEqual(Array.from(parseTypeFilter(null)), []);
assert.deepEqual(Array.from(parseTypeFilter('')), []);
assert.equal(serializeTypeFilter(new Set(['Crowd', 'Queue'])).split(',').sort().join(','), 'Crowd,Queue');
assert.equal(serializeTypeFilter(new Set()), '');

console.log('map selection tests passed');
