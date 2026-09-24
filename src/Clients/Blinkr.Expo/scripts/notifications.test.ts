import { groupNotifications, rowAvatars, isAnswerable, notificationTarget, parseDeepLink, unreadIn, type AppNotification } from '../src/notifications';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const n = (id: string, createdAtUtc: string, extra: Partial<AppNotification> = {}): AppNotification => ({
  id, title: 't', body: 'b', type: 'PostLiked', createdAtUtc, isRead: false, ...extra,
});
const uid = '5a8d00a2-ea64-4e07-9263-8292b7e78d3a';

run('grouped into today / this week / earlier, newest first, empty groups dropped', () => {
  const now = new Date(2026, 8, 23, 15, 0, 0);
  const groups = groupNotifications([
    n('old', new Date(2026, 8, 1).toISOString()),
    n('today-early', new Date(2026, 8, 23, 1, 0).toISOString()),
    n('today-late', new Date(2026, 8, 23, 14, 0).toISOString()),
    n('yesterday', new Date(2026, 8, 22, 20, 0).toISOString()),
  ], now);
  check(groups.map((g) => g.key).join() === 'today,week,earlier', 'keys');
  check(groups[0].items.map((x) => x.id).join() === 'today-late,today-early', 'order');
  check(groupNotifications([], now).length === 0, 'empty');
});
run('taps go to the signal or the person', () => {
  const post = notificationTarget(n('a', '2026-09-23T10:00:00Z', { type: 'CommentCreated', postId: 'p1' }));
  check(post?.kind === 'post' && post.postId === 'p1', 'post');
  const user = notificationTarget(n('b', '2026-09-23T10:00:00Z', { type: 'UserFollowed', actorUserId: 'u1', actorUserName: 'ali' }));
  check(user?.kind === 'user' && user.userId === 'u1', 'user');
  const storyLike = notificationTarget(n('s', '2026-09-23T10:00:00Z', { type: 'StoryLiked', actorUserId: 'u2', actorUserName: 'ece' }));
  check(storyLike?.kind === 'user' && storyLike.userId === 'u2', 'story like opens the person');
  const mention = notificationTarget(n('m', '2026-09-23T10:00:00Z', { type: 'Mentioned', postId: 'p9' }));
  check(mention?.kind === 'post' && mention.postId === 'p9', 'a mention opens the signal');
  check(notificationTarget(n('c', '2026-09-23T10:00:00Z', { type: 'Other' })) === null, 'none');
});
run('deep links: only blinkr posts/users with a real id', () => {
  const link = parseDeepLink(`blinkr://users/${uid}`);
  check(link?.kind === 'user' && link.userId === uid, 'user link');
  check(parseDeepLink('https://evil.example/x') === null && parseDeepLink('blinkr://posts/../x') === null && parseDeepLink(null) === null, 'rejected');
});
run('follow requests can be answered inline; unread count', () => {
  check(isAnswerable(n('r', 'x', { type: 'FollowRequested', actorUserId: 'u' })) && !isAnswerable(n('f', 'x', { type: 'UserFollowed', actorUserId: 'u' })), 'answerable');
  check(unreadIn([n('a', 'x'), n('b', 'x', { isRead: true })]) === 1, 'unread');
});

run('"Yeni" first when asked: what was unread when the screen opened', () => {
  const now = new Date(2026, 8, 23, 15, 0, 0);
  const groups = groupNotifications([
    n('seen', new Date(2026, 8, 23, 14, 0).toISOString(), { isRead: true }),
    n('fresh', new Date(2026, 8, 23, 10, 0).toISOString(), { isRead: false }),
  ], now, { newFirst: true });
  check(groups.map((g) => g.key).join() === 'new,today', groups.map((g) => g.key).join());
  check(groups[0].items[0].id === 'fresh' && groups[1].items[0].id === 'seen', 'split');
});
run('a grouped row shows two faces, a single one shows its actor', () => {
  check(rowAvatars({ id: 'x', actorCount: 5, actorIds: ['a', 'b', 'c'], actorUserId: 'a' }).join() === 'a,b', 'two');
  check(rowAvatars({ id: 'x', actorCount: 1, actorIds: ['a'], actorUserId: 'a' }).join() === 'a', 'one');
  check(rowAvatars({ id: 'x' }).join() === 'x', 'fallback');
});
