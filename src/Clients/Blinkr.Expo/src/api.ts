import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import type { AuthResponse, BlinkrPlace, Bounds, CreateSignalInput, MediaKind, UnifiedMapResponse } from './types';

declare const process: { env?: Record<string, string | undefined> };

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
};

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
  return `Sunucu HTTP ${response.status} yanıtını verdi.`;
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.rawBody ?? (options.body ? JSON.stringify(options.body) : undefined),
    signal: options.signal,
  });

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

export const getUnifiedMapBounds = async (bounds: Bounds, signal?: AbortSignal) => {
  const params = new URLSearchParams({
    south: bounds.minLat.toString(),
    west: bounds.minLng.toString(),
    north: bounds.maxLat.toString(),
    east: bounds.maxLng.toString(),
    sinceMinutes: '180',
    limit: '180',
  });
  const payload = await requestJson<UnifiedMapResponse>(`/api/map/bounds?${params}`, { signal });
  console.log('[Blinkr Map]', `Places: ${payload.places?.length ?? 0}`, `Signals: ${payload.signals?.length ?? 0}`);
  return {
    places: payload.places ?? [],
    signals: payload.signals ?? [],
  };
};

export const getNearbyPlaces = async (latitude: number, longitude: number, radiusMeters = 350, signal?: AbortSignal) => {
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lon: longitude.toString(),
    radiusMeters: radiusMeters.toString(),
    limit: '24',
  });
  const payload = await requestJson<Array<BlinkrPlace & { distanceMeters?: number }>>(`/api/places/nearby?${params}`, { signal });
  return payload;
};

export const getPlace = async (placeId: string, signal?: AbortSignal) =>
  requestJson<BlinkrPlace>(`/api/places/${placeId}`, { signal });

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

  const localResponse = await fetch(asset.uri);
  const blob = await localResponse.blob();
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
  });

  if (!uploadResponse.ok) throw new Error(await readError(uploadResponse));

  return {
    mediaId: presign.mediaId,
    mediaType,
    previewUrl: toAbsoluteUrl(presign.publicUrl),
  };
};
