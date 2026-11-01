import { tx } from './i18n/tx';
/**
 * Avatars are drawn characters chosen from a small catalogue, never uploaded photos: nobody's face is stored
 * and there is nothing to moderate. A key is three digits - colour (0-7), face (0-5), accessory (0-5) - and the
 * server (IdentityService `AvatarCatalog`) accepts exactly the same set. People who never chose one still get a
 * stable, friendly default derived from their user id.
 */
export const AVATAR_COLORS = ['#9CCB7E', '#7FCFC0', '#EDBE7D', '#E7A2BE', '#B1A4E6', '#8DB4EA', '#E79A90', '#E2CB86'] as const;
export const AVATAR_COLOR_NAMES = [tx('profile:avatar.color0', 'Yeşil'), tx('profile:avatar.color1', 'Nane'), tx('profile:avatar.color2', 'Turuncu'), tx('profile:avatar.color3', 'Pembe'), tx('profile:avatar.color4', 'Mor'), tx('profile:avatar.color5', 'Mavi'), tx('profile:avatar.color6', 'Mercan'), tx('profile:avatar.color7', 'Sarı')] as const;
export const AVATAR_FACE_NAMES = [tx('profile:avatar.face0', 'Mutlu'), tx('profile:avatar.face1', 'Göz kırpan'), tx('profile:avatar.face2', 'Şaşkın'), tx('profile:avatar.face3', 'Uykulu'), tx('profile:avatar.face4', 'Kocaman gülen'), tx('profile:avatar.face5', 'Sırıtan')] as const;
export const AVATAR_ACCESSORY_NAMES = [tx('profile:avatar.acc0', 'Yok'), tx('profile:avatar.acc1', 'Gözlük'), tx('profile:avatar.acc2', 'Şapka'), tx('profile:avatar.acc3', 'Kulaklık'), tx('profile:avatar.acc4', 'Filiz'), tx('profile:avatar.acc5', 'Yanaklar')] as const;

export const AVATAR_COLOR_COUNT = AVATAR_COLORS.length;
export const AVATAR_FACE_COUNT = AVATAR_FACE_NAMES.length;
export const AVATAR_ACCESSORY_COUNT = AVATAR_ACCESSORY_NAMES.length;

export type AvatarConfig = { color: number; face: number; accessory: number };

export const isValidAvatarKey = (key: string | null | undefined): key is string => /^[0-7][0-5][0-5]$/.test(key ?? '');

export const parseAvatarKey = (key: string | null | undefined): AvatarConfig | null =>
  isValidAvatarKey(key) ? { color: Number(key[0]), face: Number(key[1]), accessory: Number(key[2]) } : null;

export const avatarKeyOf = (config: AvatarConfig) => `${config.color}${config.face}${config.accessory}`;

/** FNV-1a: small, dependency-free and stable across platforms. */
const hash = (text: string) => {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
};

/** The default avatar of someone who has not chosen one: always the same for the same seed. */
export const defaultAvatarKey = (seed: string) => {
  const value = hash(seed || 'blinkr');
  return avatarKeyOf({
    color: value % AVATAR_COLOR_COUNT,
    face: Math.floor(value / AVATAR_COLOR_COUNT) % AVATAR_FACE_COUNT,
    accessory: Math.floor(value / (AVATAR_COLOR_COUNT * AVATAR_FACE_COUNT)) % AVATAR_ACCESSORY_COUNT,
  });
};

/** The chosen avatar when it is a valid catalogue key, otherwise the default for `seed`. */
export const resolveAvatar = (avatarKey: string | null | undefined, seed: string): AvatarConfig =>
  parseAvatarKey(avatarKey) ?? (parseAvatarKey(defaultAvatarKey(seed)) as AvatarConfig);

export const randomAvatarConfig = (random: () => number = Math.random): AvatarConfig => ({
  color: Math.min(AVATAR_COLOR_COUNT - 1, Math.floor(random() * AVATAR_COLOR_COUNT)),
  face: Math.min(AVATAR_FACE_COUNT - 1, Math.floor(random() * AVATAR_FACE_COUNT)),
  accessory: Math.min(AVATAR_ACCESSORY_COUNT - 1, Math.floor(random() * AVATAR_ACCESSORY_COUNT)),
});
