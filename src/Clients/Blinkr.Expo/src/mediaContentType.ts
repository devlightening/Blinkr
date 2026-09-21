export type UploadMediaKind = 'Image' | 'Video';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const TYPE_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'video/x-m4v': 'video/mp4',
};
const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
};

/** Canonical MIME type the server accepts for this asset; picker, Blob and file extension disagree often enough to matter. */
export const resolveUploadContentType = (
  mediaType: UploadMediaKind,
  pickerType?: string | null,
  blobType?: string | null,
  nameOrUri?: string | null,
) => {
  const allowed = mediaType === 'Video' ? VIDEO_TYPES : IMAGE_TYPES;
  const extension = (nameOrUri ?? '').split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  const candidates = [pickerType, blobType, EXTENSION_TYPES[extension]]
    .map((type) => (type ?? '').split(';')[0].trim().toLowerCase())
    .map((type) => TYPE_ALIASES[type] ?? type);
  return candidates.find((type) => allowed.includes(type)) ?? (mediaType === 'Video' ? 'video/mp4' : 'image/jpeg');
};

const UPLOAD_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
};

/** Server rejects file names with path or reserved characters; keep the name readable but safe. */
export const safeUploadFileName = (fileName: string | null | undefined, mediaType: UploadMediaKind, contentType: string) => {
  const base = (fileName ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return base || `blinkr-${mediaType === 'Video' ? 'video' : 'photo'}.${UPLOAD_EXTENSIONS[contentType] ?? 'bin'}`;
};
