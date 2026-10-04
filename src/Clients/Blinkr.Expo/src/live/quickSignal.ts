import type { CreateSignalInput, IdentityDisclosure, SignalType } from '../types';

/**
 * Two-tap signal (v4 brief §3.4): tile -> value -> Share. A pure state machine; `QuickSignalSheet` only draws it.
 * Tiles are what people see; each maps to a type the server accepts (`CreatePostDtoValidator`). The server needs a
 * value for every type but GeneralObservation, so value-less tiles send a fixed one.
 */
export type QuickTile = 'Open' | 'Crowd' | 'Queue' | 'Event' | 'Offer' | 'Temp' | 'NewOpening' | 'Observation';

export const QUICK_TILES: readonly QuickTile[] = ['Open', 'Crowd', 'Queue', 'Event', 'Offer', 'Temp', 'NewOpening', 'Observation'];

export const TILE_TYPE: Record<QuickTile, SignalType> = {
  Open: 'TemporaryStatus', Crowd: 'Crowd', Queue: 'Queue', Event: 'Event', Offer: 'Offer',
  Temp: 'TemporaryStatus', NewOpening: 'NewOpening', Observation: 'GeneralObservation',
};

/** Values a person picks. Empty = the tile needs a note instead. Names are the backend's (Busy = crowded). */
export const TILE_VALUES: Record<QuickTile, readonly string[]> = {
  Open: ['Open', 'Closed'],
  Crowd: ['Calm', 'Moderate', 'Busy'],
  Queue: ['None', '5To15', 'Over15'],
  Event: [], Offer: [], Temp: [], NewOpening: [], Observation: [],
};

/** The value sent for tiles without a choice. "Notice" marks a temporary status that is neither open nor closed. */
export const TILE_AUTO_VALUE: Partial<Record<QuickTile, string>> = {
  Event: 'Started', Offer: 'Available', Temp: 'Notice', NewOpening: 'Opened',
};

export const NOTE_REQUIRED: ReadonlySet<QuickTile> = new Set<QuickTile>(['Event', 'Offer', 'Temp', 'NewOpening']);
/** The server rejects non-empty content shorter than 5 characters. */
export const NOTE_MIN = 5;
export const NOTE_MAX = 280;
export const MEDIA_MAX = 4;

export type QuickDisclosure = Extract<IdentityDisclosure, 'LimitedProfile' | 'AnonymousMap'>;

export type QuickState = {
  tile: QuickTile | null;
  value: string | null;
  note: string;
  mediaCount: number;
  disclosure: QuickDisclosure;
  step: 'kind' | 'value' | 'note' | 'ready';
};

export type QuickAction =
  | { t: 'pickTile'; tile: QuickTile }
  | { t: 'pickValue'; value: string }
  | { t: 'setNote'; note: string }
  | { t: 'setMediaCount'; count: number }
  | { t: 'setDisclosure'; d: QuickDisclosure }
  | { t: 'reset' };

export const initialQuick: QuickState = { tile: null, value: null, note: '', mediaCount: 0, disclosure: 'LimitedProfile', step: 'kind' };

const noteOk = (note: string) => note.trim().length >= NOTE_MIN;

function stepOf(s: Omit<QuickState, 'step'>): QuickState['step'] {
  if (!s.tile) return 'kind';
  if (TILE_VALUES[s.tile].length > 0 && !s.value) return 'value';
  if (NOTE_REQUIRED.has(s.tile) && !noteOk(s.note)) return 'note';
  if (s.tile === 'Observation' && !noteOk(s.note) && s.mediaCount === 0) return 'note';
  // An optional note still has to satisfy the server's minimum when present.
  if (s.note.trim().length > 0 && !noteOk(s.note)) return 'note';
  return 'ready';
}

export function quickReducer(s: QuickState, a: QuickAction): QuickState {
  let next: Omit<QuickState, 'step'>;
  switch (a.t) {
    case 'pickTile':
      next = { ...s, tile: a.tile, value: s.tile === a.tile ? s.value : null };
      break;
    case 'pickValue':
      if (!s.tile || !TILE_VALUES[s.tile].includes(a.value)) return s;
      next = { ...s, value: a.value };
      break;
    case 'setNote':
      next = { ...s, note: a.note.slice(0, NOTE_MAX) };
      break;
    case 'setMediaCount':
      next = { ...s, mediaCount: Math.max(0, Math.min(MEDIA_MAX, Math.floor(a.count))) };
      break;
    case 'setDisclosure':
      next = { ...s, disclosure: a.d };
      break;
    case 'reset':
      return initialQuick;
  }
  return { ...next, step: stepOf(next) };
}

export const canSubmit = (s: QuickState) => s.step === 'ready';

/** Start the sheet on a tile and value ("Hâlâ böyle?" / "Değişti" from a place or signal). */
export function quickStateFor(type: SignalType | null | undefined, value: string | null | undefined): QuickState {
  const tile = tileFor(type, value);
  if (!tile) return initialQuick;
  const picked = quickReducer(initialQuick, { t: 'pickTile', tile });
  const match = TILE_VALUES[tile].find((v) => v.toLowerCase() === (value ?? '').toLowerCase());
  return match ? quickReducer(picked, { t: 'pickValue', value: match }) : picked;
}

export function tileFor(type: SignalType | null | undefined, value: string | null | undefined): QuickTile | null {
  if (!type) return null;
  if (type === 'TemporaryStatus') return /^(open|closed)$/i.test(value ?? '') ? 'Open' : 'Temp';
  if (type === 'GeneralObservation') return 'Observation';
  return (Object.keys(TILE_TYPE) as QuickTile[]).find((tile) => TILE_TYPE[tile] === type) ?? null;
}

export type PlaceRef = { placeId: string; name: string; latitude: number; longitude: number };
export type DeviceFix = { latitude: number; longitude: number; accuracyMeters: number };

/**
 * The POST /api/posts body (media is attached by the share outbox after upload). The post's own coordinates are the
 * place's; the exact device position goes only as observation evidence, so it is never what gets published.
 */
export function buildPostBody(s: QuickState, place: PlaceRef, fix: DeviceFix): Omit<CreateSignalInput, 'media'> {
  if (!canSubmit(s) || !s.tile) throw new Error('QUICK_SIGNAL_NOT_READY');
  const type = TILE_TYPE[s.tile];
  // The server rejects an accuracy of 0.
  const accuracy = Math.max(1, Math.round(fix.accuracyMeters));
  return {
    title: '',
    content: s.note.trim(),
    latitude: place.latitude,
    longitude: place.longitude,
    accuracyMeters: accuracy,
    observationLatitude: fix.latitude,
    observationLongitude: fix.longitude,
    observationAccuracyMeters: accuracy,
    placeId: place.placeId,
    locationName: place.name,
    signalType: type,
    signalValue: type === 'GeneralObservation' ? null : (s.value ?? TILE_AUTO_VALUE[s.tile] ?? null),
    audienceType: 'Public',
    identityDisclosure: s.disclosure,
    locationPrecision: 'PlaceCenter',
  };
}
