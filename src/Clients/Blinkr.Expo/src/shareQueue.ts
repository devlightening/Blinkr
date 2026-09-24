import type { CreateSignalInput, MediaKind } from './types';

/**
 * The share outbox (plan-devam D9): pressing Gönder closes the composer at once and the signal is published in the
 * background. If there is no connection - even in airplane mode, with photos not yet uploaded - the share waits here
 * (saved on the device) and goes out by itself when the connection is back. Pure rules; storage and the runner live in
 * `shareOutbox.ts`.
 */
export type OutboxMedia = {
  /** A copy in the app's own folder, so the file survives until it is uploaded. */
  localUri: string;
  kind: 'image' | 'video';
  mimeType?: string | null;
  fileName?: string | null;
  /** Set once uploaded; a retry never uploads the same file twice. */
  mediaId?: string | null;
};

export type OutboxItem = {
  id: string;
  createdAtUtc: string;
  /** Everything the post needs except the media ids, which are filled in from `media` when sent. */
  input: Omit<CreateSignalInput, 'media'>;
  media: OutboxMedia[];
  /** Also post the photo/video to my story (D8). */
  story: boolean;
  /** Friends who also get the photo as a snap (D8). */
  snapFriendIds: string[];
  attempts: number;
  /** Epoch ms: not tried again before this. */
  nextAttemptAt: number;
  /** 'failed' = the server refused it (bad content, not near the place ...): kept for the person to see, not retried. */
  status: 'pending' | 'sending' | 'failed';
  lastError?: string | null;
};

const BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];

/** Wait before the next try: 5 s, 15 s, 30 s, 1 min, 2 min, then every 5 min. */
export const backoffMs = (attempts: number) => BACKOFF_MS[Math.min(Math.max(0, attempts - 1), BACKOFF_MS.length - 1)];

/**
 * Whether an error is worth retrying: no connection, a timeout or a server hiccup (5xx, 429) will pass; a refusal
 * (400/403/404/422 - blocked content, too far from the place) will not, so the share is marked failed instead.
 */
export const isRetryable = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === 'number') return status >= 500 || status === 429 || status === 408;
  return /network|fetch|timeout|timed out|bağlantı|connection|abort|ulaşılamıyor/i.test(message);
};

export const newOutboxId = (now = Date.now(), random = Math.random()) => `s-${now.toString(36)}-${Math.floor(random * 1e9).toString(36)}`;

/** The next item to send: the oldest pending one that is due. */
export const nextDue = (items: OutboxItem[], now = Date.now()) =>
  items.filter((item) => item.status === 'pending' && item.nextAttemptAt <= now).sort((a, b) => a.createdAtUtc.localeCompare(b.createdAtUtc))[0] ?? null;

/** After a failed try: back off and retry, or stop when the server refused it. */
export const afterFailure = (item: OutboxItem, error: unknown, now = Date.now()): OutboxItem => {
  const attempts = item.attempts + 1;
  const message = error instanceof Error ? error.message : null;
  return isRetryable(error)
    ? { ...item, attempts, status: 'pending', nextAttemptAt: now + backoffMs(attempts), lastError: message }
    : { ...item, attempts, status: 'failed', lastError: message };
};

/** What the progress chip on the map says. */
export type OutboxSummary = { sending: number; waiting: number; failed: number };
export const summarize = (items: OutboxItem[]): OutboxSummary => ({
  sending: items.filter((i) => i.status === 'sending').length,
  waiting: items.filter((i) => i.status === 'pending').length,
  failed: items.filter((i) => i.status === 'failed').length,
});

export const mediaKindOf = (kind: 'image' | 'video'): MediaKind => (kind === 'video' ? 'Video' : 'Image');
