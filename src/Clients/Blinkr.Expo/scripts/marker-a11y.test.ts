import { clusterLabel, placePinLabel, signalPinLabel } from '../src/markerA11y';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };
const now = Date.parse('2026-09-24T12:00:00Z');

run('a live place pin reads type, level, name, age and live', () => {
  const label = placePinLabel({ id: 'p', name: 'BİM', latitude: 0, longitude: 0, category: 'SUPERMARKET', currentState: { signalType: 'Queue', signalValue: '5To15', observedAtUtc: new Date(now - 2 * 60_000).toISOString() } } as never, now);
  check(label.startsWith('Bekleme, 5–15 dk, BİM, ') && label.endsWith('canlı'), label);
});
run('a quiet place says its name and category', () => {
  check(placePinLabel({ id: 'p', name: 'Park', latitude: 0, longitude: 0, category: 'PARK' } as never) === 'Park, Park', 'catalog');
});
run('a coordinate signal reads type, level and area', () => {
  const label = signalPinLabel({ postId: 's', latitude: 0, longitude: 0, title: '', signalType: 'Crowd', signalValue: 'Busy', locationName: 'Kızılay' } as never);
  check(label === 'Doluluk, Kalabalık, Kızılay', label);
});
run('clusters invite zooming', () => { check(clusterLabel(4).startsWith('4 '), clusterLabel(4)); });
