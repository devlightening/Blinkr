import type { BlinkrPlace } from './types';

/**
 * Pure logic of the map's "where to?" search: Turkish-insensitive matching, ranking, match highlighting,
 * category shortcuts and the recent-search list. No React, no network, so it is fully testable.
 */

const FOLD: Record<string, string> = { 'ı': 'i', 'İ': 'i', 'I': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };

/**
 * Folds text to a plain lowercase ASCII-ish form so "ECZANESİ", "eczanesi" and "Eczanesı" all compare equal.
 * The result always has the same length as the input, so match positions map back onto the original text.
 */
export const foldSearchText = (text: string) =>
  Array.from(text, (char) => FOLD[char] ?? char.toLowerCase().slice(0, 1)).join('');

export type RankedPlace = { place: BlinkrPlace; score: number; distanceMeters: number };

const words = (folded: string) => folded.split(/[^a-z0-9]+/).filter(Boolean);

/** How well `place` answers `query`: exact name > name prefix > word prefix > name contains > address/category only. */
export const scorePlace = (query: string, place: Pick<BlinkrPlace, 'name' | 'category' | 'displayAddress'>) => {
  const q = foldSearchText(query.trim());
  if (!q) return 0;
  const name = foldSearchText(place.name ?? '');
  if (name === q) return 100;
  if (name.startsWith(q)) return 85;
  if (words(name).some((word) => word.startsWith(q))) return 70;
  if (name.includes(q)) return 50;
  if (foldSearchText(place.displayAddress ?? '').includes(q) || foldSearchText(place.category ?? '').includes(q)) return 20;
  // Everything the server returned matched in some way (category word such as "eczane"), so it still ranks above nothing.
  return 10;
};

const distanceOf = (place: BlinkrPlace) => (Number.isFinite(place.distanceMeters ?? Number.NaN) ? place.distanceMeters as number : Number.POSITIVE_INFINITY);

/** Best name match first, then the closest; duplicates by id collapse; the list is capped. */
export const rankPlaces = (query: string, places: BlinkrPlace[], limit = 30): RankedPlace[] => {
  const seen = new Set<string>();
  const ranked: RankedPlace[] = [];
  for (const place of places) {
    if (!place?.id || seen.has(place.id)) continue;
    seen.add(place.id);
    ranked.push({ place, score: scorePlace(query, place), distanceMeters: distanceOf(place) });
  }
  return ranked
    .sort((a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters || a.place.name.localeCompare(b.place.name, 'tr'))
    .slice(0, limit);
};

export type HighlightSegment = { text: string; match: boolean };

/** Splits `text` around the first place the query matches (Turkish-insensitive) so the match can be drawn bold. */
export const highlightSegments = (text: string, query: string): HighlightSegment[] => {
  const q = foldSearchText(query.trim());
  if (!q || !text) return [{ text, match: false }];
  const index = foldSearchText(text).indexOf(q);
  if (index < 0) return [{ text, match: false }];
  return [
    ...(index > 0 ? [{ text: text.slice(0, index), match: false }] : []),
    { text: text.slice(index, index + q.length), match: true },
    ...(index + q.length < text.length ? [{ text: text.slice(index + q.length), match: false }] : []),
  ];
};

export type CategoryShortcut = { id: string; label: string; query: string };

/** One-tap searches for what people most often look for; the server maps these words to category codes. */
export const CATEGORY_SHORTCUTS: CategoryShortcut[] = [
  { id: 'cafe', label: 'Kafe', query: 'kafe' },
  { id: 'restaurant', label: 'Restoran', query: 'restoran' },
  { id: 'pharmacy', label: 'Eczane', query: 'eczane' },
  { id: 'market', label: 'Market', query: 'market' },
  { id: 'park', label: 'Park', query: 'park' },
  { id: 'health', label: 'Hastane', query: 'hastane' },
  { id: 'fuel', label: 'Akaryakıt', query: 'akaryakıt' },
  { id: 'mosque', label: 'Cami', query: 'cami' },
  { id: 'school', label: 'Okul', query: 'okul' },
  { id: 'bakery', label: 'Fırın', query: 'fırın' },
];

/** A search only starts once there is something meaningful to look for. */
export const MIN_QUERY_LENGTH = 2;
export const isSearchableQuery = (query: string) => query.trim().length >= MIN_QUERY_LENGTH && query.trim().length <= 80;

export type RecentSearch = { id: string; name: string; category?: string | null; latitude: number; longitude: number };
export const MAX_RECENT_SEARCHES = 6;

/** Newest first, no duplicates (by Place id), capped. Entries without usable coordinates are dropped. */
export const addRecentSearch = (list: RecentSearch[], entry: RecentSearch, max = MAX_RECENT_SEARCHES): RecentSearch[] => {
  if (!entry.id || !Number.isFinite(entry.latitude) || !Number.isFinite(entry.longitude)) return list;
  return [entry, ...list.filter((item) => item.id !== entry.id)].slice(0, max);
};

export const toRecentSearch = (place: BlinkrPlace): RecentSearch => ({
  id: place.id, name: place.name, category: place.category ?? null, latitude: place.latitude, longitude: place.longitude,
});

export const recentToPlace = (recent: RecentSearch): BlinkrPlace => ({
  id: recent.id, name: recent.name, category: recent.category ?? null, latitude: recent.latitude, longitude: recent.longitude,
});

/** Live means the server currently verifies activity at the Place; this is what the result row badges. */
export const isLiveResult = (place: BlinkrPlace) =>
  (place.currentState?.activeSignalCount ?? 0) > 0 && (place.currentState?.freshness === 'FRESH' || place.currentState?.freshness === 'RECENT');
