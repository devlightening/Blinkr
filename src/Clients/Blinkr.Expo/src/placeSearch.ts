import { distanceMeters } from './nearbyRequestOwnership';
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

/** Everyday words that name a kind of place; the server maps them to category codes. */
export const CATEGORY_WORDS = new Set(['cami', 'mescit', 'park', 'eczane', 'kafe', 'kahve', 'restoran', 'lokanta', 'market', 'bakkal', 'okul', 'hastane', 'klinik', 'saglik', 'benzin', 'akaryakit', 'firin', 'muze', 'spor', 'bar', 'durak']);
export const isCategoryQuery = (query: string) => CATEGORY_WORDS.has(foldSearchText(query.trim()));

/** Edit distance with adjacent transpositions ("soulmtae" is one edit from "soulmate"). */
export const editDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
};

/** How many typos a word of this length may contain and still count as the same word. */
export const typoBudget = (length: number) => (length <= 4 ? 0 : length <= 7 ? 1 : 2);

/** True when every typed word is (nearly) the start of some word of the name: "soulmte" ~ "Soulmate Coffee". */
export const fuzzyMatches = (query: string, name: string) => {
  const typed = words(foldSearchText(query.trim()));
  const nameWords = words(foldSearchText(name));
  if (!typed.length || !nameWords.length) return false;
  return typed.every((word) => nameWords.some((candidate) => {
    const budget = typoBudget(word.length);
    if (!budget) return candidate.startsWith(word);
    return editDistance(word, candidate) <= budget || editDistance(word, candidate.slice(0, word.length)) <= budget;
  }));
};

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
  if (name.replace(/[^a-z0-9]/g, '').includes(q.replace(/[^a-z0-9]/g, ''))) return 55; // "soul mate" typed, "Soulmate" stored (and the reverse)
  if (fuzzyMatches(query, place.name ?? '')) return 40;
  if (foldSearchText(place.displayAddress ?? '').includes(q) || foldSearchText(place.category ?? '').includes(q)) return 20;
  // The server matched it some other way (a category word such as "eczane"): relevant for a category query, noise otherwise.
  return isCategoryQuery(query) ? 20 : 10;
};

const distanceOf = (place: BlinkrPlace) => (Number.isFinite(place.distanceMeters ?? Number.NaN) ? place.distanceMeters as number : Number.POSITIVE_INFINITY);

/** Near = walkable/short ride, city = the same city, far = somewhere else in the country. */
export const NEAR_METERS = 3_000;
export const CITY_METERS = 30_000;
export const distanceTier = (meters: number) => (meters <= NEAR_METERS ? 0 : meters <= CITY_METERS ? 1 : 2);

type Origin = { latitude: number; longitude: number };

/**
 * What to show for a query, in the order a person expects: the closest tier first (near, then the rest of the city,
 * then far away), and inside a tier the best name match, then the nearest. Distances are measured here from the
 * person's own position, never taken from the server (which measured from the map centre). Once any real name
 * match exists, results that only matched by accident are dropped.
 */
export const rankPlaces = (query: string, places: BlinkrPlace[], options: { limit?: number; origin?: Origin } = {}): RankedPlace[] => {
  const { limit = 30, origin } = options;
  const seen = new Set<string>();
  const ranked: RankedPlace[] = [];
  for (const place of places) {
    if (!place?.id || seen.has(place.id)) continue;
    seen.add(place.id);
    const measured = origin && Number.isFinite(place.latitude) && Number.isFinite(place.longitude) ? distanceMeters(origin, place) : distanceOf(place);
    ranked.push({ place, score: scorePlace(query, place), distanceMeters: measured });
  }
  const best = ranked.reduce((max, item) => Math.max(max, item.score), 0);
  return ranked
    .filter((item) => best < 40 || item.score >= 20)
    .sort((a, b) => distanceTier(a.distanceMeters) - distanceTier(b.distanceMeters)
      || b.score - a.score
      || a.distanceMeters - b.distanceMeters
      || a.place.name.localeCompare(b.place.name, 'tr'))
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
