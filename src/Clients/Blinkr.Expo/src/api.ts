import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import type { AuthResponse, BlinkrPlace, Bounds, ChatMessage, Conversation, CreateSignalInput, MediaKind, UnifiedMapResponse, PlacePresence, SnapOpenResult, UserSummary, AuthoredPost, Friend, FriendRequests, MyProfile, PublicProfile, Relation, BlockedUser, FollowPage, FollowRequestItem, FollowUser } from './types';
import { resolveUploadContentType, safeUploadFileName } from './mediaContentType';
import { COMMENT_PAGE_SIZE, type CommentPage, type CommentSort } from './engagement';
import { DISCOVER_PAGE_SIZE, DISCOVER_RADIUS_METERS, type DiscoverPage } from './discoverFeed';
import type { Story, StoryTrayItem, StoryViewer } from './stories';
import type { SignalShare } from './chatExtras';
import type { AppNotification } from './notifications';
import type { PostDetailDto } from './signalCard';
import { i18n } from './i18n';
import { tx } from './i18n/tx';

type NearbyPlacesResponse = Array<BlinkrPlace & { distanceMeters?: number }> & {
  coverageState?: string | null;
};

declare const process: { env?: Record<string, string | undefined> };

const isDev = process.env?.NODE_ENV !== 'production';

const configuredBaseUrl =
  process.env?.EXPO_PUBLIC_BLINKR_API_URL
  || Constants.expoConfig?.extra?.apiBaseUrl
  || 'http://192.168.1.106:5080';

export const API_BASE_URL = configuredBaseUrl.replace(/\/$/, '');
const AUTH_KEY = 'blinkr.auth.v1';

type RequestOptions = {
  auth?: AuthResponse | null;
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
  onAuthRefresh?: (auth: AuthResponse) => void;
  onSessionExpired?: () => void;
  rawBody?: BodyInit;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15000;

type PresignResponse = {
  mediaId: string;
  uploadUrl: string;
  publicUrl?: string | null;
  expiresAtUtc?: string | null;
  headers?: Record<string, string>;
};

let refreshInFlight: Promise<AuthResponse> | null = null;

const readError = async (response: Response) => {
  const raw = await response.text();
  if (response.status >= 500) return tx('errors:http.server', 'Şu anda bağlantı kurulamıyor. Lütfen tekrar dene.');

  if (raw) {
    try {
      const payload = JSON.parse(raw) as {
        code?: string;
        detail?: string;
        error?: string;
        errors?: Record<string, string[]>;
        message?: string;
        title?: string;
      };
      // Refused by the server's text filter (Faz 10 P10.1): the app's own words, in the app's language.
      if (payload.code === 'CONTENT_BLOCKED' || payload.error === 'CONTENT_BLOCKED') return i18n.t('errors:contentBlocked');
      // Moderation sanctions (Faz 10 P10.4).
      if (payload.code === 'POSTING_RESTRICTED') return i18n.t('errors:postingRestricted');
      if (payload.code === 'ACCOUNT_SUSPENDED') return i18n.t('errors:accountSuspended');
      const validationMessages = Object.values(payload.errors ?? {}).flat().filter(Boolean);
      const message = validationMessages[0]
        || payload.detail
        || payload.message
        || payload.error
        || payload.title;
      if (message) return message.length > 240 ? `${message.slice(0, 237)}...` : message;
    } catch {
      if (response.status >= 500 || raw.includes('Grpc.Core') || raw.includes('Exception:')) {
        return tx('errors:http.unreachable', 'Sinyal servisine şu anda ulaşılamıyor. Backend servislerini kontrol edip tekrar dene.');
      }
      return raw.length > 240 ? `${raw.slice(0, 237)}...` : raw;
    }
  }

  if (response.status === 401) return tx('errors:http.401', 'Oturumun sona erdi. Lütfen yeniden giriş yap.');
  if (response.status === 403) return tx('errors:http.403', 'Bu işlemi yapmak için yetkin bulunmuyor.');
  if (response.status === 404) return tx('errors:http.404', 'İstenen kayıt bulunamadı.');
  return tx('errors:http.generic', 'İşlem tamamlanamadı. Lütfen tekrar dene.');
};

export const toAbsoluteUrl = (url?: string | null) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const saveAuth = async (auth: AuthResponse) => {
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(auth));
};

