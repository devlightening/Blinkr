import { freshnessFromAge, kindFromSignal, liveStateFromCurrent, WINDOW_MINUTES, type LiveState } from './liveState';

/**
 * The state ONE signal reports, as a ring state: what a feed card says about the place "right now".
 * Same rules as the place summary (3 h window, expired and observation signals say nothing), so a post older than
 * that never looks live. The author list names the expiry `expiresAt`, the feed `expiresAtUtc`; either counts.
 * `source === 'live'` is the only case that may be coloured.
 */
export function postLiveState(
  post: { signalType?: string | null; signalValue?: string | null; createdAtUtc?: string | null; expiresAtUtc?: string | null; expiresAt?: string | null },
  nowMs: number,
): LiveState {
  return liveStateFromCurrent(
    { signalType: post.signalType, signalValue: post.signalValue, freshness: 'FRESH', observedAtUtc: post.createdAtUtc, expiresAtUtc: post.expiresAtUtc ?? post.expiresAt },
    nowMs,
  );
}

/**
 * The ring state of a coordinate signal on the map (no Place around it). A signal that names a state (crowd, queue,
 * open/closed, event, offer) reads like a place: `postLiveState`. One that only observes something (or an ended event or
 * offer) is a neutral grey ring that still shows how fresh it is, so "Sinyaller" pins share the Canlı Halka look without
 * claiming a state they do not have.
 */
export function signalPinState(
  signal: { signalType?: string | null; signalValue?: string | null; createdAtUtc?: string | null; expiresAt?: string | null },
  nowMs: number,
): LiveState {
  const live = postLiveState(signal, nowMs);
  if (live.source === 'live') return live;
  const created = signal.createdAtUtc ? Date.parse(signal.createdAtUtc) : Number.NaN;
  const age = Number.isFinite(created) ? Math.max(0, (nowMs - created) / 60000) : Number.NaN;
  const expired = signal.expiresAt ? Date.parse(signal.expiresAt) <= nowMs : false;
  if (!Number.isFinite(age) || age > WINDOW_MINUTES || expired || kindFromSignal(signal.signalType, signal.signalValue) !== null) return live;
  return {
    kind: 'unknown', level: null, freshness: freshnessFromAge(age), ageMinutes: age, confirmations: 1, isStale: false, source: 'live',
    signalType: signal.signalType ?? null, signalValue: signal.signalValue ?? null,
  };
}
