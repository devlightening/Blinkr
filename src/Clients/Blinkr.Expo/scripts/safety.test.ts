import { REPORT_NOTE_MAX, canSendReport, orderPeople, primaryAction, relationAfter, relationLabel, reportReasons } from '../src/friends';
import { ONBOARDING_PAGES, isLastPage, nextPage, onboardingKey } from '../src/onboardingContent';
import type { Relation } from '../src/types';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('a blocked person offers "unblock", says "Engelli" and never becomes a friend by accident', () => {
  check(primaryAction('blocked')?.action === 'unblock' && primaryAction('blocked')?.label === 'Engeli kaldır', 'unblock is the main action');
  check(relationLabel('blocked') === 'Engelli', 'label');
  check(relationAfter('block') === 'blocked' && relationAfter('unblock') === 'none', 'block and unblock results');
  check(relationAfter('add') === 'outgoing' && relationAfter('accept') === 'friends', 'friend results are unchanged');
});
run('blocked people sort after everybody else', () => {
  const person = (userName: string, relation: Relation) => ({ userName, relation });
  const ordered = orderPeople([person('a', 'blocked'), person('b', 'none'), person('c', 'friends')]);
  check(ordered.map((p) => p.userName).join() === 'c,b,a', ordered.map((p) => p.userName).join());
});
run('report reasons: "wrong information" only for a signal; every reason has a label', () => {
  const user = reportReasons('user').map((item) => item.id);
  const signal = reportReasons('signal').map((item) => item.id);
  check(!user.includes('wrong_info') && signal.includes('wrong_info'), 'wrong_info is for signals');
  check(user.join() === 'spam,harassment,hate,nudity,violence,privacy,self_harm,other' && signal.length === 9, 'the full lists');
  check(!signal.includes('inappropriate'), 'the old catch-all is no longer offered');
  check([...reportReasons('user'), ...reportReasons('signal')].every((item) => item.label.length > 3), 'labels');
  check(new Set(signal).size === signal.length, 'ids are unique');
});
run('a report needs a reason; the note may be empty but not over the limit (measured like the server does)', () => {
  check(!canSendReport(null, ''), 'no reason: cannot send');
  check(canSendReport('spam', ''), 'a reason alone is enough');
  check(canSendReport('other', 'x'.repeat(REPORT_NOTE_MAX)) && !canSendReport('other', 'x'.repeat(REPORT_NOTE_MAX + 1)), 'note limit');
  check(canSendReport('other', '   ' + 'y '.repeat(100) + '   '), 'padding and repeated spaces do not count');
  check(REPORT_NOTE_MAX === 300, 'matches the server limit');
});
run('onboarding: three distinct cards in a fixed order, ending on privacy', () => {
  check(ONBOARDING_PAGES.map((page) => page.id).join() === 'know,signal,privacy', 'order');
  check(new Set(ONBOARDING_PAGES.map((page) => page.title)).size === 3 && ONBOARDING_PAGES.every((page) => page.title.length <= 32 && page.body.length <= 160), 'short, distinct copy');
});
run('onboarding paging stops at the last card', () => {
  check(!isLastPage(0) && !isLastPage(1) && isLastPage(2) && isLastPage(9), 'last page');
  check(nextPage(0) === 1 && nextPage(1) === 2 && nextPage(2) === 2 && nextPage(5) === 2, 'next page never overshoots');
});
run('the onboarding flag is per person and safe to use as a storage key', () => {
  check(onboardingKey('9be75963-a399-4c4d-8c44-cd6817acb801') === 'blinkr.onboarding.v1.9be75963-a399-4c4d-8c44-cd6817acb801', 'key');
  check(onboardingKey('a') !== onboardingKey('b'), 'different people, different keys');
  check(/^[A-Za-z0-9._-]+$/.test(onboardingKey('we/ird key!?#')), 'unsafe characters are removed');
});
