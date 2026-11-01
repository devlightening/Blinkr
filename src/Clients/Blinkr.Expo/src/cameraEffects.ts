import { tx } from './i18n/tx';
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
  { id: 'none', label: tx('create:lens.none', 'Normal'), swatch: '#E9F1EC', layers: [] },
  { id: 'sunset', label: tx('create:lens.sunset', 'Gün batımı'), swatch: '#FF8A3D', layers: [{ color: '#FF8A3D', opacity: 0.22 }, { color: '#FF3D7F', opacity: 0.1 }], vignette: 0.25 },
  { id: 'mint', label: tx('create:lens.mint', 'Nane'), swatch: '#65E6B5', layers: [{ color: '#65E6B5', opacity: 0.2 }] },
  { id: 'neon', label: tx('create:lens.neon', 'Neon'), swatch: '#D9FF57', layers: [{ color: '#D9FF57', opacity: 0.16 }, { color: '#159B72', opacity: 0.14 }], vignette: 0.3 },
  { id: 'ice', label: tx('create:lens.ice', 'Buz'), swatch: '#6FB7FF', layers: [{ color: '#6FB7FF', opacity: 0.22 }] },
  { id: 'retro', label: tx('create:lens.retro', 'Retro'), swatch: '#C9A26B', layers: [{ color: '#C9A26B', opacity: 0.3 }], vignette: 0.4 },
  { id: 'cinema', label: tx('create:lens.cinema', 'Sinema'), swatch: '#3B4A63', layers: [{ color: '#0B1B3A', opacity: 0.18 }], vignette: 0.6 },
  { id: 'night', label: tx('create:lens.night', 'Gece'), swatch: '#0B1220', layers: [{ color: '#0B1220', opacity: 0.38 }], vignette: 0.35 },
];

export const lensById = (id: string | null | undefined) => CAMERA_LENSES.find((lens) => lens.id === id) ?? CAMERA_LENSES[0];
/**
 * Swiping across the photo steps through the lenses (Snapchat). A swipe to the left (negative dx) goes to the next
 * lens, to the right the previous one; it wraps around. Small drags (under `LENS_SWIPE_MIN_PX`) change nothing.
 */
export const LENS_SWIPE_MIN_PX = 40;
export const lensAfterSwipe = (currentId: string, dx: number) => {
  if (!Number.isFinite(dx) || Math.abs(dx) < LENS_SWIPE_MIN_PX) return lensById(currentId).id;
  const index = Math.max(0, CAMERA_LENSES.findIndex((lens) => lens.id === currentId));
  const step = dx < 0 ? 1 : -1;
  return CAMERA_LENSES[(index + step + CAMERA_LENSES.length) % CAMERA_LENSES.length].id;
};

/** True when a lens changes the picture (so a photo must be re-rendered instead of used as it is). */
export const lensChangesPicture = (lens: CameraLens) => lens.layers.length > 0 || Boolean(lens.vignette);

export type StickerKind = 'time' | 'label' | 'emoji';
export type StickerDef = { id: string; kind: StickerKind; glyph: string; label: string };

/**
 * Stickers are decoration for the photo, not signal data: the signal itself (type and value) is chosen in
 * the composer and verified by the server. They are phrased around what helps someone decide about a place.
 */
export const STICKERS: StickerDef[] = [
  { id: 'time', kind: 'time', glyph: '🕒', label: '' },
  { id: 'crowded', kind: 'label', glyph: '👥', label: tx('create:sticker.crowded', 'Kalabalık') },
  { id: 'queue', kind: 'label', glyph: '⏳', label: tx('create:sticker.queue', 'Sıra var') },
  { id: 'calm', kind: 'label', glyph: '🍃', label: tx('create:sticker.calm', 'Sakin') },
  { id: 'seat', kind: 'label', glyph: '🪑', label: tx('create:sticker.seat', 'Yer var') },
  { id: 'open', kind: 'label', glyph: '✅', label: tx('create:sticker.open', 'Açık') },
  { id: 'closed', kind: 'label', glyph: '⛔', label: tx('create:sticker.closed', 'Kapalı') },
  { id: 'offer', kind: 'label', glyph: '🏷️', label: tx('create:sticker.offer', 'Fırsat') },
  { id: 'event', kind: 'label', glyph: '🎉', label: tx('create:sticker.event', 'Etkinlik') },
  { id: 'roadwork', kind: 'label', glyph: '🚧', label: tx('create:sticker.roadwork', 'Yol çalışması') },
  { id: 'weather', kind: 'label', glyph: '☀️', label: tx('create:sticker.weather', 'Güzel hava') },
  { id: 'parking', kind: 'label', glyph: '🅿️', label: tx('create:sticker.parking', 'Park yok') },
  // Plain emoji stickers: decoration only, no text.
  { id: 'e-fire', kind: 'emoji', glyph: '🔥', label: '' },
  { id: 'e-heart', kind: 'emoji', glyph: '❤️', label: '' },
  { id: 'e-laugh', kind: 'emoji', glyph: '😂', label: '' },
  { id: 'e-wow', kind: 'emoji', glyph: '😮', label: '' },
  { id: 'e-thumbs', kind: 'emoji', glyph: '👍', label: '' },
  { id: 'e-coffee', kind: 'emoji', glyph: '☕', label: '' },
];

