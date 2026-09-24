import { HttpTransportType, HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { AppState, type AppStateStatus } from 'react-native';

import { API_BASE_URL } from './api';
import { BACKGROUND_GRACE_MS, RECONNECT_DELAYS_MS } from './realtimePolicy';

/**
 * The realtime hub (V2-5, D-028): one SignalR connection per signed-in app, through the Gateway (/hubs/realtime).
 * Events only say "this changed" (ids); screens refetch through REST and slow their polling while it is live
 * (realtimePolicy.ts). Handlers and joined signal rooms survive reconnects. Leaving the app for 30 s closes it; coming
 * back reopens it. Nothing here is required for the app to work: without the hub every screen polls as before.
 */
type Handler = (payload: unknown) => void;

let connection: HubConnection | null = null;
let tokenOf: (() => string | null) | null = null;
let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: { remove: () => void } | null = null;
const handlers = new Map<string, Set<Handler>>();
const rooms = new Set<string>();
const liveListeners = new Set<(live: boolean) => void>();

const notifyLive = () => { const live = isRealtimeLive(); liveListeners.forEach((listener) => listener(live)); };

const build = () => {
  const next = new HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hubs/realtime`, {
      accessTokenFactory: () => tokenOf?.() ?? '',
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => RECONNECT_DELAYS_MS[Math.min(ctx.previousRetryCount, RECONNECT_DELAYS_MS.length - 1)] })
    .configureLogging(LogLevel.None)
    .build();
  handlers.forEach((set, event) => set.forEach((handler) => next.on(event, handler)));
  next.onreconnecting(notifyLive);
  next.onreconnected(() => { rejoinRooms(); notifyLive(); });
  next.onclose(notifyLive);
  return next;
};

const rejoinRooms = () => { rooms.forEach((postId) => { void connection?.invoke('JoinPost', postId).catch(() => {}); }); };

const connect = async () => {
  if (!tokenOf?.()) return;
  connection ??= build();
  if (connection.state !== HubConnectionState.Disconnected) return;
  try {
    await connection.start();
    rejoinRooms();
  } catch {
    // The polling fallback keeps everything working; the next foreground or login tries again.
  }
  notifyLive();
};

const onAppState = (state: AppStateStatus) => {
  if (state === 'active') {
    if (backgroundTimer) { clearTimeout(backgroundTimer); backgroundTimer = null; }
    void connect();
    return;
  }
  if (backgroundTimer) return;
  backgroundTimer = setTimeout(() => { backgroundTimer = null; void connection?.stop().catch(() => {}); }, BACKGROUND_GRACE_MS);
};

/** Starts the hub for a signed-in person; `token` is read on every (re)connect, so a refreshed token is used. */
export const startRealtime = (token: () => string | null) => {
  tokenOf = token;
  appStateSub ??= AppState.addEventListener('change', onAppState);
  void connect();
};

/** Signing out: close the hub and forget everything. */
export const stopRealtime = async () => {
  tokenOf = null;
  rooms.clear();
  appStateSub?.remove();
  appStateSub = null;
  if (backgroundTimer) { clearTimeout(backgroundTimer); backgroundTimer = null; }
  const closing = connection;
  connection = null;
  await closing?.stop().catch(() => {});
  notifyLive();
};

export const isRealtimeLive = () => connection?.state === HubConnectionState.Connected;

/** Listens for a hub event; answers the unsubscribe. */
export const onRealtime = (event: string, handler: Handler) => {
  let set = handlers.get(event);
  if (!set) { set = new Set(); handlers.set(event, set); }
  set.add(handler);
  connection?.on(event, handler);
  return () => { set?.delete(handler); connection?.off(event, handler); };
};

/** Tells a screen when the hub goes live or drops (its polling speed follows). */
export const onRealtimeLiveChange = (listener: (live: boolean) => void) => {
  liveListeners.add(listener);
  return () => { liveListeners.delete(listener); };
};

/** A signal's comment room: joined while its comments are on screen (the server checks the caller may read it). */
export const joinPostRoom = (postId: string) => {
  rooms.add(postId);
  if (isRealtimeLive()) void connection?.invoke('JoinPost', postId).catch(() => {});
  return () => {
    rooms.delete(postId);
    if (isRealtimeLive()) void connection?.invoke('LeavePost', postId).catch(() => {});
  };
};
