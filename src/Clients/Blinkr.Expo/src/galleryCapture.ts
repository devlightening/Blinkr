/**
 * Gallery photos (sinyal-mvp-plan P5.11). The capture time is read from the picture's EXIF on the phone - the
 * server strips EXIF on upload - and sent with the signal. The server only ever uses it to LOWER trust: a photo
 * older than two hours cannot vouch for "right now" (BlogService GalleryMediaPolicy). Pure logic, no RN imports.
 */
export const GALLERY_LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** EXIF "2026:09:23 14:05:12" (device local time) → Date; anything else → null. */
export const parseExifDate = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(date.getTime()) ? null : date;
};

type AssetLike = { exif?: Record<string, unknown> | null; capturedAtUtc?: string | null };

/** The moment the picture was taken, if the asset says so (EXIF from the gallery, or already resolved upstream). */
export const capturedAtOf = (asset: AssetLike | null | undefined): Date | null => {
  if (!asset) return null;
  if (asset.capturedAtUtc) {
    const known = new Date(asset.capturedAtUtc);
    if (!Number.isNaN(known.getTime())) return known;
  }
  const exif = asset.exif ?? null;
  return exif ? parseExifDate(exif.DateTimeOriginal) ?? parseExifDate(exif.DateTimeDigitized) ?? parseExifDate(exif.DateTime) : null;
};

export const isStaleCapture = (capturedAt: Date | null, now = Date.now()) =>
  capturedAt !== null && now - capturedAt.getTime() > GALLERY_LIVE_WINDOW_MS;

/** The oldest capture among the attached media decides (one stale photo is enough to not be "live"). */
export const oldestCapture = (dates: Array<Date | null>) =>
  dates.reduce<Date | null>((oldest, date) => (date && (!oldest || date < oldest) ? date : oldest), null);
