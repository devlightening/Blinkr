import { isFresh } from './productPresentation';
import type { BlinkrPlace, CoordinateSignal, SignalType } from './types';

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

/**
 * Filters an already-selected map result down to specific signal types (04 §1.2's "tip çipleri":
 * Doluluk, Bekleme, Geçici durum, Etkinlik, Fırsat, Yeni açılış, Gözlem — the plan's own "Trafik"/
 * "Hava" chips are not applied here, Blinkr's SignalType enum has no such values and this never
 * invents one). An empty or missing selection means no filter — every type shows, same as before this
 * existed. A catalogue Place with no active signal type is dropped once a filter is active, since there
 * is nothing to say it matches; the `places` layer (which lists the whole catalogue regardless of
 * activity) is left untouched, since the filter is about activity type, not catalogue browsing.
 */
export function filterBySignalTypes(
  layer: MapLayer,
  selection: { places: readonly BlinkrPlace[]; signals: readonly CoordinateSignal[] },
  activeTypes: ReadonlySet<SignalType> | null | undefined,
): { places: BlinkrPlace[]; signals: CoordinateSignal[] } {
  if (!activeTypes || activeTypes.size === 0 || layer === 'places') {
    return { places: [...selection.places], signals: [...selection.signals] };
  }
  return {
    places: selection.places.filter((place) => {
      const type = place.currentState?.signalType;
      return type ? activeTypes.has(type) : false;
    }),
    signals: selection.signals.filter((signal) => activeTypes.has(signal.signalType)),
  };
}
