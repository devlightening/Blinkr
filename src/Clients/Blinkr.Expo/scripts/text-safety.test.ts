import { isValidNationalId, personalDataKinds, personalDataNotice } from '../src/textSafety';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('national ID checksum', () => {
  check(isValidNationalId('10000000146'), 'valid TC checksum');
  check(!isValidNationalId('12345678901'), 'invalid TC checksum');
  check(!isValidNationalId('01234567890'), 'TC cannot start with 0');
});

run('personal data kinds', () => {
  const cases: [string, string[]][] = [
    ['Kafe çok kalabalık, 20 dakika sıra var', []],
    ['Saat 18 30 gibi gel', []],
    ['Sipariş no 12345678901', []],
    ['TC 10000000146 cüzdan bulundu', ['nationalId']],
    ['Ara: 0532 123 45 67', ['phone']],
    ['+90 532 123 4567', ['phone']],
    ['(0312) 123 45 67', ['phone']],
    ['34 ABC 123 plakalı araç', ['plate']],
    ['06AB1234 park etmiş', ['plate']],
    ['Atatürk Mahallesi Gül Sokak No: 5 Daire 3', ['address']],
    ['Gül Sokak çok güzel', []],
    ['221 Baker Street', ['address']],
  ];
  for (const [text, expected] of cases) {
    const got = personalDataKinds(text);
    check(same(got, expected), `${text}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  }
});

run('notice', () => {
  check(personalDataNotice('Başlık', null, '') === null, 'no notice');
  check(same(personalDataNotice('34 ABC 123', 'TC 10000000146'), { kinds: ['plate', 'nationalId'], allMasked: true }), 'masked kinds');
  check(same(personalDataNotice('0532 123 45 67 ara'), { kinds: ['phone'], allMasked: false }), 'phone is not masked');
});
