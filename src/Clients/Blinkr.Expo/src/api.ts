import type { AuthResponse, BlinkrPost, Bounds, CreateSignalInput } from './types';

declare const process: { env?: Record<string, string | undefined> };

export const API_BASE_URL =
  process.env?.EXPO_PUBLIC_BLINKR_API_URL || 'http://192.168.1.105:5080';

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
        return 'Sinyal servisine şu anda ulaşılamıyor. Lütfen kısa bir süre sonra tekrar dene.';
      }
      return raw.length > 240 ? `${raw.slice(0, 237)}...` : raw;
    }
  }

  if (response.status === 401) return 'Oturumun sona erdi. Lütfen yeniden giriş yap.';
  if (response.status === 403) return 'Bu işlemi yapmak için yetkin bulunmuyor.';
  return `Sunucu HTTP ${response.status} yanıtını verdi.`;
};

export const authenticate = async (
  mode: 'login' | 'register',
  input: { userName: string; email: string; password: string },
) => {
  const body = mode === 'register'
    ? input
    : { userName: input.email, password: input.password };

  const response = await fetch(`${API_BASE_URL}/api/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<AuthResponse>;
};

export const getPostsInBounds = async (
  bounds: Bounds,
  zoom: number,
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({
    minLat: bounds.minLat.toString(),
    minLng: bounds.minLng.toString(),
    maxLat: bounds.maxLat.toString(),
    maxLng: bounds.maxLng.toString(),
    zoom: zoom.toString(),
    sinceMinutes: '180',
    page: '1',
    pageSize: '200',
  });

  const response = await fetch(`${API_BASE_URL}/api/posts-read/bounds?${params}`, { signal });
  if (!response.ok) throw new Error(await readError(response));

  const payload = await response.json();
  const items: BlinkrPost[] = Array.isArray(payload) ? payload : payload.items ?? [];
  return items.filter(
    (post) => typeof post.latitude === 'number' && typeof post.longitude === 'number',
  );
};

export const createSignal = async (token: string, input: CreateSignalInput) => {
  const response = await fetch(`${API_BASE_URL}/api/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...input, media: [] }),
  });

  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json();
  return (payload.postId || payload.PostId) as string;
};