export const loadAuth = async () => {
  const raw = await SecureStore.getItemAsync(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthResponse;
  } catch {
    await SecureStore.deleteItemAsync(AUTH_KEY);
    return null;
  }
};

export const clearAuth = async () => {
  await SecureStore.deleteItemAsync(AUTH_KEY);
};

const refreshSession = async (auth: AuthResponse) => {
  if (!auth.refreshToken) throw new Error(tx('errors:http.noRefresh', 'Oturum yenileme bilgisi bulunamadı.'));
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        const nextAuth = await response.json() as AuthResponse;
        await saveAuth(nextAuth);
        return nextAuth;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
};

const request = async (path: string, options: RequestOptions = {}, retrying = false): Promise<Response> => {
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.auth?.token ? { Authorization: `Bearer ${options.auth.token}` } : {}),
    ...(options.headers ?? {}),
  };

  // Every request gets a bounded upper limit, even when the caller passes its own
  // (e.g. stale-request abort) signal - a hung TCP connection otherwise never
  // settles the fetch promise, which is how "Medya hazırlanıyor"/nearby spinners
  // got stuck indefinitely with no error ever surfacing.
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onCallerAbort);
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.rawBody ?? (options.body ? JSON.stringify(options.body) : undefined),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = controller.signal.aborted && !options.signal?.aborted;
    if (isDev) {
      console.log('[Blinkr API]', {
        route: path,
        elapsedMs: Date.now() - startedAt,
        aborted: controller.signal.aborted,
        timeout: timedOut,
        errorCode: err instanceof Error ? err.name : 'Unknown',
      });
    }
    if (timedOut) throw new Error(tx('errors:http.timeout', 'Bağlantı zaman aşımına uğradı. Tekrar dene.'));
    throw err;
  } finally {
    clearTimeout(timer);
    if (options.signal) options.signal.removeEventListener('abort', onCallerAbort);
  }

  if (isDev) {
    console.log('[Blinkr API]', { route: path, elapsedMs: Date.now() - startedAt, httpStatus: response.status, aborted: false, timeout: false });
  }

  if (response.status === 401 && options.auth?.refreshToken && !retrying) {
    try {
      const refreshed = await refreshSession(options.auth);
      options.onAuthRefresh?.(refreshed);
      return request(path, { ...options, auth: refreshed }, true);
    } catch {
      await clearAuth();
      options.onSessionExpired?.();
    }
  }

  return response;
};

/** A failed response as an Error that also carries the HTTP status (the share outbox retries only 5xx/429, D9). */
const httpError = async (response: Response) => Object.assign(new Error(await readError(response)), { status: response.status });

const requestJson = async <T>(path: string, options: RequestOptions = {}) => {
  const response = await request(path, options);
  if (!response.ok) throw await httpError(response);
  return response.json() as Promise<T>;
};

export const authenticate = async (
  mode: 'login' | 'register',
  input: { userName: string; email: string; password: string; birthYear?: number | null },
) => {
  const body = mode === 'register'
    ? input
    : { userName: input.email, password: input.password };

  const auth = await requestJson<AuthResponse>(`/api/auth/${mode}`, {
    method: 'POST',
    body,
  });
  await saveAuth(auth);
  return auth;
};

type AccountRefresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

/** plan-devam F3: ask for deletion (erased in 30 days; signing in before then offers to cancel). Ends every session. */
export const requestAccountDeletion = (auth: AuthResponse, password: string, refresh: AccountRefresh = {}) =>
  requestJson<{ deletionScheduledForUtc: string }>('/api/users/me/deletion', { auth, method: 'POST', body: { password }, onAuthRefresh: refresh.onAuthRefresh, onSessionExpired: refresh.onSessionExpired });

export const cancelAccountDeletion = (auth: AuthResponse, refresh: AccountRefresh = {}) =>
  requestJson<{ deletionScheduledForUtc: null }>('/api/users/me/deletion', { auth, method: 'DELETE', onAuthRefresh: refresh.onAuthRefresh, onSessionExpired: refresh.onSessionExpired });

export type DataRequestInfo = { id: string; createdAtUtc: string; status: string };
/** plan-devam F4: ask for a copy of my data (one per 30 days; a repeat returns the open request). */
export const requestDataCopy = (auth: AuthResponse, refresh: AccountRefresh = {}) =>
  requestJson<DataRequestInfo & { repeated: boolean }>('/api/users/me/data-requests', { auth, method: 'POST', onAuthRefresh: refresh.onAuthRefresh, onSessionExpired: refresh.onSessionExpired });