/**
 * A type sticker hints what the signal is about, so the composer can start with that type already chosen
 * (sinyal-mvp-plan 05 §1.2 "Tip çıkartması eklenirse Detaylar adımında o tip otomatik seçilir"). It is only
 * a starting point - the person can change it, and the server still validates the signal.
 */
export type StickerSignal = { type: 'Crowd' | 'Queue' | 'TemporaryStatus' | 'Offer' | 'Event'; value: string | null };
const STICKER_SIGNALS: Record<string, StickerSignal> = {
  crowded: { type: 'Crowd', value: 'Busy' },
  calm: { type: 'Crowd', value: 'Calm' },
  seat: { type: 'Crowd', value: 'Calm' },
  queue: { type: 'Queue', value: null },
  open: { type: 'TemporaryStatus', value: 'Open' },
  closed: { type: 'TemporaryStatus', value: 'Closed' },
  offer: { type: 'Offer', value: 'Available' },
  event: { type: 'Event', value: 'Started' },
};
export const stickerSignal = (stickerId: string): StickerSignal | null => STICKER_SIGNALS[stickerId] ?? null;
/** The first type sticker placed decides; decoration-only stickers are ignored. */
export const signalFromStickers = (placed: Array<{ stickerId: string }>): StickerSignal | null => {
  for (const sticker of placed) {
    const hint = stickerSignal(sticker.stickerId);
    if (hint) return hint;
  }
  return null;
};

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
/** Accessible name for a sticker, also for emoji stickers that have no text. */
export const stickerName = (sticker: StickerDef, now: Date) => stickerText(sticker, now) || sticker.glyph;

/** "00:07" while recording. */
export const formatRecording = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
};

export type FlashMode = 'off' | 'on' | 'auto';
const FLASH_ORDER: FlashMode[] = ['off', 'on', 'auto'];
export const nextFlash = (mode: FlashMode): FlashMode => FLASH_ORDER[(FLASH_ORDER.indexOf(mode) + 1) % FLASH_ORDER.length];
export const flashLabel = (mode: FlashMode) => (mode === 'on' ? tx('create:camera.flashOn', 'Flaş açık') : mode === 'auto' ? tx('create:camera.flashAuto', 'Flaş otomatik') : tx('create:camera.flashOff', 'Flaş kapalı'));

/** expo-camera zoom is a 0..1 fraction of the device maximum; people pinch to change it. */
export const clampZoom = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/** A friendly "1.0x".."5.0x" readout for the zoom pill. Cosmetic only - the real optical range differs per device. */
const ZOOM_LABEL_SPAN = 4;
export const zoomMultiplierLabel = (zoom: number) => `${(1 + clampZoom(zoom) * ZOOM_LABEL_SPAN).toFixed(1)}x`;

/** Keeps a sticker centre inside the picture so it can always be grabbed again. */
export const clampToFrame = (value: number, size: number, margin = 24) => Math.min(size - margin, Math.max(margin, value));

export type PlacedSticker = {
  key: string;
  stickerId: string;
  x: number;
  y: number;
  scale: number;
  rotation?: number;
  /** Text tool (stickerId `text`): what was written, how it looks. */
  text?: string;
  textStyle?: TextStyleId;
  textColor?: string;
};

