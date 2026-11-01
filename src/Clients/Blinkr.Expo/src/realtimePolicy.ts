/**
 * Realtime timing rules (V2-5, D-028). Pure logic, no React Native or SignalR imports.
 * The hub only says "this changed"; the app refetches through REST. While the hub is connected, polling slows to a
 * safety net that repairs any missed event; without it, the old polling speed comes back.
 */
export const SAFETY_POLL_MS = 30_000;
/** How long the app stays connected in the background before letting go (reconnects on return). */
export const BACKGROUND_GRACE_MS = 30_000;
/** Reconnect delays after a drop, then every 30 s. */
export const RECONNECT_DELAYS_MS = [0, 2_000, 5_000, 10_000, 30_000];

/** The poll interval for a screen: its own speed without the hub, the slow safety net with it. */
export const pollIntervalMs = (live: boolean, fallbackMs: number) => (live ? Math.max(SAFETY_POLL_MS, fallbackMs) : fallbackMs);

/**
 * A comment or reaction event can reach the app before the read model has it (the projection and the hub consume the
 * same RabbitMQ event in parallel). The app refetches at these moments until it sees what the event announced.
 */
export const REFETCH_SCHEDULE_MS = [0, 800, 2_000, 4_000];

/** Next retry delay after `attempt` refetches, or null when it is time to give up (the safety poll takes over). */
export const nextRefetchDelay = (attempt: number): number | null =>
  attempt + 1 < REFETCH_SCHEDULE_MS.length ? REFETCH_SCHEDULE_MS[attempt + 1] - REFETCH_SCHEDULE_MS[attempt] : null;

/** A hub payload is for this screen when its id matches (ids are compared as plain strings, case-insensitive). */
export const isFor = (payload: unknown, key: 'conversationId' | 'postId', id: string | null | undefined) => {
  if (!id || !payload || typeof payload !== 'object') return false;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.toLowerCase() === id.toLowerCase();
};