export const getLatestDataRequest = (auth: AuthResponse, refresh: AccountRefresh = {}) =>
  requestJson<{ latest: DataRequestInfo | null }>('/api/users/me/data-requests', { auth, onAuthRefresh: refresh.onAuthRefresh, onSessionExpired: refresh.onSessionExpired });

export const setMyAvatar = (
  auth: AuthResponse,
  avatarKey: string | null,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) => requestJson<{ avatarKey: string | null }>('/api/users/me/avatar', { auth, body: { avatarKey }, method: 'PUT', onAuthRefresh, onSessionExpired });

export const getPlacesInBounds = async (bounds: Bounds, signal?: AbortSignal) => {
  const params = new URLSearchParams({
    minLat: bounds.minLat.toString(),
    minLon: bounds.minLng.toString(),
    maxLat: bounds.maxLat.toString(),
    maxLon: bounds.maxLng.toString(),
    limit: '200',
  });
  const payload = await requestJson<BlinkrPlace[] | { items?: BlinkrPlace[] }>(
    `/api/places/bounds?${params}`,
    { signal },
  );
  const items = Array.isArray(payload) ? payload : payload.items ?? [];
  return items.filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
};

export const getUnifiedMapBounds = async (bounds: Bounds, signal?: AbortSignal, includeCatalogPlaces = false) => {
  const params = new URLSearchParams({
    south: bounds.minLat.toString(),
    west: bounds.minLng.toString(),
    north: bounds.maxLat.toString(),
    east: bounds.maxLng.toString(),
    sinceMinutes: '180',
    limit: '180',
  });
  if (includeCatalogPlaces) params.set('includeCatalogPlaces', 'true');
  const payload = await requestJson<UnifiedMapResponse>(`/api/map/bounds?${params}`, { signal });
  console.log('[Blinkr Map]', `Places: ${payload.places?.length ?? 0}`, `Signals: ${payload.signals?.length ?? 0}`);
  return {
    places: payload.places ?? [],
    signals: payload.signals ?? [],
  };
};

export const getNearbyPlaces = async (latitude: number, longitude: number, radiusMeters = 1500, signal?: AbortSignal) => {
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lon: longitude.toString(),
    radiusMeters: radiusMeters.toString(),
    limit: '24',
  });
  const response = await request(`/api/places/nearby?${params}`, { signal });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json() as NearbyPlacesResponse;
  return Object.assign(payload, {
    coverageState: response.headers.get('x-blinkr-place-coverage'),
  });
};

export const getPlace = async (placeId: string, signal?: AbortSignal) =>
  requestJson<BlinkrPlace>(`/api/places/${placeId}`, { signal });

export const getSignalContent = async (postId: string, signal?: AbortSignal) => {
  const post = await requestJson<{ content?: string; media?: Array<{ url?: string; type?: string | number; mediaType?: string }> }>(`/api/posts/${postId}`, { signal });
  return { content: post.content, media: (post.media ?? []).map(item => ({ url: item.url, mediaType: item.type === 1 || item.type === 'Video' || item.mediaType === 'Video' ? 'Video' : 'Image' })) };
};

/** `radiusMeters` defaults to the server's 1.5 km (composer); the map's "where to?" search asks for up to 30 km. */
export const searchPlaces = (query: string, latitude: number, longitude: number, signal?: AbortSignal, radiusMeters?: number, expand = false) =>
  requestJson<BlinkrPlace[]>(`/api/places/search?${new URLSearchParams({ q: query, lat: String(latitude), lon: String(longitude), ...(radiusMeters ? { radiusMeters: String(radiusMeters) } : {}), ...(expand ? { expand: 'true' } : {}) })}`, { signal });

export const previewPresence = (auth: AuthResponse, body: { placeId: string; latitude: number; longitude: number; accuracyMeters: number }, onAuthRefresh: (auth: AuthResponse) => void, onSessionExpired: () => void) =>
  requestJson<PlacePresence>('/api/posts/place-presence', { auth, body, method: 'POST', onAuthRefresh, onSessionExpired });

