import { MAX_DISCOVER_PAGES, canLikeFeedItem, canLoadMore, feedDistanceLabel, mergeDiscoverPage, toggleFeedLike, type DiscoverItem } from '../src/discoverFeed';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const item = (id: string, extra: Partial<DiscoverItem> = {}): DiscoverItem => ({
  id, title: id, content: '', signalType: 'Crowd', authorName: 'ali', authorId: 'u-ali', anonymous: false, createdAtUtc: '2026-09-23T10:00:00Z',
  expired: false, likeCount: 2, commentCount: 0, isLikedByCurrentUser: false, media: [], ...extra,
});

run('refresh replaces, later pages append without repeats', () => {
  const current = [item('a'), item('b')];
  check(mergeDiscoverPage(current, { items: [item('c')], page: 1, pageSize: 20, hasMore: false }).map((x) => x.id).join() === 'c', 'replace');
  check(mergeDiscoverPage(current, { items: [item('b'), item('d')], page: 2, pageSize: 20, hasMore: false }).map((x) => x.id).join() === 'a,b,d', 'append');
});
run('no endless scroll', () => {
  check(canLoadMore({ items: [], page: 1, pageSize: 20, hasMore: true }) && !canLoadMore({ items: [], page: MAX_DISCOVER_PAGES, pageSize: 20, hasMore: true }), 'cap');
  check(!canLoadMore(null) && !canLoadMore({ items: [], page: 1, pageSize: 20, hasMore: false }), 'done');
});
run('like toggles in the list, never below zero', () => {
  const liked = toggleFeedLike([item('a'), item('b')], 'a');
  check(liked[0].isLikedByCurrentUser && liked[0].likeCount === 3 && liked[1].likeCount === 2, 'like');
  check(toggleFeedLike([item('a', { isLikedByCurrentUser: true, likeCount: 0 })], 'a')[0].likeCount === 0, 'floor');
});
run('distance labels', () => {
  check(feedDistanceLabel(150) === '~150 m' && feedDistanceLabel(1250) === '1,3 km' && feedDistanceLabel(1250, 'en') === '1.3 km', 'labels');
  check(feedDistanceLabel(null) === '' && feedDistanceLabel(undefined) === '', 'none');
});
run('you cannot like your own signal; an anonymous one is not known to be yours', () => {
  check(!canLikeFeedItem({ authorId: 'me', anonymous: false }, 'me') && canLikeFeedItem({ authorId: 'u', anonymous: false }, 'me'), 'own');
  check(canLikeFeedItem({ authorId: null, anonymous: true }, 'me'), 'anon');
});
