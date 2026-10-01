import { centerSquare, displayNameState, DISPLAY_NAME_MAX } from '../src/profilePhotoRules';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('a profile photo is the centred square of the picture', () => {
  const wide = centerSquare(4000, 3000);
  check(wide.width === 3000 && wide.height === 3000 && wide.originX === 500 && wide.originY === 0, JSON.stringify(wide));
  const tall = centerSquare(1080, 1920);
  check(tall.width === 1080 && tall.originX === 0 && tall.originY === 420, JSON.stringify(tall));
  check(centerSquare(0, 0).width === 1, 'never a zero-sized crop');
});
run('a display name is trimmed like the server and limited to 40', () => {
  check(displayNameState('  Sude   Arslan ').value === 'Sude Arslan', 'collapsed');
  check(displayNameState('   ').empty, 'blank clears');
  check(displayNameState('a'.repeat(DISPLAY_NAME_MAX + 1)).tooLong, 'too long');
  check(!displayNameState('a'.repeat(DISPLAY_NAME_MAX)).tooLong, '40 is fine');
});
