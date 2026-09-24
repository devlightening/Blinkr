import { checkBirthYear } from '../src/ageGate';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('birth year rules match the server', () => {
  check(checkBirthYear('', 2026).problem === 'empty', 'empty');
  check(checkBirthYear('20a1', 2026).problem === 'invalid' && checkBirthYear('1899', 2026).problem === 'invalid' && checkBirthYear('2027', 2026).problem === 'invalid', 'invalid');
  check(checkBirthYear('2013', 2026).problem === 'tooYoung', '2013 may still be 12');
  const teen = checkBirthYear('2011', 2026);
  check(teen.problem === null && teen.minor, '2011 is a minor');
  const edge = checkBirthYear('2008', 2026);
  check(edge.problem === null && edge.minor, '2008 may still be 17');
  check(checkBirthYear('2007', 2026).minor === false && checkBirthYear(' 1990 ', 2026).year === 1990, 'adult');
});
