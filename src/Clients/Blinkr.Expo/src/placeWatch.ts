import { tx } from './i18n/tx';
import type { CurrentPlaceState } from './types';

/** D-038 "Haber ver". Same values as the server's PlaceWatch conditions. */
export type WatchCondition = 'calm' | 'open' | 'update';
export type PlaceWatchInfo = { placeId: string; placeName: string; condition: WatchCondition; createdAtUtc: string; expiresAtUtc: string };

export const MAX_WATCHES = 5;

export const conditionLabel = (condition: WatchCondition) => ({
  calm: tx('map:watch.calm', 'Sakinleşince'),
  open: tx('map:watch.open', 'Açılınca'),
  update: tx('map:watch.update', 'Yeni bilgi gelince'),
}[condition]);

/**
 * Which conditions make sense for the place right now: "Açılınca" only while it is reported closed, "Sakinleşince"
 * unless it is already known to be calm. "Yeni bilgi gelince" always.
 */
export const conditionsFor = (state: Pick<CurrentPlaceState, 'signalType' | 'signalValue'> | null | undefined): WatchCondition[] => {
  const type = state?.signalType ?? null;
  // Case-insensitive: the app sends 'Calm', older clients 'CALM' (legacy 'EMPTY' = calm).
  const value = state?.signalValue?.trim().toUpperCase() ?? null;
  const closed = type === 'TemporaryStatus' && value === 'CLOSED';
  const calm = (type === 'Crowd' && (value === 'CALM' || value === 'EMPTY')) || (type === 'Queue' && value === 'NONE');
  const list: WatchCondition[] = [];
  if (!calm && !closed) list.push('calm');
  if (closed) list.push('open');
  list.push('update');
  return list;
};

/** "11 sa kaldı" / "40 dk kaldı" until the watch ends by itself. */
export const watchRemaining = (expiresAtUtc: string, now = Date.now()) => {
  const minutes = Math.max(0, Math.round((Date.parse(expiresAtUtc) - now) / 60_000));
  return minutes >= 60
    ? tx('map:watch.hoursLeft', '{{n}} sa kaldı', { n: Math.round(minutes / 60) })
    : tx('map:watch.minutesLeft', '{{n}} dk kaldı', { n: Math.max(1, minutes) });
};
