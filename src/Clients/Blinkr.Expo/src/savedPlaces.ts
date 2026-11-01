import * as SecureStore from 'expo-secure-store';

import { deleteSavedPlace, importSavedPlaces, listServerSavedPlaces, putSavedPlace } from './api';
import type { AuthResponse, BlinkrPlace } from './types';
import { tx } from './i18n/tx';

/**
 * Saved places (sinyal-mvp-plan P6.8). The account on the server is the truth, so the same places show on every
 * device (IdentityService `/api/users/me/saved-places`). What a device saved before sync existed is imported once,
 * then this device keeps only a cache of the server list, used when the server cannot be reached.
 *
 * Cache keys are namespaced by user id so signing out and in as someone else on the same device never shows the
 * previous user's places. SecureStore cannot enumerate keys, so a small index of ids is kept next to the records.
 * Without a session (tests, or before sign-in finishes) it works device-locally exactly as before.
 */
export type SavedPlace = {
  id: string;
  name: string;
  category?: string | null;
  latitude: number;
  longitude: number;
};

export const MAX_SAVED_PLACES = 100;
const indexKey = (userId: string) => `blinkr.saved.${userId}.index`;
const itemKey = (userId: string, placeId: string) => `blinkr.saved.${userId}.${placeId}`;
const syncedKey = (userId: string) => `blinkr.saved.${userId}.synced`;

type Session = { auth: AuthResponse; refresh: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void } };
let session: Session | null = null;
/** Last list the server gave for the signed-in user (answers "is this saved?" without another request). */
let serverIds: { userId: string; ids: Set<string> } | null = null;

/** Called by the app shell whenever the signed-in account changes (null on sign-out). */
export const setSavedPlacesSession = (next: Session | null) => {
  if (session?.auth.userId !== next?.auth.userId) serverIds = null;
  session = next;
};

const syncedFor = (userId: string) => (session && session.auth.userId === userId ? session : null);

const readIndex = async (userId: string): Promise<string[]> => {
  const raw = await SecureStore.getItemAsync(indexKey(userId));
  return raw ? raw.split(',').filter(Boolean) : [];
};

const readLocal = async (userId: string): Promise<SavedPlace[]> => {
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

/** Replaces the device cache with the server list (newest first). */
const writeCache = async (userId: string, places: SavedPlace[]) => {
  const old = await readIndex(userId);
  const keep = new Set(places.map((place) => place.id));
  await Promise.all(old.filter((id) => !keep.has(id)).map((id) => SecureStore.deleteItemAsync(itemKey(userId, id))));
  await Promise.all(places.map((place) => SecureStore.setItemAsync(itemKey(userId, place.id), JSON.stringify(place))));
  const ordered = [...places].reverse().map((place) => place.id);
  if (ordered.length) await SecureStore.setItemAsync(indexKey(userId), ordered.join(','));
  else await SecureStore.deleteItemAsync(indexKey(userId));
};

const fromServer = (rows: Array<{ id: string; name: string; category?: string | null; latitude: number; longitude: number }>): SavedPlace[] =>
  rows.map((row) => ({ id: row.id, name: row.name, category: row.category ?? null, latitude: row.latitude, longitude: row.longitude }));

export const listSavedPlaces = async (userId: string): Promise<SavedPlace[]> => {
  const synced = syncedFor(userId);
  if (!synced) return readLocal(userId);
  try {
    let rows;
    if (!(await SecureStore.getItemAsync(syncedKey(userId)))) {
      // First signed-in list on this device: bring what was saved here before sync existed.
      const local = await readLocal(userId);
      rows = local.length ? await importSavedPlaces(synced.auth, local, synced.refresh) : await listServerSavedPlaces(synced.auth, synced.refresh);
      await SecureStore.setItemAsync(syncedKey(userId), '1');
    } else {
      rows = await listServerSavedPlaces(synced.auth, synced.refresh);
    }
    const places = fromServer(rows);
    serverIds = { userId, ids: new Set(places.map((place) => place.id)) };
    await writeCache(userId, places);
    return places;
  } catch (err) {
    // Offline or the server is down: show the last known list, and let the caller say it may be stale.
    const cached = await readLocal(userId);
    if (cached.length) return cached;
    throw err;
  }
};

export const isPlaceSaved = async (userId: string, placeId: string) => {
  if (serverIds && serverIds.userId === userId) return serverIds.ids.has(placeId);
  if (syncedFor(userId)) {
    try { return (await listSavedPlaces(userId)).some((place) => place.id === placeId); } catch { /* fall back to the cache */ }
  }
  return Boolean(await SecureStore.getItemAsync(itemKey(userId, placeId)));
};

export const savePlace = async (userId: string, place: BlinkrPlace) => {
  const record: SavedPlace = { id: place.id, name: place.name, category: place.category ?? null, latitude: place.latitude, longitude: place.longitude };
  const synced = syncedFor(userId);
  const ids = await readIndex(userId);
  if (synced) {
    await putSavedPlace(synced.auth, record, synced.refresh); // the server enforces the limit (429 "En fazla ...")
    if (serverIds?.userId === userId) serverIds.ids.add(place.id);
  } else if (!ids.includes(place.id) && ids.length >= MAX_SAVED_PLACES) {
    throw new Error(tx('profile:saved.limit', 'En fazla {{max}} yer kaydedebilirsin.', { max: MAX_SAVED_PLACES }));
  }
  await SecureStore.setItemAsync(itemKey(userId, place.id), JSON.stringify(record));
  if (!ids.includes(place.id)) await SecureStore.setItemAsync(indexKey(userId), [...ids, place.id].join(','));
};

export const unsavePlace = async (userId: string, placeId: string) => {
  const synced = syncedFor(userId);
  if (synced) {
    await deleteSavedPlace(synced.auth, placeId, synced.refresh);
    if (serverIds?.userId === userId) serverIds.ids.delete(placeId);
  }
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
