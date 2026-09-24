import { meaningfulTitle, signalLabels } from './presentation';
import type { BlinkrPlace, CoordinateSignal, RecentSignal, SignalType } from './types';

/**
 * The Sinyal Kartı's data and rules (plan-devam Faz C). Pure, so the card component stays thin and these rules are
 * unit-tested: what a card shows, how media is framed without cropping, how long a signal has left, and when
 * "Hâlâ böyle mi?" may be answered.
 */
export type CardMedia = { url: string; thumbnailUrl?: string | null; type: 'Image' | 'Video'; width?: number | null; height?: number | null };

export type CardSignal = {
  postId: string;
  /** Null for anonymous signals: the author is never revealed. */
  authorId: string | null;
  authorName: string | null;
  anonymous: boolean;
  isMine: boolean;
  createdAtUtc: string | null;
  expiresAtUtc: string | null;
  signalType: SignalType;
  signalValue: string | null;
  /** One text: a meaningful title and the description merged, never the type label again (plan-devam D7). */
  text: string;
  media: CardMedia[];
  /** Server trust VERIFIED_LIVE: the "Konumda" badge. */
  verified: boolean;
  /** An old gallery photo (plan-devam D10): the card says "Galeriden" instead of implying it is live. */
  fromGallery?: boolean;
  placeId: string | null;
  placeName: string | null;
  placeCategory: string | null;
  latitude: number | null;
  longitude: number | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  /** Only the author gets it. */
  viewCount: number | null;
  /** V2-4 (D-027): reactions by emoji and mine (liked/likeCount stay their sum), and the people the text mentions. */
  reactionCounts?: Record<string, number>;
  myReaction?: string | null;
  mentions?: Array<{ userId: string; userName: string }>;
  /** False until GET /api/posts/{id} answered (author, counts): the card shows what it has meanwhile. */
  complete: boolean;
};

/** Title and description as one text: drop a title that only repeats the type or is already inside the description. */
export const cardText = (title: string | null | undefined, content: string | null | undefined, signalType: SignalType) => {
  const heading = meaningfulTitle(title ?? '', signalLabels[signalType]);
  const body = (content ?? '').trim();
  if (!heading) return body;
  if (!body) return heading;
  const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[.!?…\s]+$/u, '');
  if (fold(body).includes(fold(heading))) return body;
  return `${heading}. ${body}`;
};

const mediaType = (value: unknown): 'Image' | 'Video' => (value === 1 || value === 'Video' || value === 'video' ? 'Video' : 'Image');

/** A place's recent signal as a card, shown at once while the full detail loads. */
export const fromRecentSignal = (signal: RecentSignal, place: BlinkrPlace): CardSignal => {
  const type = (signal.signalType ?? 'GeneralObservation') as SignalType;
  return {
    postId: signal.postId,
    authorId: null,
    authorName: signal.authorName ?? null,
    anonymous: !signal.authorName,
    isMine: false,
    createdAtUtc: signal.createdAtUtc ?? null,
    expiresAtUtc: signal.expiresAtUtc ?? null,
    signalType: type,
    signalValue: signal.signalValue ?? null,
    text: cardText(signal.title, signal.text, type),
    media: (signal.media ?? []).filter((m) => m.url).map((m) => ({ url: m.url!, thumbnailUrl: m.thumbnailUrl ?? null, type: mediaType(m.mediaType), width: m.width ?? null, height: m.height ?? null })),
    verified: signal.publicationTrust === 'VERIFIED_LIVE',
    placeId: place.id,
    placeName: place.name,
    placeCategory: place.category ?? null,
    latitude: place.latitude,
    longitude: place.longitude,
    likeCount: 0,
    commentCount: 0,
    liked: false,
    viewCount: null,
    complete: false,
  };
};

/** A signal shared in chat (plan-devam E6): only a link and a snapshot, the card fills itself from the server. */
export const fromShare = (share: { postId: string; signalType: string; signalValue?: string | null; title?: string | null; locationName?: string | null }): CardSignal => {
  const type = share.signalType as SignalType;
  return {
    postId: share.postId, authorId: null, authorName: null, anonymous: false, isMine: false, createdAtUtc: null, expiresAtUtc: null,
    signalType: type, signalValue: share.signalValue ?? null, text: cardText(share.title, '', type), media: [], verified: false,
    placeId: null, placeName: share.locationName ?? null, placeCategory: null, latitude: null, longitude: null,
    likeCount: 0, commentCount: 0, liked: false, viewCount: null, complete: false,
  };
};

/** A coordinate signal from the map, shown at once while the full detail loads. */
export const fromCoordinateSignal = (signal: CoordinateSignal): CardSignal => ({
  postId: signal.postId,
  authorId: null,
  authorName: signal.authorPreview ?? null,
  anonymous: !signal.authorPreview,
  isMine: false,
  createdAtUtc: signal.createdAtUtc ?? null,
  expiresAtUtc: signal.expiresAt ?? null,
  signalType: signal.signalType,
  signalValue: signal.signalValue ?? null,
  text: cardText(signal.title, signal.content ?? signal.textPreview, signal.signalType),
  media: signal.mediaThumbnailUrl ? [{ url: signal.mediaThumbnailUrl, thumbnailUrl: signal.mediaThumbnailUrl, type: 'Image' }] : [],
  verified: false,
  placeId: null,
  placeName: signal.locationName ?? null,
  placeCategory: null,
  latitude: signal.latitude,
  longitude: signal.longitude,
  likeCount: 0,
  commentCount: 0,
  liked: false,
  viewCount: null,
  complete: false,
});

