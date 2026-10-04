import { liveStateFromCurrent, type LiveState } from './liveState';

/**
 * The state ONE signal reports, as a ring state: what a feed card or a profile tile says about the place "right now".
 * Same rules as the place summary (3 h window, expired and observation signals say nothing), so a post older than
 * that never looks live. `source === 'live'` is the only case that may be coloured.
 */
export function postLiveState(
  post: { signalType?: string | null; signalValue?: string | null; createdAtUtc?: string | null; expiresAtUtc?: string | null },
  nowMs: number,
): LiveState {
  return liveStateFromCurrent(
    { signalType: post.signalType, signalValue: post.signalValue, freshness: 'FRESH', observedAtUtc: post.createdAtUtc, expiresAtUtc: post.expiresAtUtc },
    nowMs,
  );
}
