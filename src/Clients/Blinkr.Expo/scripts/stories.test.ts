import { STORY_QUICK_REACTIONS, STORY_VIDEO_MAX_SECONDS, firstUnseenIndex, sortViewers, storySwipe, withStoryLike, nextStep, previousStep, segmentFill, storyReplyText, storySeconds, trayRing } from '../src/stories';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('each story has a sensible screen time', () => {
  check(storySeconds({ mediaType: 'Image', durationSeconds: 3 }) === 3 && storySeconds({ mediaType: 'Image', durationSeconds: 0 }) === 5, 'photo');
  check(storySeconds({ mediaType: 'Video', durationSeconds: 0 }) === STORY_VIDEO_MAX_SECONDS, 'untimed clip');
});
run('watching starts at the first unseen story', () => {
  check(firstUnseenIndex([{ seen: true }, { seen: false }, { seen: false }]) === 1, 'unseen');
  check(firstUnseenIndex([{ seen: true }, { seen: true }]) === 0 && firstUnseenIndex([]) === 0, 'all seen / empty');
});
run('next / previous / close', () => {
  const next = nextStep(0, 2);
  check(next.kind === 'story' && next.index === 1, 'next');
  check(nextStep(1, 2).kind === 'close', 'close after last');
  const prev = previousStep(0);
  check(prev.kind === 'story' && prev.index === 0, 'first restarts');
});
run('progress segments', () => {
  check(segmentFill(0, 1, 0.5) === 1 && segmentFill(1, 1, 0.5) === 0.5 && segmentFill(2, 1, 0.5) === 0, 'fill');
  check(segmentFill(1, 1, 7) === 1 && segmentFill(1, 1, Number.NaN) === 0, 'clamped');
});
run('replies are plain DMs, clearly marked, trimmed and capped', () => {
  check(storyReplyText('  çok   güzel ') === '↩ Hikayene yanıt: çok güzel', 'marked');
  check(storyReplyText('   ') === '' && storyReplyText('x'.repeat(400)).length === '↩ Hikayene yanıt: '.length + 300, 'empty / cap');
});
run('tray rings', () => {
  check(trayRing({ isMine: true, allSeen: true, storyCount: 0 }) === 'add', 'add');
  check(trayRing({ isMine: false, allSeen: false, storyCount: 2 }) === 'unseen' && trayRing({ isMine: false, allSeen: true, storyCount: 1 }) === 'seen', 'rings');
});
run('the heart flips one story and counts as seen', () => {
  const start: { id: string; seen: boolean; likedByMe?: boolean }[] = [{ id: 'a', seen: false, likedByMe: false }, { id: 'b', seen: false, likedByMe: false }];
  const list = withStoryLike(start, 'a', true);
  check(list[0].likedByMe === true && list[0].seen === true && list[1].likedByMe === false && list[1].seen === false, 'like');
  const back = withStoryLike(list, 'a', false);
  check(back[0].likedByMe === false && back[0].seen === true, 'unlike keeps seen');
});
run('viewers with a heart come first', () => {
  const sorted = sortViewers([
    { userId: '1', userName: 'a', seenAtUtc: '2026-09-24T10:00:00Z' },
    { userId: '2', userName: 'b', seenAtUtc: '2026-09-24T09:00:00Z', liked: true },
    { userId: '3', userName: 'c', seenAtUtc: '2026-09-24T11:00:00Z' },
  ]);
  check(sorted.map((v) => v.userId).join() === '2,3,1', 'order');
});
run('swipes: down closes, sideways changes person, short does nothing', () => {
  check(storySwipe(5, 120) === 'close' && storySwipe(0, 10, 0, 1200) === 'close' && storySwipe(0, -150) === 'none', 'down');
  check(storySwipe(-120, 10) === 'nextAuthor' && storySwipe(120, 10) === 'previousAuthor', 'sideways');
  check(storySwipe(20, 15) === 'none', 'short');
});
run('six quick reactions', () => { check(STORY_QUICK_REACTIONS.length === 6 && new Set(STORY_QUICK_REACTIONS).size === 6, 'six distinct'); });
