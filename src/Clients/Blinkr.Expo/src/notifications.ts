/**
 * In-app notifications (sinyal-mvp-plan Faz 9 P9.3/P9.4). Pure logic, no React Native imports.
 * Server: NotificationsService `GET /api/notifications`, types as names (PostLiked, CommentCreated, UserFollowed,
 * FollowRequested, FollowAccepted).
 */
export type AppNotification = {
  id: string;
  title: string;
  body: string;
  deepLink?: string | null;
  type: string;
  createdAtUtc: string;
  isRead: boolean;
  postId?: string | null;
  actorUserId?: string | null;
  actorUserName?: string | null;
};

export type NotificationGroup = { key: 'today' | 'week' | 'earlier'; items: AppNotification[] };

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Bugün" (same calendar day), "Bu hafta" (last 7 days), "Daha önce"; newest first inside each; empty groups dropped. */
export const groupNotifications = (items: AppNotification[], now = new Date()): NotificationGroup[] => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const sorted = [...items].sort((a, b) => Date.parse(b.createdAtUtc) - Date.parse(a.createdAtUtc));
  const groups: NotificationGroup[] = [
    { key: 'today', items: sorted.filter((n) => Date.parse(n.createdAtUtc) >= startOfToday) },
    { key: 'week', items: sorted.filter((n) => Date.parse(n.createdAtUtc) < startOfToday && Date.parse(n.createdAtUtc) >= weekAgo) },
    { key: 'earlier', items: sorted.filter((n) => Date.parse(n.createdAtUtc) < weekAgo) },
  ];
  return groups.filter((group) => group.items.length > 0);
};

export type NotificationTarget = { kind: 'post'; postId: string } | { kind: 'user'; userId: string; userName: string } | null;

/** Where tapping a notification goes: the signal for likes/comments, the person for follows and story likes. */
export const notificationTarget = (n: AppNotification): NotificationTarget => {
  if (n.postId && (n.type === 'PostLiked' || n.type === 'CommentCreated' || n.type === 'Mentioned')) return { kind: 'post', postId: n.postId };
  if (n.actorUserId && (n.type === 'UserFollowed' || n.type === 'FollowRequested' || n.type === 'FollowAccepted' || n.type === 'StoryLiked')) {
    return { kind: 'user', userId: n.actorUserId, userName: n.actorUserName ?? '' };
  }
  const link = parseDeepLink(n.deepLink);
  return link;
};

/** blinkr://posts/{id} and blinkr://users/{id}; anything else is ignored. */
export const parseDeepLink = (link?: string | null): NotificationTarget => {
  const match = /^blinkr:\/\/(posts|users)\/([0-9a-f-]{36})$/i.exec(link ?? '');
  if (!match) return null;
  return match[1].toLowerCase() === 'posts' ? { kind: 'post', postId: match[2] } : { kind: 'user', userId: match[2], userName: '' };
};

/** A follow request can be answered right in the list. */
export const isAnswerable = (n: AppNotification) => n.type === 'FollowRequested' && Boolean(n.actorUserId);

export const unreadIn = (items: AppNotification[]) => items.filter((n) => !n.isRead).length;
