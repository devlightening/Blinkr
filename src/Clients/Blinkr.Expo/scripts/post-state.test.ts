import { postLiveState } from '../src/live/postState';

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
