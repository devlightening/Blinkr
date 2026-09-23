/**
 * Camera lenses and stickers for the in-app camera. Everything here is plain data plus a few pure helpers so
 * it can be tested without a device; the components only draw it.
 *
 * Lenses are colour treatments (tint layers + an optional vignette) that are shown live over the camera
 * preview and baked into photos. Video is recorded without a lens: a recording cannot be re-rendered on the
 * phone, and the UI says so instead of pretending.
 */
export type LensLayer = { color: string; opacity: number };
export type CameraLens = {
  id: string;
  label: string;
  /** Swatch colour shown on the lens selector. */
  swatch: string;
  layers: LensLayer[];
  /** 0..1 darkness at the corners. */
  vignette?: number;
};

export const CAMERA_LENSES: CameraLens[] = [
  { id: 'none', label: 'Normal', swatch: '#E9F1EC', layers: [] },
  { id: 'sunset', label: 'Gün batımı', swatch: '#FF8A3D', layers: [{ color: '#FF8A3D', opacity: 0.22 }, { color: '#FF3D7F', opacity: 0.1 }], vignette: 0.25 },
  { id: 'mint', label: 'Nane', swatch: '#65E6B5', layers: [{ color: '#65E6B5', opacity: 0.2 }] },
  { id: 'neon', label: 'Neon', swatch: '#D9FF57', layers: [{ color: '#D9FF57', opacity: 0.16 }, { color: '#159B72', opacity: 0.14 }], vignette: 0.3 },
  { id: 'ice', label: 'Buz', swatch: '#6FB7FF', layers: [{ color: '#6FB7FF', opacity: 0.22 }] },
  { id: 'retro', label: 'Retro', swatch: '#C9A26B', layers: [{ color: '#C9A26B', opacity: 0.3 }], vignette: 0.4 },
  { id: 'cinema', label: 'Sinema', swatch: '#3B4A63', layers: [{ color: '#0B1B3A', opacity: 0.18 }], vignette: 0.6 },
  { id: 'night', label: 'Gece', swatch: '#0B1220', layers: [{ color: '#0B1220', opacity: 0.38 }], vignette: 0.35 },
];

export const lensById = (id: string | null | undefined) => CAMERA_LENSES.find((lens) => lens.id === id) ?? CAMERA_LENSES[0];
/** True when a lens changes the picture (so a photo must be re-rendered instead of used as it is). */
export const lensChangesPicture = (lens: CameraLens) => lens.layers.length > 0 || Boolean(lens.vignette);

export type StickerKind = 'time' | 'label';
export type StickerDef = { id: string; kind: StickerKind; glyph: string; label: string };

/**
 * Stickers are decoration for the photo, not signal data: the signal itself (type and value) is chosen in
 * the composer and verified by the server. They are phrased around what helps someone decide about a place.
 */
export const STICKERS: StickerDef[] = [
  { id: 'time', kind: 'time', glyph: '🕒', label: '' },
  { id: 'crowded', kind: 'label', glyph: '👥', label: 'Kalabalık' },
  { id: 'queue', kind: 'label', glyph: '⏳', label: 'Sıra var' },
  { id: 'calm', kind: 'label', glyph: '🍃', label: 'Sakin' },
  { id: 'seat', kind: 'label', glyph: '🪑', label: 'Yer var' },
  { id: 'open', kind: 'label', glyph: '✅', label: 'Açık' },
  { id: 'closed', kind: 'label', glyph: '⛔', label: 'Kapalı' },
  { id: 'offer', kind: 'label', glyph: '🏷️', label: 'Fırsat' },
  { id: 'event', kind: 'label', glyph: '🎉', label: 'Etkinlik' },
  { id: 'roadwork', kind: 'label', glyph: '🚧', label: 'Yol çalışması' },
  { id: 'weather', kind: 'label', glyph: '☀️', label: 'Güzel hava' },
];

export const MAX_STICKERS = 6;
/** A signal clip is short: 15 s (sinyal-mvp-plan 05 §1.1 "Basılı tut = video (maks 15 sn, halka ilerlemesi)"). */
export const MAX_VIDEO_SECONDS = 15;
/** How far the shutter ring has filled while recording, 0..1. */
export const recordingProgress = (seconds: number) => Math.min(1, Math.max(0, Number.isFinite(seconds) ? seconds / MAX_VIDEO_SECONDS : 0));
/** Holding the shutter this long starts a video instead of taking a photo. */
export const HOLD_TO_RECORD_MS = 300;

const pad = (value: number) => String(value).padStart(2, '0');

/** "14:32" in the device's local time. */
export const clockLabel = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const stickerText = (sticker: StickerDef, now: Date) => (sticker.kind === 'time' ? clockLabel(now) : sticker.label);

/** "00:07" while recording. */
export const formatRecording = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
};

export type FlashMode = 'off' | 'on' | 'auto';
const FLASH_ORDER: FlashMode[] = ['off', 'on', 'auto'];
export const nextFlash = (mode: FlashMode): FlashMode => FLASH_ORDER[(FLASH_ORDER.indexOf(mode) + 1) % FLASH_ORDER.length];
export const flashLabel = (mode: FlashMode) => (mode === 'on' ? 'Flaş açık' : mode === 'auto' ? 'Flaş otomatik' : 'Flaş kapalı');

/** expo-camera zoom is a 0..1 fraction of the device maximum; people pinch to change it. */
export const clampZoom = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/** A friendly "1.0x".."5.0x" readout for the zoom pill. Cosmetic only - the real optical range differs per device. */
const ZOOM_LABEL_SPAN = 4;
export const zoomMultiplierLabel = (zoom: number) => `${(1 + clampZoom(zoom) * ZOOM_LABEL_SPAN).toFixed(1)}x`;

/** Keeps a sticker centre inside the picture so it can always be grabbed again. */
export const clampToFrame = (value: number, size: number, margin = 24) => Math.min(size - margin, Math.max(margin, value));

export type PlacedSticker = { key: string; stickerId: string; x: number; y: number; scale: number };

/** New stickers start near the middle and fan out a little so several never stack exactly. */
export const placeSticker = (existing: PlacedSticker[], stickerId: string, frame: { width: number; height: number }, now = Date.now()): PlacedSticker[] => {
  if (existing.length >= MAX_STICKERS) return existing;
  const offset = (existing.length % 4) * 26;
  return [...existing, { key: `${stickerId}-${now}-${existing.length}`, stickerId, x: frame.width / 2 + offset - 39, y: frame.height * 0.42 + offset, scale: 1 }];
};
