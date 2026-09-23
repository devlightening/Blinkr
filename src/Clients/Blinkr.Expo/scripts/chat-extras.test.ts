import { applyReaction, canReact, canUnsend, newClientId, nextReaction, reactionSummary, signalShareOf } from '../src/chatExtras';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('client ids are distinct per send', () => {
  check(newClientId(1, 0.1) !== newClientId(1, 0.2) && newClientId(1, 0.1) === newClientId(1, 0.1), 'deterministic for the same inputs');
  check(newClientId().length <= 64, 'fits the server limit');
});
run('reactions: grouped in the fixed order, mine marked', () => {
  const summary = reactionSummary([{ userId: 'a', emoji: '🔥' }, { userId: 'b', emoji: '❤️' }, { userId: 'me', emoji: '❤️' }], 'me');
  check(summary.length === 2 && summary[0].emoji === '❤️' && summary[0].count === 2 && summary[0].mine && summary[1].emoji === '🔥', 'grouped');
  check(reactionSummary(null, 'me').length === 0, 'none');
});
run('pressing my own emoji again clears it; another replaces it', () => {
  check(nextReaction([{ userId: 'me', emoji: '😂' }], 'me', '😂') === null, 'clear');
  check(nextReaction([{ userId: 'me', emoji: '😂' }], 'me', '👍') === '👍' && nextReaction([], 'me', '❤️') === '❤️', 'set');
  check(applyReaction([{ userId: 'x', emoji: '🔥' }, { userId: 'me', emoji: '😂' }], 'me', '👍').length === 2, 'one per person');
  check(applyReaction([{ userId: 'me', emoji: '😂' }], 'me', null).length === 0, 'cleared');
});
run('only my own text or shared signal can be taken back; snaps never', () => {
  check(canUnsend({ senderId: 'me', kind: 'text' }, 'me') && canUnsend({ senderId: 'me', kind: 'signal' }, 'me'), 'mine');
  check(!canUnsend({ senderId: 'x', kind: 'text' }, 'me') && !canUnsend({ senderId: 'me', kind: 'snap' }, 'me') && !canUnsend({ senderId: 'me', kind: 'unsent' }, 'me'), 'not');
  check(canReact({ senderId: 'x', kind: 'text' }) && !canReact({ senderId: 'x', kind: 'unsent' }), 'react');
});
run('a shared signal carries a link and a snapshot, never the author', () => {
  const share = signalShareOf({ id: 'p1', signalType: 'Queue', signalValue: 'Over15', title: '  Eczane  ', locationName: '', authorName: 'ali' } as never);
  check(share.postId === 'p1' && share.title === 'Eczane' && share.locationName === null, 'snapshot');
  check(!('authorName' in share), 'no author');
});
