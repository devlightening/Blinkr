import type { BlinkrPlace, ComposerArea } from '../src/types';
// UI-only scenarios. Real catalog acceptance is exercised through the Gateway script.
export const nearby: BlinkrPlace[] = [
  { id: 'mosque', name: 'Hz. Ali Camii', category: 'MOSQUE', distanceMeters: 352, latitude: 39.9, longitude: 32.8 },
  { id: 'park', name: 'Şehit Mahmut Kavak Parkı', category: 'PARK', distanceMeters: 365, latitude: 39.9, longitude: 32.8 },
  { id: 'cafe', name: 'Mahalle Kahvesi', category: 'CAFE', distanceMeters: 420, latitude: 39.9, longitude: 32.8 },
  { id: 'branch-a', name: 'BİM', category: 'SUPERMARKET', distanceMeters: 500, latitude: 39.9, longitude: 32.8 },
  { id: 'branch-b', name: 'BİM', category: 'SUPERMARKET', distanceMeters: 1300, latitude: 39.9, longitude: 32.8 },
];
export const area: ComposerArea = { name: 'Etimesgut civarı', region: { latitude: 39.9, longitude: 32.8, latitudeDelta: .01, longitudeDelta: .01 }, source: 'device', accuracyMeters: 22 };