/** Text tool (sinyal-mvp-plan 05 §1.2 "Metin (T): 3 stil (düz, zeminli, vurgulu), renk seçimi, sürüklenebilir"). */
export type TextStyleId = 'plain' | 'solid' | 'highlight';
export const TEXT_STYLES: TextStyleId[] = ['plain', 'solid', 'highlight'];
export const TEXT_STYLE_LABELS: Record<TextStyleId, string> = { plain: tx('create:text.plain', 'Düz'), solid: tx('create:text.solid', 'Zeminli'), highlight: tx('create:text.highlight', 'Vurgulu') };
export const nextTextStyle = (style: TextStyleId): TextStyleId => TEXT_STYLES[(TEXT_STYLES.indexOf(style) + 1) % TEXT_STYLES.length];
/** Text colours are picture content (like lens swatches), not UI chrome. */
export const TEXT_COLORS = ['#FFFFFF', '#111111', '#FFC845', '#5FD3A0', '#FF6B6B', '#6FB7FF', '#C58CFF'];
export const TEXT_MAX = 80;
/** Writing on the picture: trimmed, one line of meaning, capped; empty writes nothing. */
export const cleanOverlayText = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX);
/** Readable text on a solid/highlight background: dark text on light colours, white on dark ones. */
export const textOnColor = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return '#FFFFFF';
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.6 ? '#111111' : '#FFFFFF';
};

/** Adds a text item the same way as a sticker (same limit, same free-spot placement). */
export const placeText = (existing: PlacedSticker[], text: string, style: TextStyleId, color: string, frame: { width: number; height: number }, now = Date.now()): PlacedSticker[] => {
  const clean = cleanOverlayText(text);
  if (!clean) return existing;
  const next = placeSticker(existing, 'text', frame, now);
  if (next === existing) return existing;
  const added = next[next.length - 1];
  return [...existing, { ...added, text: clean, textStyle: style, textColor: color }];
};

/** A sticker pill is roughly this big; two anchors closer than this on both axes overlap visually. */
export const STICKER_BOX = { width: 140, height: 56 };
export const stickersOverlap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < STICKER_BOX.width && Math.abs(a.y - b.y) < STICKER_BOX.height;

/**
 * A new sticker goes to the first free spot, scanning from the middle outwards, so it never lands on top of one
 * already there (sinyal-mvp-plan AUDIT #8). If the picture is full it falls back to the least crowded spot.
 */
/** plan-devam D5: a real sticker never sits perfectly straight - 2 to 4 degrees, alternating sides (radians). */
export const stickerTilt = (index: number, seed = Date.now()) => ((2 + (Math.abs(Math.floor(seed)) % 3)) * (index % 2 === 0 ? 1 : -1) * Math.PI) / 180;

export const placeSticker = (existing: PlacedSticker[], stickerId: string, frame: { width: number; height: number }, now = Date.now()): PlacedSticker[] => {
  if (existing.length >= MAX_STICKERS) return existing;
  // Two columns a sticker-width apart, rows a sticker-height apart, middle rows first.
  const left = Math.max(8, frame.width / 2 - 110);
  const cols = [left, left + STICKER_BOX.width];
  const rowStep = STICKER_BOX.height + 4;
  const middle = frame.height * 0.42;
  const rows = [0, -1, 1, -2, 2, -3, 3].map((k) => middle + k * rowStep).filter((y) => y >= 8 && y <= frame.height - 40);
  const candidates = rows.flatMap((y) => cols.map((x) => ({ x: clampToFrame(x, frame.width, 8), y })));
  const nearest = (point: { x: number; y: number }) => existing.reduce((min, s) => Math.min(min, Math.hypot(s.x - point.x, s.y - point.y)), Number.POSITIVE_INFINITY);
  const free = candidates.find((point) => existing.every((s) => !stickersOverlap(s, point)));
  const spot = free ?? candidates.reduce((best, point) => (nearest(point) > nearest(best) ? point : best), candidates[0]);
  return [...existing, { key: `${stickerId}-${now}-${existing.length}`, stickerId, x: spot.x, y: spot.y, scale: 1, rotation: stickerTilt(existing.length, now) }];
};

/** Dropping a sticker on the bin at the bottom centre of the picture deletes it. */
export const TRASH_ZONE = { size: 64, bottomMargin: 16 };
export const isOverTrash = (point: { x: number; y: number }, frame: { width: number; height: number }) =>
  point.y >= frame.height - TRASH_ZONE.bottomMargin - TRASH_ZONE.size && Math.abs(point.x - frame.width / 2) <= TRASH_ZONE.size;
