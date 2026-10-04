import { liveStateFromCurrent, type LiveState } from './liveState';

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
