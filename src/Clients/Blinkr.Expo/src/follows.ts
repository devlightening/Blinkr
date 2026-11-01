/**
 * One-way following (sinyal-mvp-plan Faz 6, DECISIONS D-009). Pure logic, no React Native imports.
 * Server: `POST/DELETE /api/follows/{id}` answers `{ follow: 'none' | 'requested' | 'following' }`.
 */
export type FollowState = 'none' | 'requested' | 'following' | 'self';

export type FollowButton = {
  /** i18n key in the `profile` namespace. */
  labelKey: string;
  /** What pressing it does. */
  action: 'follow' | 'unfollow' | 'cancel';
  /** Primary (filled) or quiet. */
  primary: boolean;
};

/** The follow button for another person; null for yourself. "Geri takip et" when they follow you and you don't. */
export const followButton = (state: FollowState | undefined, followsYou = false): FollowButton | null => {
  switch (state ?? 'none') {
    case 'self': return null;
    case 'following': return { labelKey: 'follow.following', action: 'unfollow', primary: false };
    case 'requested': return { labelKey: 'follow.requested', action: 'cancel', primary: false };
    default: return { labelKey: followsYou ? 'follow.followBack' : 'follow.follow', action: 'follow', primary: true };
  }
};

/** Optimistic next state: following a private account becomes a request. */
export const followAfter = (action: FollowButton['action'], isPrivate: boolean): FollowState =>
  action === 'follow' ? (isPrivate ? 'requested' : 'following') : 'none';

/** Follower count after my own action, shown immediately (a request does not count until accepted). */
export const followerCountAfter = (count: number, before: FollowState, after: FollowState) => {
  const was = before === 'following' ? 1 : 0;
  const now = after === 'following' ? 1 : 0;
  return Math.max(0, count + now - was);
};

/** A private account I cannot see: show the lock instead of the signals and the lists. */
export const profileLocked = (profile: { isPrivate?: boolean; canSeeContent?: boolean } | null | undefined) =>
  Boolean(profile && profile.canSeeContent === false);

/** Pages append without repeating a person already shown (a follow during scrolling shifts the pages). */
export const mergeFollowPage = <T extends { id: string }>(current: T[], incoming: T[], page: number) => {
  if (page <= 1) return incoming;
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
};
