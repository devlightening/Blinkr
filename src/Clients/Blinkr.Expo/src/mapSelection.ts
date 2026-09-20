import { isFresh } from './productPresentation';
import type { BlinkrPlace, CoordinateSignal } from './types';

export type MapLayer = 'all' | 'live' | 'places' | 'signals';

/**
 * Which Places and coordinate signals a map layer shows. `places` and `signals` stay two separate
 * collections - a Place is never turned into a signal or the other way round.
 *
 * Freshness uses the same rule the map request is built on (`isFresh`, 180 min window, honouring
 * the server-provided expiry); it is not a client-invented cut-off.
 */
export function selectMapData(
  layer: MapLayer,
  places: readonly BlinkrPlace[],
  signals: readonly CoordinateSignal[],
  now: number,
): { places: BlinkrPlace[]; signals: CoordinateSignal[] } {
  const freshSignals = layer === 'places'
    ? []
    : signals.filter((signal) => isFresh(signal.createdAtUtc, signal.expiresAt, now));

  if (layer === 'signals') return { places: [], signals: freshSignals };
  if (layer === 'places') return { places: [...places], signals: [] };
  if (layer === 'live') {
    return {
      places: places.filter((place) => (place.currentState?.activeSignalCount ?? 0) > 0
        && isFresh(place.currentState?.observedAtUtc, place.currentState?.expiresAtUtc, now)),
      signals: freshSignals,
    };
  }
  return {
    places: places.filter((place) => isFresh(place.lastActivityUtc ?? place.currentState?.observedAtUtc, null, now)),
    signals: freshSignals,
  };
}
