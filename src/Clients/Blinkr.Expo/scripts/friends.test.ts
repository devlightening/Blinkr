import { BIO_MAX, badgeText, bioState, cleanBio, formatJoined, orderPeople, primaryAction, relationAfter, relationLabel } from '../src/friends';
import type { Relation } from '../src/types';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('bio: whitespace and line breaks collapse; the limit is counted on what is stored', () => {
  check(cleanBio('  Kahve   ve\n\nyürüyüş  ') === 'Kahve ve yürüyüş', 'collapsed');
  check(bioState('   ').empty && bioState('').length === 0, 'blank is empty');
  check(!bioState('a'.repeat(BIO_MAX)).tooLong && bioState('a'.repeat(BIO_MAX + 1)).tooLong, 'limit');
  check(!bioState('a  '.repeat(60)).tooLong || bioState('a '.repeat(200)).tooLong, 'padding does not count as text');
  check(BIO_MAX === 160, 'matches the server limit');
});
run('primary action follows the relation; friends and yourself have none', () => {
  check(primaryAction('none')?.action === 'add' && primaryAction(undefined)?.action === 'add', 'add');
  check(primaryAction('outgoing')?.action === 'cancel', 'cancel');
  check(primaryAction('incoming')?.action === 'accept', 'accept');
  check(primaryAction('friends') === null && primaryAction('self') === null, 'no button');
});
run('relation labels only say something when there is something to say', () => {
  check(relationLabel('friends') === 'Arkadaş' && relationLabel('outgoing') === 'İstek gönderildi' && relationLabel('incoming') === 'Seni ekledi', 'labels');
  check(relationLabel('none') === '' && relationLabel('self') === '' && relationLabel(undefined) === '', 'quiet');
});
run('optimistic result of each action', () => {
  check(relationAfter('add') === 'outgoing' && relationAfter('accept') === 'friends', 'forward');
  check(relationAfter('cancel') === 'none' && relationAfter('decline') === 'none' && relationAfter('remove') === 'none', 'back to none');
});
run('people order: friends, then who asked me, then the rest; alphabetical inside a group', () => {
  const person = (userName: string, relation?: Relation) => ({ userName, relation });
  const ordered = orderPeople([person('zeynep'), person('ömer', 'friends'), person('ali'), person('çağla', 'incoming'), person('ayşe', 'friends'), person('deniz', 'outgoing')]);
  check(ordered.map((p) => p.userName).join() === 'ayşe,ömer,çağla,deniz,ali,zeynep', ordered.map((p) => p.userName).join());
  const input = [person('b'), person('a', 'friends')];
  orderPeople(input);
  check(input[0].userName === 'b', 'the input list is not mutated');
});
run('joined date is a readable Turkish month and year', () => {
  check(formatJoined('2026-09-21T10:00:00Z') === 'Eylül 2026 tarihinden beri', 'september');
  check(formatJoined('2026-01-01T00:00:00Z') === 'Ocak 2026 tarihinden beri', 'january');
  check(formatJoined('nonsense') === '' && formatJoined(null) === '' && formatJoined(undefined) === '', 'unusable date');
});
run('badge text caps at 99+', () => {
  check(badgeText(3) === '3' && badgeText(99) === '99' && badgeText(100) === '99+' && badgeText(-2) === '0', 'badge');
});
