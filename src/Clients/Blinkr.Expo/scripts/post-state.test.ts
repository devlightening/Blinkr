import { postLiveState, signalPinState } from '../src/live/postState';
import { signalTagParts } from '../src/live/liveLabels';
import type { AuthoredPost } from '../src/types';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const NOW = Date.parse('2026-10-04T12:00:00Z');
const ago = (min: number) => new Date(NOW - min * 60000).toISOString();

run('a fresh crowd post is a live state', () => {
  const s = postLiveState({ signalType: 'Crowd', signalValue: 'Calm', createdAtUtc: ago(4) }, NOW);
  check(s.source === 'live' && s.kind === 'calm', 'calm live');
});

run('an event post is the event kind', () => {
  const s = postLiveState({ signalType: 'Event', signalValue: 'Started', createdAtUtc: ago(25) }, NOW);
  check(s.source === 'live' && s.kind === 'event', 'event');
});

run('an observation, an expired or a 3 h+ old post is never live', () => {
  check(postLiveState({ signalType: 'GeneralObservation', signalValue: null, createdAtUtc: ago(2) }, NOW).source !== 'live', 'observation');
  check(postLiveState({ signalType: 'Crowd', signalValue: 'Busy', createdAtUtc: ago(10), expiresAtUtc: ago(1) }, NOW).source !== 'live', 'expired');
  check(postLiveState({ signalType: 'Crowd', signalValue: 'Busy', createdAtUtc: ago(200) }, NOW).source !== 'live', 'old');
});

run('an AuthoredPost (expiresAt, not expiresAtUtc) that has expired is not live', () => {
  const post: AuthoredPost = { id: 'p', title: '', content: '', createdAtUtc: ago(100), expiresAt: ago(40), signalType: 'Crowd', signalValue: 'Busy', identityDisclosure: 'LimitedProfile', mediaUrls: [] };
  check(postLiveState(post, NOW).source !== 'live', 'expired author post');
  check(postLiveState({ ...post, expiresAt: new Date(NOW + 20 * 60000).toISOString() }, NOW).source === 'live', 'unexpired author post');
});

run('map signal pins: a state signal reads like a place, an observation is a neutral ring that still shows freshness', () => {
  const NOW2 = Date.parse('2026-10-04T12:00:00Z');
  const ago2 = (min: number) => new Date(NOW2 - min * 60000).toISOString();
  const crowd = signalPinState({ signalType: 'Crowd', signalValue: 'Busy', createdAtUtc: ago2(6), expiresAt: new Date(NOW2 + 3000_000).toISOString() }, NOW2);
  check(crowd.kind === 'crowded' && crowd.source === 'live', 'busy crowd is a crowded live ring');
  const event = signalPinState({ signalType: 'Event', signalValue: 'Started', createdAtUtc: ago2(20) }, NOW2);
  check(event.kind === 'event', 'event signals get the event ring');
  const obs = signalPinState({ signalType: 'GeneralObservation', signalValue: null, createdAtUtc: ago2(30) }, NOW2);
  check(obs.kind === 'unknown' && obs.source === 'live' && obs.freshness < 1 && obs.freshness > 0, 'observation: neutral ring with an arc');
  check(signalTagParts(obs).state === 'Gözlem' && signalTagParts(crowd).state === 'Kalabalık', 'words');
  const ended = signalPinState({ signalType: 'Event', signalValue: 'Ended', createdAtUtc: ago2(30) }, NOW2);
  check(signalTagParts(ended).state === 'Bitti', 'ended event says so');
  const notice = signalPinState({ signalType: 'TemporaryStatus', signalValue: 'Notice', createdAtUtc: ago2(5) }, NOW2);
  check(signalTagParts(notice).state === 'Geçici', 'a notice is a temporary status');
  const old = signalPinState({ signalType: 'GeneralObservation', signalValue: null, createdAtUtc: ago2(200) }, NOW2);
  check(old.source === 'none', 'older than 3 h is never drawn as live');
  const expired = signalPinState({ signalType: 'GeneralObservation', signalValue: null, createdAtUtc: ago2(30), expiresAt: ago2(1) }, NOW2);
  check(expired.source === 'none', 'expired is not live');
});