export const createSignal = async (
  auth: AuthResponse,
  input: CreateSignalInput,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) => {
  const response = await request('/api/posts', {
    auth,
    body: { ...input, media: input.media ?? [] },
    method: 'POST',
    onAuthRefresh,
    onSessionExpired,
  });

  if (!response.ok) throw await httpError(response);
  const payload = await response.json();
  console.log('[Blinkr Publish]', {
    postId: payload.postId || payload.PostId,
    anchorType: payload.anchorType || payload.AnchorType,
    placeId: payload.placeId || payload.PlaceId || null,
    distanceMeters: input.placeId && typeof input.proximityDistanceMeters === 'number' ? Math.round(input.proximityDistanceMeters) : null,
    proximityAllowed: input.placeId ? input.proximityAllowed : null,
    mediaCount: input.media?.length ?? 0,
  });
  return (payload.postId || payload.PostId) as string;
};

export const searchUsers = (auth: AuthResponse, query: string, signal?: AbortSignal) =>
  requestJson<UserSummary[]>(`/api/users/search?${new URLSearchParams({ q: query })}`, { auth, signal });

/** A person's published signals, newest first. Anonymous ones only ever come back to their own author. */
export const getUserPosts = async (
  auth: AuthResponse,
  userId: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const response = await request(`/api/posts-read/author/${userId}?${query}`, { auth, onAuthRefresh, onSessionExpired, signal });
  if (!response.ok) throw new Error(await readError(response));
  const items = await response.json() as AuthoredPost[];
  const total = Number(response.headers.get('X-Total-Count'));
  return { items, total: Number.isFinite(total) ? total : items.length };
};

export const getMyPosts = (
  auth: AuthResponse,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) => getUserPosts(auth, auth.userId, page, pageSize, signal, onAuthRefresh, onSessionExpired);

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

