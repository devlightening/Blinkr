import { MIN_PASSWORD_LENGTH, authErrorKey, passwordLongEnough } from '../src/authErrors';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('identity codes become the app\'s own words', () => {
  check(authErrorKey('INVALID_CREDENTIALS') === 'errors:auth.INVALID_CREDENTIALS', 'credentials');
  check(authErrorKey('PASSWORD_TOO_SHORT') === 'errors:auth.PASSWORD_TOO_SHORT', 'short');
  check(authErrorKey('TOO_MANY_ATTEMPTS') === 'errors:auth.TOO_MANY_ATTEMPTS', 'throttled');
  check(authErrorKey('SOMETHING_ELSE') === null && authErrorKey(undefined) === null, 'others untouched');
});
run('passwords need at least 8 characters', () => {
  check(MIN_PASSWORD_LENGTH === 8 && !passwordLongEnough('1234567') && passwordLongEnough('12345678'), 'length');
});
