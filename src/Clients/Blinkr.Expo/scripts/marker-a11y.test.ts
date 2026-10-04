import { clusterLabel, clusterMixLabel, signalPinLabel } from '../src/markerA11y';
import { liveA11yLabel } from '../src/live/liveLabels';
import { liveStateFromCurrent } from '../src/live/liveState';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };
const now = Date.parse('2026-09-24T12:00:00Z');

run('a place pin reads name, state word and age; a quiet one says there is no live info', () => {
  const state = liveStateFromCurrent({ signalType: 'Queue', signalValue: '5To15', freshness: 'FRESH', observedAtUtc: new Date(now - 2 * 60_000).toISOString() }, now);
  const label = liveA11yLabel('BİM', state);
  check(label === 'BİM. Kısa sıra. 2 dk önce.', label);
  const quiet = liveA11yLabel('Park', liveStateFromCurrent(null, now));
  check(quiet.startsWith('Park. Canlı bilgi yok'), quiet);
});
run('a cluster with live places says its mix', () => {
  const label = clusterMixLabel(11, { calm: 6, busy: 3, crowded: 2 });
  check(label.startsWith('11 yer: 6 sakin, 3 hareketli, 2 kalabalık'), label);
  check(clusterMixLabel(4, { calm: 0, busy: 0, crowded: 0 }) === clusterLabel(4), 'no live places: plain cluster label');
});
run('a coordinate signal reads type, level and area', () => {
  const label = signalPinLabel({ postId: 's', latitude: 0, longitude: 0, title: '', signalType: 'Crowd', signalValue: 'Busy', locationName: 'Kızılay' } as never);
  check(label === 'Doluluk, Kalabalık, Kızılay', label);
});
run('clusters invite zooming', () => { check(clusterLabel(4).startsWith('4 '), clusterLabel(4)); });
