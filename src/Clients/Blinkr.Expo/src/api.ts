import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import type { AuthResponse, BlinkrPlace, Bounds, ChatMessage, Conversation, CreateSignalInput, MediaKind, UnifiedMapResponse, PlacePresence, UserSummary, AuthoredPost } from './types';

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
  if (response.status >= 500) return 'Şu anda bağlantı kurulamıyor. Lütfen tekrar dene.';

  if (raw) {
    try {
      const payload = JSON.parse(raw) as {
        detail?: string;
        error?: string;
        errors?: Record<string, string[]>;
        message?: string;
        title?: string;
      };
      const validationMessages = Object.values(payload.errors ?? {}).flat().filter(Boolean);
      const message = validationMessages[0]
        || payload.detail
        || payload.message
        || payload.error
        || payload.title;
      if (message) return message.length > 240 ? `${message.slice(0, 237)}...` : message;
    } catch {
      if (response.status >= 500 || raw.includes('Grpc.Core') || raw.includes('Exception:')) {
        return 'Sinyal servisine şu anda ulaşılamıyor. Backend servislerini kontrol edip tekrar dene.';
      }
      return raw.length > 240 ? `${raw.slice(0, 237)}...` : raw;
    }
  }

  if (response.status === 401) return 'Oturumun sona erdi. Lütfen yeniden giriş yap.';
  if (response.status === 403) return 'Bu işlemi yapmak için yetkin bulunmuyor.';
  if (response.status === 404) return 'İstenen kayıt bulunamadı.';
  return 'İşlem tamamlanamadı. Lütfen tekrar dene.';
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
  if (!auth.refreshToken) throw new Error('Oturum yenileme bilgisi bulunamadı.');
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
    if (timedOut) throw new Error('Bağlantı zaman aşımına uğradı. Tekrar dene.');
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

const requestJson = async <T>(path: string, options: RequestOptions = {}) => {
  const response = await request(path, options);
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<T>;
};

export const authenticate = async (
  mode: 'login' | 'register',
  input: { userName: string; email: string; password: string },
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

export const searchPlaces = (query: string, latitude: number, longitude: number, signal?: AbortSignal) =>
  requestJson<BlinkrPlace[]>(`/api/places/search?${new URLSearchParams({ q: query, lat: String(latitude), lon: String(longitude) })}`, { signal });

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

  if (!response.ok) throw new Error(await readError(response));
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

export const getMyPosts = async (
  auth: AuthResponse,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const response = await request(`/api/posts-read/author/${auth.userId}?${query}`, { auth, onAuthRefresh, onSessionExpired, signal });
  if (!response.ok) throw new Error(await readError(response));
  const items = await response.json() as AuthoredPost[];
  const total = Number(response.headers.get('X-Total-Count'));
  return { items, total: Number.isFinite(total) ? total : items.length };
};

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
  requestJson<{ items: ChatMessage[]; nextCursor?: string | null }>(`/api/chat/conversations/${conversationId}/messages`, {
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
) =>
  requestJson<ChatMessage>(`/api/chat/conversations/${conversationId}/messages`, {
    auth,
    body: { text },
    method: 'POST',
    onAuthRefresh,
    onSessionExpired,
  });

export const markConversationRead = (
  auth: AuthResponse,
  conversationId: string,
  onAuthRefresh?: (auth: AuthResponse) => void,
  onSessionExpired?: () => void,
) =>
  request(`/api/chat/conversations/${conversationId}/read`, { auth, method: 'POST', onAuthRefresh, onSessionExpired });

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
  const contentType = asset.mimeType || (mediaType === 'Video' ? 'video/mp4' : 'image/jpeg');
  const sizeBytes = Math.max(1, asset.fileSize ?? 1);
  const presign = await requestJson<PresignResponse>('/api/v1/media/presign', {
    auth,
    body: {
      contentType,
      fileName: asset.fileName || (mediaType === 'Video' ? 'blinkr-video.mp4' : 'blinkr-photo.jpg'),
      mediaType,
      sizeBytes,
    },
    method: 'POST',
    onAuthRefresh,
    onSessionExpired,
  });

  const localController = new AbortController();
  const localTimer = setTimeout(() => localController.abort(), 10000);
  let blob: Blob;
  try {
    const localResponse = await fetch(asset.uri, { signal: localController.signal });
    blob = await localResponse.blob();
  } catch (err) {
    if (isDev) console.log('[Blinkr Media]', { mime: contentType, failedStage: 'local-read', errorCode: err instanceof Error ? err.name : 'Unknown' });
    throw localController.signal.aborted
      ? new Error('Medya dosyası okunamadı (zaman aşımı). Tekrar dene.')
      : err;
  } finally {
    clearTimeout(localTimer);
  }

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

  if (!uploadResponse.ok) throw new Error(await readError(uploadResponse));
  if (isDev) console.log('[Blinkr Media]', { mediaId: presign.mediaId.slice(0, 8), mime: contentType, state: 'uploaded' });

  return {
    mediaId: presign.mediaId,
    mediaType,
    previewUrl: toAbsoluteUrl(presign.publicUrl),
  };
};
