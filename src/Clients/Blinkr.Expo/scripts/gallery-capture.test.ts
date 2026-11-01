import { GALLERY_LIVE_WINDOW_MS, capturedAtOf, isStaleCapture, oldestCapture, parseExifDate } from '../src/galleryCapture';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('EXIF dates are parsed as local time; junk is ignored', () => {
  const date = parseExifDate('2026:09:23 14:05:12');
  check(date && date.getFullYear() === 2026 && date.getMonth() === 8 && date.getHours() === 14 && date.getSeconds() === 12, 'parsed');
  check(parseExifDate('yesterday') === null && parseExifDate(42) === null && parseExifDate(undefined) === null, 'junk');
});
run('capture time prefers an already resolved value, then EXIF original', () => {
  check(capturedAtOf({ capturedAtUtc: '2026-09-23T10:00:00.000Z' })?.toISOString() === '2026-09-23T10:00:00.000Z', 'resolved');
  check(capturedAtOf({ exif: { DateTime: '2026:09:23 10:00:00', DateTimeOriginal: '2026:09:22 10:00:00' } })?.getDate() === 22, 'original wins');
  check(capturedAtOf({ exif: {} }) === null && capturedAtOf(null) === null, 'unknown');
});
run('older than two hours is stale; unknown is not', () => {
  const now = Date.now();
  check(isStaleCapture(new Date(now - GALLERY_LIVE_WINDOW_MS - 1000), now) && !isStaleCapture(new Date(now - 60_000), now), 'window');
  check(!isStaleCapture(null, now), 'unknown');
});
run('the oldest attached photo decides', () => {
  const a = new Date('2026-09-23T10:00:00Z'); const b = new Date('2026-09-20T10:00:00Z');
  check(oldestCapture([a, null, b]) === b && oldestCapture([null]) === null, 'oldest');
});