/** The GET /api/posts/{id} response, as far as the card needs it. */
export type PostDetailDto = {
  id: string; title?: string | null; content?: string | null; authorId?: string | null; authorName?: string | null;
  createdAt?: string | null; expiresAt?: string | null; signalType?: string | null; signalValue?: string | null;
  identityDisclosure?: string | null; publicationTrust?: string | null; fromGallery?: boolean; isMine?: boolean; viewCount?: number | null;
  likeCount?: number; commentCount?: number; isLikedByCurrentUser?: boolean; placeId?: string | null; locationName?: string | null;
  latitude?: number | null; longitude?: number | null;
  reactionCounts?: Record<string, number> | null; myReaction?: string | null; mentions?: Array<{ userId: string; userName: string }> | null;
  media?: Array<{ url?: string | null; thumbnailUrl?: string | null; type?: string | number | null; width?: number | null; height?: number | null }>;
};

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

/** Completes a card with the full detail; place fields already known are kept. */
export const withDetail = (card: CardSignal, dto: PostDetailDto): CardSignal => {
  const type = (dto.signalType ?? card.signalType) as SignalType;
  const anonymous = dto.identityDisclosure === 'AnonymousMap' || !dto.authorId || dto.authorId === EMPTY_GUID;
  const media = (dto.media ?? []).filter((m) => m.url).map((m) => ({ url: m.url!, thumbnailUrl: m.thumbnailUrl ?? null, type: mediaType(m.type), width: m.width ?? null, height: m.height ?? null }));
  return {
    ...card,
    authorId: anonymous ? null : dto.authorId ?? null,
    authorName: anonymous ? null : dto.authorName ?? card.authorName,
    anonymous,
    isMine: Boolean(dto.isMine),
    createdAtUtc: dto.createdAt ?? card.createdAtUtc,
    expiresAtUtc: dto.expiresAt ?? card.expiresAtUtc,
    signalType: type,
    signalValue: dto.signalValue ?? card.signalValue,
    text: cardText(dto.title, dto.content, type) || card.text,
    media: media.length ? media : card.media,
    verified: dto.publicationTrust ? dto.publicationTrust === 'VERIFIED_LIVE' : card.verified,
    fromGallery: Boolean(dto.fromGallery),
    placeId: dto.placeId ?? card.placeId,
    placeName: card.placeName ?? dto.locationName ?? null,
    latitude: card.latitude ?? dto.latitude ?? null,
    longitude: card.longitude ?? dto.longitude ?? null,
    likeCount: dto.likeCount ?? card.likeCount,
    commentCount: dto.commentCount ?? card.commentCount,
    liked: dto.isLikedByCurrentUser ?? card.liked,
    viewCount: dto.viewCount ?? null,
    reactionCounts: dto.reactionCounts ?? card.reactionCounts,
    myReaction: dto.myReaction !== undefined ? dto.myReaction : card.myReaction,
    mentions: dto.mentions ?? card.mentions,
    complete: true,
  };
};

/** 4:5 is the widest and 9:16 the tallest frame (width / height). */
export const WIDEST = 4 / 5;
export const TALLEST = 9 / 16;

/**
 * How a photo sits in the card without ever cropping it (plan-devam C4): a picture between 9:16 and 4:5 is shown at
 * its own ratio; a wider one sits whole ("contain") in a 4:5 frame with a blurred copy behind it; a taller one is
 * held to 9:16 the same way. Unknown size: a 4:5 frame, contained.
 */
export const mediaFrame = (width?: number | null, height?: number | null): { aspectRatio: number; fit: 'cover' | 'contain' } => {
  if (!width || !height || width <= 0 || height <= 0) return { aspectRatio: WIDEST, fit: 'contain' };
  const ratio = width / height;
  if (ratio > WIDEST) return { aspectRatio: WIDEST, fit: 'contain' };
  if (ratio < TALLEST) return { aspectRatio: TALLEST, fit: 'contain' };
  return { aspectRatio: ratio, fit: 'cover' };
};

/** "1 sa 28 dk kaldı" parts, or null when expired/unknown. */
export const timeLeft = (expiresAtUtc: string | null | undefined, now = Date.now()): { hours: number; minutes: number } | null => {
  const expires = expiresAtUtc ? Date.parse(expiresAtUtc) : Number.NaN;
  if (!Number.isFinite(expires) || expires <= now) return null;
  const minutes = Math.max(1, Math.ceil((expires - now) / 60_000));
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
};

/** How close a person must be to answer "Hâlâ böyle mi?" (plan 04 §2.2). */
export const VERIFY_RADIUS_METERS = 500;

export type VerifyState = { enabled: boolean; reason: 'mine' | 'far' | 'noLocation' | 'notPlace' | null };

/**
 * Whether "Evet / Değişti" can be used here. The buttons are still drawn when they cannot, with the reason under them;
 * the server decides for itself whether the new signal counts as live - this only avoids asking people who cannot know.
 */
export const verifyState = (card: Pick<CardSignal, 'isMine' | 'placeId'>, distanceMeters: number | null | undefined): VerifyState => {
  if (!card.placeId) return { enabled: false, reason: 'notPlace' };
  if (card.isMine) return { enabled: false, reason: 'mine' };
  if (distanceMeters === null || distanceMeters === undefined || !Number.isFinite(distanceMeters)) return { enabled: false, reason: 'noLocation' };
  if (distanceMeters > VERIFY_RADIUS_METERS) return { enabled: false, reason: 'far' };
  return { enabled: true, reason: null };
};

/** The pager index after a step, kept in range. */
export const stepIndex = (index: number, step: number, count: number) => Math.min(Math.max(0, index + step), Math.max(0, count - 1));

/** Map zoom from a region's longitude span (web mercator), for "zoom < 16 → zoom in, else open the card" (C9). */
export const zoomOf = (longitudeDelta: number) => Math.log2(360 / Math.max(1e-9, longitudeDelta));
export const CARD_ZOOM = 16;
