import { followAfter, followButton, followerCountAfter, mergeFollowPage, profileLocked } from '../src/follows';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('follow button follows the state; "follow back" when they follow me; none for myself', () => {
  check(followButton('none')?.labelKey === 'follow.follow' && followButton('none')?.primary, 'follow');
  check(followButton(undefined, true)?.labelKey === 'follow.followBack', 'follow back');
  check(followButton('following')?.action === 'unfollow' && !followButton('following')?.primary, 'following');
  check(followButton('requested')?.action === 'cancel', 'requested');
  check(followButton('self') === null, 'self');
});
run('optimistic state: a private account turns a follow into a request', () => {
  check(followAfter('follow', false) === 'following' && followAfter('follow', true) === 'requested', 'follow');
  check(followAfter('unfollow', false) === 'none' && followAfter('cancel', true) === 'none', 'back to none');
});
run('follower count moves only for real follows', () => {
  check(followerCountAfter(3, 'none', 'following') === 4 && followerCountAfter(3, 'following', 'none') === 2, '+/-');
  check(followerCountAfter(3, 'none', 'requested') === 3 && followerCountAfter(0, 'following', 'none') === 0, 'requests / floor');
});
run('private profiles I cannot see are locked', () => {
  check(profileLocked({ isPrivate: true, canSeeContent: false }) && !profileLocked({ isPrivate: true, canSeeContent: true }), 'lock');
  check(!profileLocked(null) && !profileLocked({ isPrivate: false }), 'open');
});
run('follow list pages append without duplicates', () => {
  const a = [{ id: '1' }, { id: '2' }];
  check(mergeFollowPage(a, [{ id: '2' }, { id: '3' }], 2).map((x) => x.id).join() === '1,2,3', 'append');
  check(mergeFollowPage(a, [{ id: '9' }], 1).map((x) => x.id).join() === '9', 'first page replaces');
});
