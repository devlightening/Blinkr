import { compareWithUsual, usualComparisonText, type PlaceRhythm } from '../src/placeRhythm';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

// Monday (1), 12:00 in Turkey; 12:00 is usually calm (0.2), 13:00 has too few people.
const rhythm = (level: number | null, enough = true): PlaceRhythm => ({
  enough, observations: 40, today: 1, currentHour: 12,
  days: [{ weekday: 1, hours: [{ hour: 12, level }, { hour: 13, level: null }] }],
});
const live = (signalValue: string, freshness = 'FRESH', signalType = 'Crowd') => ({ signalType, signalValue, freshness });

run('a crowded place at a usually calm hour reads "busier than usual"', () => {
  const c = compareWithUsual(rhythm(0.2), live('Busy'));
  check(c?.direction === 'busier' && c.now === 1 && c.usual === 0.2, `got ${JSON.stringify(c)}`);
  check(usualComparisonText(c!) === 'Şu an normalden kalabalık', 'sentence');
});

run('quieter, and within one step is "as usual"', () => {
  check(compareWithUsual(rhythm(0.9), live('Calm'))?.direction === 'quieter', 'quieter');
  check(compareWithUsual(rhythm(0.6), live('Moderate'))?.direction === 'usual', 'moderate at 0.6 is usual');
  check(compareWithUsual(rhythm(0.2), live('None', 'RECENT', 'Queue'))?.direction === 'usual', 'queue scale and RECENT count');
});

run('never a comparison without both sides being real', () => {
  check(compareWithUsual(rhythm(null), live('Busy')) === null, 'hour with too few people');
  check(compareWithUsual(rhythm(0.2, false), live('Busy')) === null, 'no rhythm yet');
  check(compareWithUsual(rhythm(0.2), live('Busy', 'STALE')) === null, 'stale live state');
  check(compareWithUsual(rhythm(0.2), live('Started', 'FRESH', 'Event')) === null, 'not a crowd/queue level');
  check(compareWithUsual(rhythm(0.2), null) === null && compareWithUsual(null, live('Busy')) === null, 'missing either side');
});
