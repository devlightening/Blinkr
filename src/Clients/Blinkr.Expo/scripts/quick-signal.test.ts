import {
  NOTE_MAX, buildPostBody, canSubmit, initialQuick, quickReducer, quickStateFor, tileFor, TILE_TYPE, TILE_VALUES, type QuickTile,
} from '../src/live/quickSignal';
import { SIGNAL_CATALOG } from '../src/signalCatalog';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const eq = (actual: unknown, expected: unknown, message: string) => check(JSON.stringify(actual) === JSON.stringify(expected), `${message}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const PLACE = { placeId: 'p_123', name: 'Soulmate Kafe' };
const FIX = { latitude: 37.07, longitude: 36.24, accuracyMeters: 12 };
const SERVER_TYPES = ['GeneralObservation', 'Crowd', 'Queue', 'Event', 'Offer', 'NewOpening', 'TemporaryStatus'];

run('two taps: tile + value -> ready', () => {
  let s = quickReducer(initialQuick, { t: 'pickTile', tile: 'Crowd' });
  eq([s.step, canSubmit(s)], ['value', false], 'tile only');
  s = quickReducer(s, { t: 'pickValue', value: 'Calm' });
  eq([s.step, canSubmit(s)], ['ready', true], 'tile + value');
});

run('invalid values are ignored; changing tile clears the value, re-tapping keeps it', () => {
  const ready = quickReducer(quickReducer(initialQuick, { t: 'pickTile', tile: 'Crowd' }), { t: 'pickValue', value: 'Calm' });
  check(quickReducer(ready, { t: 'pickValue', value: 'Crowded' }) === ready, 'Crowded is not a backend value');
  eq(quickReducer(ready, { t: 'pickTile', tile: 'Crowd' }).value, 'Calm', 'same tile');
  const queue = quickReducer(ready, { t: 'pickTile', tile: 'Queue' });
  eq([queue.value, queue.step], [null, 'value'], 'other tile');
});

run('note rules: required tiles need >= 5 chars; observation needs a note or media; short optional notes block', () => {
  let s = quickReducer(initialQuick, { t: 'pickTile', tile: 'Event' });
  eq(s.step, 'note', 'event needs a note');
  eq(quickReducer(s, { t: 'setNote', note: 'Maç' }).step, 'note', '3 chars is below the server minimum');
  eq(quickReducer(s, { t: 'setNote', note: 'Maç 18:00' }).step, 'ready', 'note ok');
  s = quickReducer(initialQuick, { t: 'pickTile', tile: 'Observation' });
  eq(s.step, 'note', 'observation empty');
  eq(quickReducer(s, { t: 'setMediaCount', count: 1 }).step, 'ready', 'a photo is enough');
  const calm = quickReducer(quickReducer(initialQuick, { t: 'pickTile', tile: 'Crowd' }), { t: 'pickValue', value: 'Calm' });
  eq(quickReducer(calm, { t: 'setNote', note: 'iyi' }).step, 'note', 'optional note under 5 chars would be rejected');
});

run('limits: note length and media count', () => {
  eq(quickReducer(initialQuick, { t: 'setNote', note: 'x'.repeat(400) }).note.length, NOTE_MAX, 'note max');
  eq(quickReducer(initialQuick, { t: 'setMediaCount', count: 9 }).mediaCount, 4, 'media max');
});

run('every tile maps to a server type, and every offered value is a backend catalogue value', () => {
  for (const tile of Object.keys(TILE_TYPE) as QuickTile[]) {
    check(SERVER_TYPES.includes(TILE_TYPE[tile]), `${tile} -> ${TILE_TYPE[tile]}`);
    const options = SIGNAL_CATALOG[TILE_TYPE[tile]].options?.map((o) => o.value) ?? [];
    for (const value of TILE_VALUES[tile]) check(options.includes(value), `${tile}: ${value} is in signalCatalog`);
  }
});

run('body: real enum names, a value for every type but observation, exact position only as evidence', () => {
  let s = quickReducer(quickReducer(initialQuick, { t: 'pickTile', tile: 'Crowd' }), { t: 'pickValue', value: 'Busy' });
  s = quickReducer(s, { t: 'setDisclosure', d: 'AnonymousMap' });
  const body = buildPostBody(s, PLACE, FIX);
  eq([body.signalType, body.signalValue, body.identityDisclosure, body.locationPrecision, body.audienceType, body.placeId, body.content],
    ['Crowd', 'Busy', 'AnonymousMap', 'PlaceCenter', 'Public', 'p_123', ''], 'crowd body');
  const event = buildPostBody(quickReducer(quickReducer(initialQuick, { t: 'pickTile', tile: 'Event' }), { t: 'setNote', note: '  Konser 21:00 ' }), PLACE, FIX);
  eq([event.signalType, event.signalValue, event.content], ['Event', 'Started', 'Konser 21:00'], 'event auto value, trimmed note');
  const open = buildPostBody(quickReducer(quickReducer(initialQuick, { t: 'pickTile', tile: 'Open' }), { t: 'pickValue', value: 'Closed' }), PLACE, FIX);
  eq([open.signalType, open.signalValue], ['TemporaryStatus', 'Closed'], 'open/closed');
  const obs = buildPostBody(quickReducer(quickReducer(initialQuick, { t: 'pickTile', tile: 'Observation' }), { t: 'setNote', note: 'Teras açık' }), PLACE, FIX);
  eq([obs.signalType, obs.signalValue], ['GeneralObservation', null], 'observation');
  check(!('media' in body), 'media is attached by the outbox');
  let threw = false;
  try { buildPostBody(initialQuick, PLACE, FIX); } catch (e) { threw = /QUICK_SIGNAL_NOT_READY/.test(String(e)); }
  check(threw, 'not ready -> throws');
});

run('"Hâlâ böyle" / "Değişti" start on the right tile and value', () => {
  eq(tileFor('TemporaryStatus', 'Closed'), 'Open', 'closed status');
  eq(tileFor('TemporaryStatus', 'Notice'), 'Temp', 'notice');
  eq(tileFor('Offer', 'Available'), 'Offer', 'offer');
  const again = quickStateFor('Crowd', 'BUSY');
  eq([again.tile, again.value, again.step], ['Crowd', 'Busy', 'ready'], 'same value, case-insensitive');
  eq(quickStateFor('Queue', 'weird').step, 'value', 'unknown value -> pick again');
  eq(quickStateFor(null, null), initialQuick, 'nothing');
});
