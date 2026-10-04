import { tx } from './i18n/tx';
import { formatAge, formatCategory, signalLabels } from './presentation';
import { signalValueLabel } from './productPresentation';
import type { CoordinateSignal } from './types';

/** What a screen reader says for a coordinate-signal pin (places read `liveA11yLabel`, plan-devam G6). */
export function signalPinLabel(signal: CoordinateSignal) {
  return [
    signalLabels[signal.signalType],
    signalValueLabel(signal.signalType, signal.signalValue),
    signal.locationName || tx('common:approxArea', 'Yaklaşık alan'),
    signal.createdAtUtc ? formatAge(signal.createdAtUtc) : null,
  ].filter(Boolean).join(', ');
}

export const clusterLabel = (count: number) => tx('map:a11y.cluster', '{{count}} sinyal ve yer, yakınlaştır', { count });

/** A cluster that holds live places says its mix: "11 yer: 6 sakin, 3 hareketli, 2 kalabalık. Yakınlaştır". */
export const clusterMixLabel = (count: number, mix: { calm: number; busy: number; crowded: number }) =>
  mix.calm + mix.busy + mix.crowded === 0 ? clusterLabel(count)
    : tx('map:a11y.clusterMix', '{{count}} yer: {{calm}} sakin, {{busy}} hareketli, {{crowded}} kalabalık. Yakınlaştır', { count, ...mix });
