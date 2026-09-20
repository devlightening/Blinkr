import * as SecureStore from 'expo-secure-store';

import type { BlinkrPlace } from './types';

/**
 * Device-local "saved places" (CLAUDE.md 20.1: account sync is a separate product decision).
 *
 * Keys are namespaced by user id so signing out and in as someone else on the same device never
 * shows the previous user's places. SecureStore cannot enumerate keys, so a small index of ids is
 * kept next to the per-place records. 50 ids stay under SecureStore's 2 KB value guidance.
 */
export type SavedPlace = {
  id: string;
  name: string;
  category?: string | null;
  latitude: number;
  longitude: number;
};

export const MAX_SAVED_PLACES = 50;
const indexKey = (userId: string) => `blinkr.saved.${userId}.index`;
const itemKey = (userId: string, placeId: string) => `blinkr.saved.${userId}.${placeId}`;

const readIndex = async (userId: string): Promise<string[]> => {
  const raw = await SecureStore.getItemAsync(indexKey(userId));
  return raw ? raw.split(',').filter(Boolean) : [];
};

export const isPlaceSaved = async (userId: string, placeId: string) =>
  Boolean(await SecureStore.getItemAsync(itemKey(userId, placeId)));

export const listSavedPlaces = async (userId: string): Promise<SavedPlace[]> => {
  const ids = await readIndex(userId);
  const items = await Promise.all(ids.map(async (id) => {
    try {
      const raw = await SecureStore.getItemAsync(itemKey(userId, id));
      const value = raw ? JSON.parse(raw) as Partial<SavedPlace> : null;
      return value && value.id && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) ? value as SavedPlace : null;
    } catch {
      return null;
    }
  }));
  // Newest first: the index is append-only, so reverse it.
  return items.filter((item): item is SavedPlace => item !== null).reverse();
};

export const savePlace = async (userId: string, place: BlinkrPlace) => {
  const ids = await readIndex(userId);
  if (!ids.includes(place.id) && ids.length >= MAX_SAVED_PLACES) {
    throw new Error(`En fazla ${MAX_SAVED_PLACES} yer kaydedebilirsin.`);
  }
  const record: SavedPlace = { id: place.id, name: place.name, category: place.category ?? null, latitude: place.latitude, longitude: place.longitude };
  await SecureStore.setItemAsync(itemKey(userId, place.id), JSON.stringify(record));
  if (!ids.includes(place.id)) await SecureStore.setItemAsync(indexKey(userId), [...ids, place.id].join(','));
};

export const unsavePlace = async (userId: string, placeId: string) => {
  await SecureStore.deleteItemAsync(itemKey(userId, placeId));
  const ids = await readIndex(userId);
  if (!ids.includes(placeId)) return;
  const remaining = ids.filter((id) => id !== placeId);
  if (remaining.length) await SecureStore.setItemAsync(indexKey(userId), remaining.join(','));
  else await SecureStore.deleteItemAsync(indexKey(userId));
};

/** Minimal Place built from a saved record, enough to focus the map and open the detail sheet. */
export const toPlace = (saved: SavedPlace): BlinkrPlace => ({
  id: saved.id, name: saved.name, category: saved.category, latitude: saved.latitude, longitude: saved.longitude,
});
