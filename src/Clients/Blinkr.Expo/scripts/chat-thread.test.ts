import { buildThread, dayLabel, lastOwnMessageId, receiptLabel, shouldPingTyping } from '../src/chatThread';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const now = new Date(2026, 8, 24, 15, 0);
const at = (d: number, h: number, m: number) => new Date(2026, 8, d, h, m).toISOString();
// Newest first, as the server sends them.
const messages = [
  { id: 'm5', senderId: 'me', createdAtUtc: at(24, 14, 32), seen: true, seenAtUtc: at(24, 14, 40) },
  { id: 'm4', senderId: 'me', createdAtUtc: at(24, 14, 30) },
  { id: 'm3', senderId: 'you', createdAtUtc: at(24, 14, 29) },
  { id: 'm2', senderId: 'you', createdAtUtc: at(23, 16, 34) },
  { id: 'm1', senderId: 'you', createdAtUtc: at(23, 16, 20) },
];

run('day labels', () => {
  check(dayLabel(at(24, 9, 0), now) === 'Bugün' && dayLabel(at(23, 9, 0), now) === 'Dün', 'today/yesterday');
  check(dayLabel(at(24, 9, 0), now, 'en') === 'Today', 'en');
  check(/Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar/.test(dayLabel(at(20, 9, 0), now)), 'weekday within a week: ' + dayLabel(at(20, 9, 0), now));
  check(/Eylül/.test(dayLabel(at(1, 9, 0), now)) && !/2026/.test(dayLabel(at(1, 9, 0), now)), 'this year date: ' + dayLabel(at(1, 9, 0), now));
  check(/2025/.test(dayLabel(new Date(2025, 0, 3).toISOString(), now)), 'older year');
});

run('groups and day separators in an inverted list', () => {
  const rows = buildThread(messages, 'me', now);
  const kinds = rows.map((r) => (r.type === 'day' ? `[${r.label}]` : r.key));
  check(JSON.stringify(kinds) === JSON.stringify(['m5', 'm4', 'm3', '[Bugün]', 'm2', 'm1', '[Dün]']), JSON.stringify(kinds));
  const byId = Object.fromEntries(rows.filter((r) => r.type === 'message').map((r) => [r.key, r])) as Record<string, { groupTop: boolean; groupBottom: boolean; mine: boolean }>;
  check(byId.m5.groupBottom && !byId.m5.groupTop && byId.m4.groupTop && !byId.m4.groupBottom, 'my two messages are one group');
  check(byId.m3.groupTop && byId.m3.groupBottom, 'a single message is its own group');
  check(byId.m2.groupTop && byId.m2.groupBottom && byId.m1.groupTop, 'fourteen minutes apart is not one group');
  check(byId.m5.mine && !byId.m3.mine, 'mine');
});

run('receipt under my newest message only', () => {
  check(lastOwnMessageId(messages, 'me') === 'm5', 'newest own');
  check(lastOwnMessageId([{ id: 'x', senderId: 'me', createdAtUtc: at(24, 1, 1), kind: 'unsent' }, { id: 's', senderId: 'me', createdAtUtc: at(24, 1, 0), kind: 'snap' }, ...messages], 'me') === 'm5', 'skips unsent and snaps');
  check(receiptLabel(messages[0]).startsWith('Görüldü ') && receiptLabel(messages[1]) === 'Gönderildi', 'labels');
  check(receiptLabel({ ...messages[0], seenAtUtc: null }) === 'Görüldü', 'older message without a time');
});

run('typing pings are throttled and only with text', () => {
  check(shouldPingTyping(0, 10_000, 'a') && !shouldPingTyping(9_000, 10_000, 'a') && !shouldPingTyping(0, 10_000, '  '), 'throttle');
});
