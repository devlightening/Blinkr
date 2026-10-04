import { kindFromSignal, liveStateFromCurrent, matchesNowFilters, type LiveKind, type NowFilter } from './live/liveState';
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

/**
 * The "Şimdi" chips (v4 brief §3.1): a Place stays when its ring state matches any active chip; a coordinate signal
 * (no Place, so no opening state) stays when its own type matches Sakin / Etkinlik / Fırsat. No chip = no filter.
 */
export function filterByNow(
  selection: { places: readonly BlinkrPlace[]; signals: readonly CoordinateSignal[] },
  filters: ReadonlySet<NowFilter>,
  now: number,
): { places: BlinkrPlace[]; signals: CoordinateSignal[] } {
  if (filters.size === 0) return { places: [...selection.places], signals: [...selection.signals] };
  const signalKind: Partial<Record<NowFilter, LiveKind>> = { calm: 'calm', event: 'event', deal: 'deal' };
  return {
    places: selection.places.filter((place) => matchesNowFilters(liveStateFromCurrent(place.currentState, now), filters)),
    signals: selection.signals.filter((signal) => {
      const kind = kindFromSignal(signal.signalType, signal.signalValue);
      return [...filters].some((f) => signalKind[f] !== undefined && signalKind[f] === kind);
    }),
  };
}
