import { DEFAULT_SIGNAL_EMOJI, signalEmoji } from '../src/signalEmoji';

const assert = {
  equal: (actual: unknown, expected: unknown, message = '') => { if (actual !== expected) throw new Error(`${message} expected ${String(expected)} got ${String(actual)}`); },
  notEqual: (actual: unknown, other: unknown, message = '') => { if (actual === other) throw new Error(`${message} should differ from ${String(other)}`); },
};

// The value decides when there is one: a calm crowd and a packed one must not look the same on the map.
assert.equal(signalEmoji('Crowd', 'Calm'), '😌');
assert.equal(signalEmoji('Crowd', 'Busy'), '🔥');
assert.notEqual(signalEmoji('Crowd', 'Calm'), signalEmoji('Crowd', 'Busy'));
assert.equal(signalEmoji('Queue', 'Over15'), '🐢');
assert.equal(signalEmoji('TemporaryStatus', 'Closed'), '🚧');
assert.equal(signalEmoji('TemporaryStatus', 'Open'), '✅');

// Without a value (or an unknown one) the type still has its own emote.
assert.equal(signalEmoji('Crowd', null), '👥');
assert.equal(signalEmoji('Crowd', 'SomethingNew'), '👥');
assert.equal(signalEmoji('Event'), '🎉');
assert.equal(signalEmoji('GeneralObservation'), '👀');

// Every type the app knows has an emote, and nothing unknown crashes.
for (const type of ['GeneralObservation', 'Crowd', 'Queue', 'TemporaryStatus', 'Offer', 'Event', 'NewOpening']) {
  assert.notEqual(signalEmoji(type), DEFAULT_SIGNAL_EMOJI, type);
}
assert.equal(signalEmoji('Unknown'), DEFAULT_SIGNAL_EMOJI);
assert.equal(signalEmoji(null), DEFAULT_SIGNAL_EMOJI);

console.log('PASS signal emotes: value-aware, every type covered, unknown types fall back');
