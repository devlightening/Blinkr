import * as Location from 'expo-location';

/**
 * Where the device roughly is, for lists around the person (Yakında, Keşfet). A recent last-known fix is used when
 * there is one; otherwise one balanced fix, bounded so a stuck GPS never hangs the screen. Only asked for after the
 * person chose to use their location; the result is never shown or sent anywhere except as a search origin.
 */
export type Origin = { latitude: number; longitude: number };

const LOCATION_TIMEOUT_MS = 12_000;
const LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;

export const LOCATION_TIMEOUT = 'location-timeout';

const withTimeout = <T,>(promise: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(LOCATION_TIMEOUT)), ms);
  promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
});

export const resolveDeviceOrigin = async (): Promise<Origin> => {
  const known = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS, requiredAccuracy: 200 }).catch(() => null);
  if (known) return { latitude: known.coords.latitude, longitude: known.coords.longitude };
  const fix = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), LOCATION_TIMEOUT_MS);
  return { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
};
