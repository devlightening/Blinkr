import {
  COMMENT_MAX, commentState, confirmComment, countComments, engagementErrorKey, formatCount, insertComment,
  mergeCommentPages, optimisticComment, removeComment, toggleLike, visibleReplies, type CommentPage, type CommentView,
} from '../src/engagement';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const c = (id: string, extra: Partial<CommentView> = {}): CommentView => ({
  commentId: id, authorId: 'u1', authorName: 'ali', isPostAuthor: false, isMine: false, canDelete: false,
  parentCommentId: null, text: id, createdAtUtc: '2026-09-23T10:00:00Z', replies: [], ...extra,
});
const page = (items: CommentView[], n = 1, hasMore = false): CommentPage => ({ postId: 'p', items, page: n, pageSize: 20, totalCount: items.length, commentCount: countComments(items), hasMore });

run('like toggles optimistically and never goes negative', () => {
  check(JSON.stringify(toggleLike({ liked: false, count: 3 })) === JSON.stringify({ liked: true, count: 4 }), 'like');
  check(JSON.stringify(toggleLike({ liked: true, count: 4 })) === JSON.stringify({ liked: false, count: 3 }), 'unlike');
  check(toggleLike({ liked: true, count: 0 }).count === 0, 'floor');
});
run('comment validation matches the server (trimmed, 500 max)', () => {
  check(commentState('   ').empty, 'blank');
  check(!commentState('a'.repeat(COMMENT_MAX)).tooLong && commentState('a'.repeat(COMMENT_MAX + 1)).tooLong, 'limit');
  check(commentState('  hi  ').trimmed === 'hi' && COMMENT_MAX === 500, 'trim');
});
run('counts are short and localised', () => {
  check(formatCount(0) === '0' && formatCount(950) === '950', 'small');
  check(formatCount(1200, 'tr') === '1,2B' && formatCount(1200, 'en') === '1.2K', 'thousands');
  check(formatCount(15_400, 'en') === '15K' && formatCount(2_000_000) === '2M', 'large');
  check(formatCount(-3) === '0' && formatCount(Number.NaN) === '0', 'bad input');
});
run('a poll replaces page 1 but keeps what I just wrote until the server has it', () => {
  const pending = optimisticComment({ localId: 'local-1', text: 'yeni', authorName: 'me', authorId: 'me', isPostAuthor: false, nowIso: 'x' });
  const merged = mergeCommentPages([pending, c('a')], page([c('b'), c('a')]));
  check(merged.map((x) => x.commentId).join() === 'local-1,b,a', `kept pending first: ${merged.map((x) => x.commentId)}`);
  const confirmed = mergeCommentPages(merged, page([c('b'), c('a')]).items.length ? page([c('local-1'), c('b')]) : page([]));
  check(confirmed.filter((x) => x.commentId === 'local-1').length === 1, 'no duplicate once confirmed');
  const reply = optimisticComment({ localId: 'local-2', text: 'r', authorName: 'me', authorId: 'me', isPostAuthor: false, parentCommentId: 'a', nowIso: 'x' });
  const withReply = insertComment([c('a')], reply);
  const polled = mergeCommentPages(withReply, page([c('a')]));
  check(polled[0].replies?.some((r) => r.commentId === 'local-2'), 'pending reply survives a poll');
});
run('later pages append without duplicates', () => {
  const merged = mergeCommentPages([c('a'), c('b')], page([c('b'), c('c')], 2));
  check(merged.map((x) => x.commentId).join() === 'a,b,c', 'appended');
});
run('insert, confirm and remove keep the thread shape', () => {
  const pending = optimisticComment({ localId: 'l', text: 't', authorName: 'me', authorId: 'me', isPostAuthor: true, parentCommentId: 'a', nowIso: 'x' });
  check(pending.pending && !pending.canDelete && pending.isMine, 'pending comment cannot be deleted yet');
  let items = insertComment([c('a')], pending);
  check(items[0].replies?.[0].commentId === 'l', 'reply nested');
  items = confirmComment(items, 'l', 'srv');
  check(items[0].replies?.[0].commentId === 'srv' && items[0].replies?.[0].canDelete && !items[0].replies?.[0].pending, 'confirmed');
  check(countComments(items) === 2, 'counts replies');
  check(countComments(removeComment(items, 'srv')) === 1, 'remove reply');
  check(removeComment(items, 'a').length === 0, 'remove top-level takes replies');
  check(insertComment([c('a')], c('z'))[0].commentId === 'z', 'top-level goes first');
});
run('replies collapse past the first one', () => {
  const parent = c('a', { replies: [c('r1'), c('r2'), c('r3')] });
  const collapsed = visibleReplies(parent, false);
  check(collapsed.shown.length === 1 && collapsed.hidden === 2, 'collapsed');
  check(visibleReplies(parent, true).hidden === 0 && visibleReplies(c('b', { replies: [c('x')] }), false).hidden === 0, 'expanded / single');
});
run('server codes map to translated errors', () => {
  check(engagementErrorKey('CANNOT_LIKE_OWN') === 'errors:engagement.cannotLikeOwn', 'own');
  check(engagementErrorKey('COMMENT_TOO_LONG') === 'errors:engagement.commentTooLong', 'long');
  check(engagementErrorKey('WHATEVER') === 'errors:generic' && engagementErrorKey(undefined) === 'errors:generic', 'fallback');
});
run('a confirmed comment stays while the read model catches up, then leaves the grace to the server', () => {
  const sent = insertComment([c('a')], optimisticComment({ localId: 'local-9', text: 'yeni', authorName: 'me', authorId: 'me', isPostAuthor: false, nowIso: 'x' }));
  const confirmed = confirmComment(sent, 'local-9', 'srv-9', 1_000);
  // The server's list lags behind the write: the comment must not vanish.
  const polled = mergeCommentPages(confirmed, page([c('a')]), 1_000 + 5_000);
  check(polled.some((x) => x.commentId === 'srv-9'), 'kept while the list lags');
  check(countComments(polled) === 2, 'and counted');
  // Once the server has it, it comes from the server (once).
  const caughtUp = mergeCommentPages(polled, page([c('srv-9'), c('a')]), 1_000 + 8_000);
  check(caughtUp.filter((x) => x.commentId === 'srv-9').length === 1, 'no duplicate');
  // A comment the server never shows (deleted meanwhile) does not linger forever.
  const late = mergeCommentPages(confirmed, page([c('a')]), 1_000 + 60_000);
  check(!late.some((x) => x.commentId === 'srv-9'), 'grace ends');
});