export const getMyProfile = (auth: AuthResponse, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<MyProfile>('/api/users/me', { auth, signal, ...refresh });

export const setMyBio = (auth: AuthResponse, bio: string | null, refresh: Refresh = {}) =>
  requestJson<{ bio: string | null }>('/api/users/me/profile', { auth, body: { bio }, method: 'PUT', ...refresh });

export const getPublicProfile = (auth: AuthResponse, userId: string, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<PublicProfile>(`/api/users/${userId}`, { auth, signal, ...refresh });

export const listFriends = (auth: AuthResponse, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<Friend[]>('/api/friends', { auth, signal, ...refresh });

export const listFriendRequests = (auth: AuthResponse, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<FriendRequests>('/api/friends/requests', { auth, signal, ...refresh });

type RelationResult = { userId: string; relation: Relation };

export const sendFriendRequest = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<RelationResult>('/api/friends/requests', { auth, body: { userId }, method: 'POST', ...refresh });

export const acceptFriendRequest = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<RelationResult>(`/api/friends/requests/${userId}/accept`, { auth, method: 'POST', ...refresh });

export const declineFriendRequest = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<RelationResult>(`/api/friends/requests/${userId}/decline`, { auth, method: 'POST', ...refresh });

export const cancelFriendRequest = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<RelationResult>(`/api/friends/requests/${userId}`, { auth, method: 'DELETE', ...refresh });

export const listBlocks = (auth: AuthResponse, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<BlockedUser[]>('/api/blocks', { auth, signal, ...refresh });

export const blockUser = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<RelationResult>('/api/blocks', { auth, body: { userId }, method: 'POST', ...refresh });

export const unblockUser = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<RelationResult>(`/api/blocks/${userId}`, { auth, method: 'DELETE', ...refresh });

/** Reports are stored for moderation; the same report twice is answered the same calm way. */
export const sendReport = (
  auth: AuthResponse,
  report: { targetType: 'user' | 'signal'; targetId: string; reason: string; note?: string },
  refresh: Refresh = {},
) => requestJson<{ reported: boolean }>('/api/reports', { auth, body: report, method: 'POST', ...refresh });

/** In-app notifications (Faz 9). */
export const listNotifications = (auth: AuthResponse, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<{ items: AppNotification[]; nextCursor?: string | null }>('/api/notifications?pageSize=50', { auth, signal, ...refresh });
export const getUnreadNotificationCount = async (auth: AuthResponse, signal?: AbortSignal, refresh: Refresh = {}) =>
  (await requestJson<{ unreadCount: number }>('/api/notifications/unread-count', { auth, signal, ...refresh })).unreadCount;
export const markAllNotificationsRead = async (auth: AuthResponse, refresh: Refresh = {}) => {
  await request('/api/notifications/mark-read', { auth, body: { notificationIds: [] }, method: 'POST', ...refresh });
};

/** Stories (Faz 7): 24 h, author + accepted followers; the media is private and never cached. */
export const listStoryTray = (auth: AuthResponse, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<StoryTrayItem[]>('/api/stories/tray', { auth, signal, ...refresh });
export const listUserStories = (auth: AuthResponse, userId: string, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<Story[]>(`/api/stories/users/${userId}`, { auth, signal, ...refresh });
export const markStorySeen = async (auth: AuthResponse, storyId: string, refresh: Refresh = {}) => {
  await request(`/api/stories/${storyId}/seen`, { auth, method: 'POST', ...refresh });
};
export const listStoryViewers = (auth: AuthResponse, storyId: string, refresh: Refresh = {}) =>
  requestJson<StoryViewer[]>(`/api/stories/${storyId}/viewers`, { auth, ...refresh });
export const deleteStory = async (auth: AuthResponse, storyId: string, refresh: Refresh = {}) => {
  const response = await request(`/api/stories/${storyId}`, { auth, method: 'DELETE', ...refresh });
  if (!response.ok) throw new Error(await readError(response));
};
export const storyMediaSource = (auth: AuthResponse, storyId: string) => ({
  uri: `${API_BASE_URL}/api/stories/${storyId}/content`,
  headers: { Authorization: `Bearer ${auth.token}` },
});
export const postStory = async (
  auth: AuthResponse,
  media: LocalMedia,
  options: { durationSeconds: number; caption?: string },
  refresh: Refresh = {},
) => {
  const mediaType: MediaKind = media.type === 'video' ? 'Video' : 'Image';
  const { blob, contentType } = await readLocalMedia(media, mediaType);
  const query = new URLSearchParams({ durationSeconds: String(mediaType === 'Video' ? 0 : options.durationSeconds) });
  if (options.caption) query.set('caption', options.caption);
  const response = await request(`/api/stories?${query}`, { auth, headers: { 'Content-Type': contentType }, method: 'POST', rawBody: blob, timeoutMs: 90000, ...refresh });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<Story>;
};

/** Keşfet (Faz 7): ranked live signals nearby, and what followed people shared this week. */
export const getDiscoverNearby = (auth: AuthResponse, latitude: number, longitude: number, page = 1, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<DiscoverPage>(`/api/discover/nearby?${new URLSearchParams({ lat: String(latitude), lon: String(longitude), radiusMeters: String(DISCOVER_RADIUS_METERS), page: String(page), pageSize: String(DISCOVER_PAGE_SIZE) })}`, { auth, signal, ...refresh });
export const getDiscoverFollowing = (auth: AuthResponse, page = 1, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<DiscoverPage>(`/api/discover/following?page=${page}&pageSize=${DISCOVER_PAGE_SIZE}`, { auth, signal, ...refresh });

/** Saved places on the account (P6.8): the same on every device. */
type SavedPlaceRow = { id: string; name: string; category?: string | null; latitude: number; longitude: number; savedAtUtc?: string };
export const listServerSavedPlaces = (auth: AuthResponse, refresh: Refresh = {}) =>
  requestJson<SavedPlaceRow[]>('/api/users/me/saved-places', { auth, ...refresh });
export const putSavedPlace = (auth: AuthResponse, place: { id: string; name: string; category?: string | null; latitude: number; longitude: number }, refresh: Refresh = {}) =>
  requestJson<{ placeId: string; saved: boolean }>(`/api/users/me/saved-places/${place.id}`, { auth, body: { name: place.name, category: place.category ?? null, latitude: place.latitude, longitude: place.longitude }, method: 'PUT', ...refresh });
export const deleteSavedPlace = (auth: AuthResponse, placeId: string, refresh: Refresh = {}) =>
  requestJson<{ placeId: string; saved: boolean }>(`/api/users/me/saved-places/${placeId}`, { auth, method: 'DELETE', ...refresh });
export const importSavedPlaces = (auth: AuthResponse, items: Array<{ id: string; name: string; category?: string | null; latitude: number; longitude: number }>, refresh: Refresh = {}) =>
  requestJson<SavedPlaceRow[]>('/api/users/me/saved-places/import', { auth, body: { items }, method: 'POST', ...refresh });

/** Follows (D-009): follow a public account at once, a private one by request. */
export const followUser = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<{ userId: string; follow: FollowUser['follow'] }>(`/api/follows/${userId}`, { auth, method: 'POST', ...refresh });
export const unfollowUser = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<{ userId: string; follow: FollowUser['follow'] }>(`/api/follows/${userId}`, { auth, method: 'DELETE', ...refresh });
export const listFollowers = (auth: AuthResponse, userId: string, page = 1, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<FollowPage>(`/api/users/${userId}/followers?page=${page}&pageSize=30`, { auth, signal, ...refresh });
export const listFollowing = (auth: AuthResponse, userId: string, page = 1, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<FollowPage>(`/api/users/${userId}/following?page=${page}&pageSize=30`, { auth, signal, ...refresh });
export const listFollowRequests = (auth: AuthResponse, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<FollowRequestItem[]>('/api/follows/requests', { auth, signal, ...refresh });
export const acceptFollowRequest = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<{ userId: string }>(`/api/follows/requests/${userId}/accept`, { auth, method: 'POST', ...refresh });
export const declineFollowRequest = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<{ userId: string }>(`/api/follows/requests/${userId}/decline`, { auth, method: 'POST', ...refresh });
export const removeFollower = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<{ userId: string }>(`/api/follows/followers/${userId}`, { auth, method: 'DELETE', ...refresh });
export const setAccountPrivacy = (auth: AuthResponse, isPrivate: boolean, refresh: Refresh = {}) =>
  requestJson<{ isPrivate: boolean }>('/api/users/me/privacy', { auth, body: { isPrivate }, method: 'PUT', ...refresh });

/** Thrown when the server answers with a known `code` (e.g. `CANNOT_LIKE_OWN`), so the UI can show a translated message. */
export class ApiCodeError extends Error {
  constructor(public code: string, public status: number) { super(code); this.name = 'ApiCodeError'; }
}

const requestCoded = async <T>(path: string, options: RequestOptions = {}): Promise<T | null> => {
  const response = await request(path, options);
  if (!response.ok) {
    const raw = await response.text();
    let code: string | null = null;
    try { code = (JSON.parse(raw) as { code?: string }).code ?? null; } catch { /* not JSON */ }
    throw new ApiCodeError(code ?? (response.status === 404 ? "NOT_FOUND" : "UNKNOWN"), response.status);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : null;
};

/** Sinyal Kartı (plan-devam Faz C): the full signal, trust, own-ness and, for the author, views. */
export const getSignalDetail = (auth: AuthResponse | null, postId: string, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<PostDetailDto>(`/api/posts/${postId}`, { auth, signal, ...refresh });

/** Cards looked at for at least a second, sent in batches (C12). Counted once per person, signal and day. */
export const recordPostViews = async (auth: AuthResponse, postIds: string[], refresh: Refresh = {}) => {
  if (postIds.length === 0) return;
  await request('/api/posts/views', { auth, body: { postIds }, method: 'POST', ...refresh });
};

/** The author removes their own signal (the whole chain follows: PostDeleted). */
export const deleteSignal = (auth: AuthResponse, postId: string, refresh: Refresh = {}) =>
  requestCoded<null>(`/api/posts/${postId}`, { auth, method: 'DELETE', ...refresh });

/** Likes and comments (engagement.ts has the contract). */
export const getPostEngagement = (auth: AuthResponse | null, postId: string, signal?: AbortSignal, refresh: Refresh = {}) =>
  requestJson<{ likeCount: number; commentCount: number; isLikedByCurrentUser: boolean; authorId: string }>(`/api/posts/${postId}`, { auth, signal, ...refresh });

export const togglePostLike = async (auth: AuthResponse, postId: string, refresh: Refresh = {}) =>
  (await requestCoded<{ liked: boolean }>(`/api/posts/${postId}/likes`, { auth, method: "POST", ...refresh }))?.liked ?? false;

export const getPostComments = async (auth: AuthResponse | null, postId: string, page = 1, sort: CommentSort = "newest", signal?: AbortSignal, refresh: Refresh = {}) =>
  (await requestCoded<CommentPage>(`/api/posts/${postId}/comments?${new URLSearchParams({ page: String(page), pageSize: String(COMMENT_PAGE_SIZE), sort })}`, { auth, signal, ...refresh }))!;

export const addPostComment = async (auth: AuthResponse, postId: string, commentText: string, parentCommentId?: string | null, refresh: Refresh = {}) =>
  (await requestCoded<{ commentId: string }>(`/api/posts/${postId}/comments`, { auth, body: { commentText, parentCommentId: parentCommentId ?? null }, method: "POST", ...refresh }))!.commentId;

export const deletePostComment = (auth: AuthResponse, postId: string, commentId: string, refresh: Refresh = {}) =>
  requestCoded<null>(`/api/posts/${postId}/comments/${commentId}`, { auth, method: "DELETE", ...refresh });

/** Up to 20 places by id with their current state: how the places a person saved are doing right now. */
export const getPlacesByIds = (ids: string[], signal?: AbortSignal) =>
  requestJson<BlinkrPlace[]>(`/api/places/batch?${new URLSearchParams({ ids: ids.slice(0, 20).join(',') })}`, { signal });

export const removeFriend = (auth: AuthResponse, userId: string, refresh: Refresh = {}) =>
  requestJson<RelationResult>(`/api/friends/${userId}`, { auth, method: 'DELETE', ...refresh });

export const getUser = (
  auth: AuthResponse,
  userId: string,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) =>
  requestJson<UserSummary>(`/api/users/${userId}`, { auth, onAuthRefresh, onSessionExpired });

export const listConversations = (
  auth: AuthResponse,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) =>
  requestJson<{ items: Conversation[] }>('/api/chat/conversations', { auth, onAuthRefresh, onSessionExpired })
    .then((payload) => payload.items);

export const startConversation = (
  auth: AuthResponse,
  targetUserId: string,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) =>
  requestJson<Conversation>('/api/chat/conversations', {
    auth,
    body: { targetUserId },
    method: 'POST',
    onAuthRefresh,
    onSessionExpired,
  });

export const getMessages = (
  auth: AuthResponse,
  conversationId: string,
  signal?: AbortSignal,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) =>
  requestJson<{ items: ChatMessage[]; nextCursor?: string | null; otherTyping?: boolean }>(`/api/chat/conversations/${conversationId}/messages`, {
    auth,
    onAuthRefresh,
    onSessionExpired,
    signal,
  });

export const sendMessage = (
  auth: AuthResponse,
  conversationId: string,
  text: string,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
  extras: { clientId?: string; signal?: SignalShare; replyToId?: string | null } = {},
) =>
  requestJson<ChatMessage>(`/api/chat/conversations/${conversationId}/messages`, {
    auth,
    body: { text, ...(extras.clientId ? { clientId: extras.clientId } : {}), ...(extras.signal ? { signal: extras.signal } : {}), ...(extras.replyToId ? { replyToId: extras.replyToId } : {}) },
    method: 'POST',
    onAuthRefresh,
    onSessionExpired,
  });

/** Take back my own text or shared signal (Faz 8). */
export const unsendMessage = (auth: AuthResponse, conversationId: string, messageId: string, refresh: Refresh = {}) =>
  requestJson<ChatMessage>(`/api/chat/conversations/${conversationId}/messages/${messageId}`, { auth, method: 'DELETE', ...refresh });

/** Set (or with null clear) my reaction on a message. */
export const reactToMessage = (auth: AuthResponse, conversationId: string, messageId: string, emoji: string | null, refresh: Refresh = {}) =>
  requestJson<ChatMessage>(`/api/chat/conversations/${conversationId}/messages/${messageId}/reaction`, { auth, body: { emoji }, method: 'PUT', ...refresh });

/** "I am typing" (plan-devam E4): the other person's next poll shows it for a few seconds. Best effort. */
export const sendTyping = (auth: AuthResponse, conversationId: string, refresh: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void } = {}) =>
  request(`/api/chat/conversations/${conversationId}/typing`, { auth, method: 'POST', onAuthRefresh: refresh.onAuthRefresh, onSessionExpired: refresh.onSessionExpired });

export const markConversationRead = (
  auth: AuthResponse,
  conversationId: string,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) =>
  request(`/api/chat/conversations/${conversationId}/read`, { auth, method: 'POST', onAuthRefresh, onSessionExpired });

type LocalMedia = { uri: string; fileName?: string | null; mimeType?: string | null; type?: string | null };

/**
 * Reads a picked/captured file into a Blob and settles ONE content type for it (picker, Blob and file extension
 * disagree often enough to matter). The Blob is re-wrapped in that type because the HTTP stack sends a Blob body
 * with the Blob's own type, which must not drift from what was declared to the server.
 */
const readLocalMedia = async (asset: LocalMedia, mediaType: MediaKind) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let blob: Blob;
  try {
    const response = await fetch(asset.uri, { signal: controller.signal });
    blob = await response.blob();
  } catch (err) {
    if (isDev) console.log('[Blinkr Media]', { failedStage: 'local-read', errorCode: err instanceof Error ? err.name : 'Unknown' });
    throw controller.signal.aborted ? new Error(tx('errors:http.mediaTimeout', 'Medya dosyası okunamadı (zaman aşımı). Tekrar dene.')) : err;
  } finally {
    clearTimeout(timer);
  }
  const contentType = resolveUploadContentType(mediaType, asset.mimeType, blob.type, asset.fileName ?? asset.uri);
  if (blob.type !== contentType) blob = new Blob([blob], { type: contentType });
  return { blob, contentType };
};

export const uploadMedia = async (
  auth: AuthResponse,
  asset: {
    uri: string;
    fileName?: string | null;
    fileSize?: number | null;
    mimeType?: string | null;
    type?: string | null;
  },
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) => {
  const mediaType: MediaKind = asset.type === 'video' ? 'Video' : 'Image';

  // Read the file first: a file that cannot be read must not leave a presign record behind.
  const { blob, contentType } = await readLocalMedia(asset, mediaType);
  const sizeBytes = Math.max(1, blob.size || asset.fileSize || 1);
  const presign = await requestJson<PresignResponse>('/api/v1/media/presign', {
    auth,
    body: {
      contentType,
      fileName: safeUploadFileName(asset.fileName, mediaType, contentType),
      mediaType,
      sizeBytes,
    },
    method: 'POST',
    onAuthRefresh,
    onSessionExpired,
  });

  const uploadPath = presign.uploadUrl.startsWith('http')
    ? presign.uploadUrl.replace(API_BASE_URL, '')
    : presign.uploadUrl;

  const uploadResponse = await request(uploadPath, {
    auth,
    headers: {
      'Content-Type': contentType,
      ...(presign.headers ?? {}),
    },
    method: 'PUT',
    onAuthRefresh,
    onSessionExpired,
    rawBody: blob,
    timeoutMs: 45000,
  });

  if (!uploadResponse.ok) throw await httpError(uploadResponse);
  if (isDev) console.log('[Blinkr Media]', { mediaId: presign.mediaId.slice(0, 8), mime: contentType, state: 'uploaded' });

  return {
    mediaId: presign.mediaId,
    mediaType,
    previewUrl: toAbsoluteUrl(presign.publicUrl),
  };
};

/**
 * Sends a view-once photo or video into a conversation. The body is the raw media (its Content-Type is the media
 * type); the timer and caption travel in the query. Videos always play to their end (timer 0).
 */
export const sendSnap = async (
  auth: AuthResponse,
  conversationId: string,
  media: LocalMedia,
  options: { durationSeconds: number; caption?: string },
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) => {
  const mediaType: MediaKind = media.type === 'video' ? 'Video' : 'Image';
  const { blob, contentType } = await readLocalMedia(media, mediaType);
  const query = new URLSearchParams({ durationSeconds: String(mediaType === 'Video' ? 0 : options.durationSeconds) });
  if (options.caption) query.set('caption', options.caption);
  const response = await request(`/api/chat/conversations/${conversationId}/snaps?${query}`, {
    auth,
    headers: { 'Content-Type': contentType },
    method: 'POST',
    onAuthRefresh,
    onSessionExpired,
    rawBody: blob,
    timeoutMs: 90000,
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<ChatMessage>;
};

/** Opens a waiting snap for good (one time only). Fails with 410 once it was opened or has expired. */
export const openSnap = (
  auth: AuthResponse,
  conversationId: string,
  messageId: string,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) => requestJson<SnapOpenResult>(`/api/chat/conversations/${conversationId}/messages/${messageId}/open`, { auth, method: 'POST', onAuthRefresh, onSessionExpired });

/** Where and how to load the media of an opened snap: only the recipient's token is accepted, and only briefly. */
export const snapMediaSource = (auth: AuthResponse, contentUrl: string) => ({
  uri: toAbsoluteUrl(contentUrl) as string,
  headers: { Authorization: `Bearer ${auth.token}` },
});
