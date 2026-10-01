/** D-032: the two sizes the server keeps. Lists load the small one, the profile the large one. */
export const PHOTO_LARGE = 640;
export const PHOTO_SMALL = 160;
export const DISPLAY_NAME_MAX = 40;

/** The centred square of a picture (the pickers crop square, but a gallery picture may still arrive uncropped). */
export function centerSquare(width: number, height: number) {
  const side = Math.max(1, Math.min(width, height));
  return { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side };
}

/** A display name as the server will keep it: spaces collapsed, at most 40 characters. */
export function displayNameState(raw: string) {
  const value = raw.replace(/\s+/g, ' ').trim();
  return { value, length: value.length, tooLong: value.length > DISPLAY_NAME_MAX, empty: value.length === 0 };
}
