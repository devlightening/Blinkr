import * as SecureStore from 'expo-secure-store';

import { MAX_RECENT_SEARCHES, addRecentSearch, type RecentSearch } from './placeSearch';

/**
 * Device-local recent searches, namespaced by user id like the saved places so signing in as someone else on the
 * same device never shows the previous person's searches. Six short entries fit SecureStore's value guidance.
 */
const key = (userId: string) => `blinkr.recent-searches.${userId}`;

export const listRecentSearches = async (userId: string): Promise<RecentSearch[]> => {
  try {
    const raw = await SecureStore.getItemAsync(key(userId));
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentSearch => Boolean(item) && typeof item.id === 'string' && typeof item.name === 'string' && Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
};

/** Returns the new list; a storage failure never blocks the search itself. */
export const rememberSearch = async (userId: string, entry: RecentSearch): Promise<RecentSearch[]> => {
  const next = addRecentSearch(await listRecentSearches(userId), entry);
  try { await SecureStore.setItemAsync(key(userId), JSON.stringify(next)); } catch { /* recents are a convenience */ }
  return next;
};

export const clearRecentSearches = async (userId: string) => {
  try { await SecureStore.deleteItemAsync(key(userId)); } catch { /* nothing to clear */ }
};
