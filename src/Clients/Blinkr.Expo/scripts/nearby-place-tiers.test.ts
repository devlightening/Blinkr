import { splitNearbyPlaces } from '../src/nearbyPlaceTiers';
import type { BlinkrPlace } from '../src/types';

const place = (id: string, distanceMeters: number, category = 'OTHER'): BlinkrPlace => ({
  category,
  currentState: {
    activeSignalCount: 0,
    confidence: 'LOW',
    confidenceValue: 0,
    freshness: 'Fresh',
  },
  displayAddress: null,
  distanceMeters,
  id,
  latitude: 39,
  longitude: 32,
  name: id,
});

const assertEqual = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) throw new Error(`${message} Expected ${String(expected)}, received ${String(actual)}`);
};

{
  const result = splitNearbyPlaces([place('nearest-352m', 352)]);
  assertEqual(result.primary.length, 1, '352m place must be primary.');
  assertEqual(result.primary[0].id, 'nearest-352m', '352m place should be shown.');
}

{
  const result = splitNearbyPlaces([
    place('mosque-352m', 352, 'MOSQUE'),
    place('park-365m', 365, 'PARK'),
    place('site-1300m', 1300),
  ]);
  assertEqual(result.primary.length, 2, '352m and 365m places must be primary.');
  assertEqual(result.primary[0].id, 'mosque-352m', 'Primary order must be distance ascending.');
  assertEqual(result.primary[1].id, 'park-365m', 'Primary order must keep nearer park before far places.');
  assertEqual(result.extended.length, 1, '1300m place must be extended.');
  assertEqual(result.extended[0].id, 'site-1300m', 'Extended place mismatch.');
}

console.log('nearby place tier tests passed');
