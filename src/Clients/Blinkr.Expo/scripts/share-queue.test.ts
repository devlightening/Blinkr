import { afterFailure, backoffMs, isRetryable, nextDue, summarize, type OutboxItem } from '../src/shareQueue';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const item = (id: string, createdAtUtc: string, extra: Partial<OutboxItem> = {}): OutboxItem => ({
  id, createdAtUtc, attempts: 0, nextAttemptAt: 0, status: 'pending', story: false, snapFriendIds: [], media: [],
  input: { title: '', content: 'x', latitude: 1, longitude: 1, accuracyMeters: 10, locationName: 'a', signalType: 'Crowd', audienceType: 'Public', identityDisclosure: 'LimitedProfile', locationPrecision: 'ApproximateArea' },
  ...extra,
});

run('backoff grows and caps at 5 minutes', () => {
  check(backoffMs(1) === 5_000 && backoffMs(2) === 15_000 && backoffMs(6) === 300_000 && backoffMs(40) === 300_000, 'steps');
});

run('only connection trouble and server hiccups are retried', () => {
  check(isRetryable(new Error('Network request failed')), 'offline');
  check(isRetryable(new Error('Bağlantı kurulamadı')), 'turkish offline');
  check(isRetryable(Object.assign(new Error('x'), { status: 503 })) && isRetryable(Object.assign(new Error('x'), { status: 429 })), '5xx / 429');
  check(!isRetryable(Object.assign(new Error('x'), { status: 422 })) && !isRetryable(Object.assign(new Error('x'), { status: 400 })), 'refusals');
  check(!isRetryable(new Error('Bu içerik topluluk kurallarına uymuyor.')), 'blocked content text');
});

run('failure backs off or stops', () => {
  const now = 1_000_000;
  const retry = afterFailure(item('a', '1'), new Error('Network request failed'), now);
  check(retry.status === 'pending' && retry.attempts === 1 && retry.nextAttemptAt === now + 5_000, 'retry later');
  const refused = afterFailure(item('a', '1'), Object.assign(new Error('Çok uzak'), { status: 422 }), now);
  check(refused.status === 'failed' && refused.lastError === 'Çok uzak', 'refused is kept, not retried');
});

run('the oldest due item goes first; not-yet-due and failed wait', () => {
  const items = [item('b', '2026-09-24T10:00:02Z'), item('a', '2026-09-24T10:00:01Z', { nextAttemptAt: 5_000 }), item('c', '2026-09-24T10:00:00Z', { status: 'failed' })];
  check(nextDue(items, 1_000)?.id === 'b', 'a is not due yet');
  check(nextDue(items, 6_000)?.id === 'a', 'a is due and older');
  const s = summarize([...items, item('d', '3', { status: 'sending' })]);
  check(s.waiting === 2 && s.failed === 1 && s.sending === 1, 'summary');
});
