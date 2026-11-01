import {
  AVATAR_ACCESSORY_COUNT, AVATAR_COLORS, AVATAR_COLOR_COUNT, AVATAR_FACE_COUNT, AVATAR_COLOR_NAMES, AVATAR_FACE_NAMES, AVATAR_ACCESSORY_NAMES,
  avatarKeyOf, defaultAvatarKey, isValidAvatarKey, parseAvatarKey, randomAvatarConfig, resolveAvatar,
} from '../src/avatars';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('catalogue sizes match the server (8 x 6 x 6) and every option is named', () => {
  check(AVATAR_COLOR_COUNT === 8 && AVATAR_FACE_COUNT === 6 && AVATAR_ACCESSORY_COUNT === 6, 'counts must match IdentityService AvatarCatalog');
  check(AVATAR_COLOR_NAMES.length === 8 && AVATAR_FACE_NAMES.length === 6 && AVATAR_ACCESSORY_NAMES.length === 6, 'names for every option');
  check(AVATAR_COLORS.every((color) => /^#[0-9A-Fa-f]{6}$/.test(color)), 'colours are hex');
});
run('validation accepts exactly the catalogue keys', () => {
  check(isValidAvatarKey('000') && isValidAvatarKey('755') && isValidAvatarKey('253'), 'valid keys');
  for (const bad of ['', '75', '7555', '855', '765', '756', 'abc', '2 3', '<sc', null, undefined]) check(!isValidAvatarKey(bad as string | null | undefined), `invalid: ${String(bad)}`);
  let valid = 0;
  for (let a = 0; a <= 9; a += 1) for (let b = 0; b <= 9; b += 1) for (let c = 0; c <= 9; c += 1) if (isValidAvatarKey(`${a}${b}${c}`)) valid += 1;
  check(valid === 8 * 6 * 6, 'exactly 288 keys are valid');
});
run('parse and build round-trip', () => {
  check(avatarKeyOf({ color: 2, face: 5, accessory: 3 }) === '253', 'build');
  const config = parseAvatarKey('253');
  check(config && config.color === 2 && config.face === 5 && config.accessory === 3, 'parse');
  check(parseAvatarKey('999') === null && parseAvatarKey(null) === null, 'parse rejects junk');
});
run('default avatar is stable, valid and well spread', () => {
  check(defaultAvatarKey('9be75963-a399-4c4d-8c44-cd6817acb801') === defaultAvatarKey('9be75963-a399-4c4d-8c44-cd6817acb801'), 'stable');
  const seen = new Set<string>();
  for (let i = 0; i < 300; i += 1) {
    const key = defaultAvatarKey(`user-${i}-${i * 7919}`);
    check(isValidAvatarKey(key), `default must be valid: ${key}`);
    seen.add(key);
  }
  check(seen.size > 80, `defaults should spread over the catalogue, got ${seen.size} distinct`);
  check(isValidAvatarKey(defaultAvatarKey('')), 'empty seed still valid');
});
run('resolve prefers a valid choice and falls back to the default', () => {
  check(resolveAvatar('253', 'seed').face === 5, 'chosen wins');
  check(avatarKeyOf(resolveAvatar(null, 'seed')) === defaultAvatarKey('seed'), 'default for null');
  check(avatarKeyOf(resolveAvatar('junk', 'seed')) === defaultAvatarKey('seed'), 'default for invalid');
});
run('random avatars stay inside the catalogue, even at the edges of the range', () => {
  for (const value of [0, 0.5, 0.999999, 1]) {
    const config = randomAvatarConfig(() => value);
    check(isValidAvatarKey(avatarKeyOf(config)), `random(${value}) must be valid`);
  }
  check(avatarKeyOf(randomAvatarConfig(() => 0)) === '000' && avatarKeyOf(randomAvatarConfig(() => 1)) === '755', 'edges');
});
