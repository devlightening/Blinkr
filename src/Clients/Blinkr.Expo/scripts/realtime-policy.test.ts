import { REFETCH_SCHEDULE_MS, SAFETY_POLL_MS, isFor, nextRefetchDelay, pollIntervalMs } from '../src/realtimePolicy';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('polling slows to the safety net only while the hub is live', () => {
  check(pollIntervalMs(false, 4000) === 4000, 'offline keeps its speed');
  check(pollIntervalMs(true, 4000) === SAFETY_POLL_MS, 'live = safety net');
  check(pollIntervalMs(true, 60_000) === 60_000, 'never faster than before');
});
run('refetch retries follow the schedule, then stop', () => {
  const delays: number[] = [];
  for (let attempt = 0; ; attempt += 1) { const d = nextRefetchDelay(attempt); if (d === null) break; delays.push(d); }
  check(delays.length === REFETCH_SCHEDULE_MS.length - 1, 'count');
  check(delays.reduce((a, b) => a + b, 0) === REFETCH_SCHEDULE_MS[REFETCH_SCHEDULE_MS.length - 1], 'total');
});
run('events are matched to their screen by id', () => {
  check(isFor({ conversationId: 'ABC' }, 'conversationId', 'abc'), 'case');
  check(!isFor({ conversationId: 'x' }, 'conversationId', 'y') && !isFor(null, 'postId', 'y') && !isFor({ postId: 1 }, 'postId', '1') && !isFor({ postId: 'a' }, 'postId', null), 'no match');
});
