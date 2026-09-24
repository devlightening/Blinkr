import { groupNotifications, isAnswerable, notificationTarget, parseDeepLink, unreadIn, type AppNotification } from '../src/notifications';

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
