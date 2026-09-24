import { isLive } from './freshness';
import { tx } from './i18n/tx';
import { formatAge, formatCategory, signalLabels } from './presentation';
import { signalValueLabel } from './productPresentation';
import type { BlinkrPlace, CoordinateSignal } from './types';

/**
 * What a screen reader says for a map pin (plan-devam G6): "Bekleme, 5–15 dk, BİM, 2 dk önce, canlı". A place without a
 * current state says its name and category. Pure: labels come from the (translated) catalogs.
 */
export function placePinLabel(place: BlinkrPlace, now = Date.now()) {
  const state = place.currentState;
  if (!state?.signalType) return [place.name, formatCategory(place.category)].filter(Boolean).join(', ');
  // Place state is server-computed from verified signals only, so a fresh one is live.
  const live = isLive(state.observedAtUtc, state.expiresAtUtc, true, now);
  return [
    signalLabels[state.signalType],
    signalValueLabel(state.signalType, state.signalValue),
    place.name,
    state.observedAtUtc ? formatAge(state.observedAtUtc) : null,
    live ? tx('common:live', 'Canlı').toLocaleLowerCase() : null,
  ].filter(Boolean).join(', ');
}

export function signalPinLabel(signal: CoordinateSignal) {
  return [
    signalLabels[signal.signalType],
    signalValueLabel(signal.signalType, signal.signalValue),
    signal.locationName || tx('common:approxArea', 'Yaklaşık alan'),
    signal.createdAtUtc ? formatAge(signal.createdAtUtc) : null,
  ].filter(Boolean).join(', ');
}

export const clusterLabel = (count: number) => tx('map:a11y.cluster', '{{count}} sinyal ve yer, yakınlaştır', { count });
