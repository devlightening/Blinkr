import { signalLabels } from './presentation';
import { signalValueLabel } from './productPresentation';
import type { BlinkrPlace } from './types';

/**
 * How the places a person saved are doing right now. A saved place is a watch list: the point is to know, before going,
 * whether it is busy. Only verified, fresh activity is shown; a stale state is never dressed up as current.
 */
export type SavedLive = {
  /** "Doluluk · Kalabalık" */
  headline: string;
  observedAtUtc: string | null;
  signals: number;
};

export const savedLiveStatus = (place: BlinkrPlace | null | undefined): SavedLive | null => {
  const state = place?.currentState;
  if (!state || (state.activeSignalCount ?? 0) <= 0) return null;
  const freshness = state.freshness?.toUpperCase();
  if (freshness !== 'FRESH' && freshness !== 'RECENT') return null;
  const type = state.signalType ?? 'GeneralObservation';
  const value = signalValueLabel(type, state.signalValue);
  return {
    headline: value ? `${signalLabels[type] ?? 'Sinyal'} · ${value}` : (signalLabels[type] ?? 'Sinyal'),
    observedAtUtc: state.observedAtUtc ?? null,
    signals: state.activeSignalCount ?? 1,
  };
};

/** Places with live activity first, otherwise the saved order is kept (stable). */
export const orderSavedByLive = <T extends { id: string }>(saved: T[], live: Record<string, SavedLive | undefined>): T[] =>
  saved
    .map((item, index) => ({ item, index, isLive: Boolean(live[item.id]) }))
    .sort((a, b) => Number(b.isLive) - Number(a.isLive) || a.index - b.index)
    .map(({ item }) => item);

/** At most 20 ids per request (the server's limit); a saved list is capped far below that anyway. */
export const liveLookupIds = (saved: { id: string }[]) => saved.slice(0, 20).map((item) => item.id);

/** Keeps the previous statuses when a refresh fails, so a network blip never blanks what was shown. */
export const mergeLive = (previous: Record<string, SavedLive | undefined>, places: BlinkrPlace[] | null, asked: string[]): Record<string, SavedLive | undefined> => {
  if (places === null) return previous;
  const next: Record<string, SavedLive | undefined> = { ...previous };
  const byId = new Map(places.map((place) => [place.id, place]));
  for (const id of asked) next[id] = savedLiveStatus(byId.get(id)) ?? undefined;
  return next;
};
