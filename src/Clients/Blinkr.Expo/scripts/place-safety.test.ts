import { accuracyUncertain, emergencyNumber, mediaAllowedAt, placeSensitivity } from '../src/placeSafety';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('sensitive categories are recognised, case-insensitively', () => {
  check(placeSensitivity('EDUCATION') === 'education' && placeSensitivity('education') === 'education', 'education');
  check(placeSensitivity('HEALTH') === 'health' && placeSensitivity('PHARMACY') === 'health', 'health');
  check(placeSensitivity('MOSQUE') === 'worship' && placeSensitivity('PLACE_OF_WORSHIP') === 'worship', 'worship');
  check(placeSensitivity('CAFE') === null && placeSensitivity(null) === null && placeSensitivity('') === null, 'ordinary');
});
run('media is blocked only at education places (matches the server rule)', () => {
  check(!mediaAllowedAt('EDUCATION'), 'school');
  check(mediaAllowedAt('HEALTH') && mediaAllowedAt('CAFE') && mediaAllowedAt(undefined), 'others');
});
run('accuracy over 100 m is uncertain', () => {
  check(!accuracyUncertain(100) && accuracyUncertain(101), 'threshold');
  check(!accuracyUncertain(null) && !accuracyUncertain(Number.NaN), 'unknown is not flagged');
});
run('emergency numbers by country', () => {
  check(emergencyNumber('TR') === '112' && emergencyNumber('de') === '112' && emergencyNumber(undefined) === '112', '112');
  check(emergencyNumber('US') === '911' && emergencyNumber('GB') === '999', 'others');
});
