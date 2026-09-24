/**
 * Keşfet feeds (sinyal-mvp-plan Faz 7). Pure logic, no React Native imports.
 * Server: `GET /api/discover/nearby?lat&lon&page` (ranked, coarse distances, anonymous without author) and
 * `GET /api/discover/following?page` (people I follow, last 7 days).
 */
import type { SignalType } from './types';

export type DiscoverMedia = { url: string; thumbnailUrl?: string | null; type: string };
export type DiscoverItem = {
  id: string;
  title: string;
  content: string;
  signalType: SignalType;
  signalValue?: string | null;
  authorId?: string | null;
  authorName: string;
  anonymous: boolean;
  createdAtUtc: string;
  expiresAtUtc?: string | null;
  expired: boolean;
  likeCount: number;
  commentCount: number;
  isLikedByCurrentUser: boolean;
  placeId?: string | null;
  locationName?: string | null;
  distanceMeters?: number | null;
  media: DiscoverMedia[];
  /** Light swearing: published, ranked lower by the server and labelled "Hassas içerik" (Faz 10 P10.1). */
  sensitive?: boolean;
  /** The server verified the author was at the place (VERIFIED_LIVE): only then may the card say "Canlı". */
  verified?: boolean;
  /** V2-4 (D-027): reactions by emoji, mine, and the people the text mentions. */
  reactionCounts?: Record<string, number>;
  myReaction?: string | null;
  mentions?: Array<{ userId: string; userName: string }>;
};
export type DiscoverPage = { items: DiscoverItem[]; page: number; pageSize: number; hasMore: boolean };
export type DiscoverTab = 'nearby' | 'following' | 'places';

export const DISCOVER_PAGE_SIZE = 20;
export const DISCOVER_RADIUS_METERS = 3000;
/** No endless scroll: the nearby feed stops after this many pages (the server stops at 20 too). */
export const MAX_DISCOVER_PAGES = 10;

/** Page 1 replaces the list (refresh); later pages append without repeating a signal already shown. */
export const mergeDiscoverPage = (current: DiscoverItem[], incoming: DiscoverPage): DiscoverItem[] => {
  if (incoming.page <= 1) return incoming.items;
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.items.filter((item) => !seen.has(item.id))];
};

export const canLoadMore = (page: DiscoverPage | null) => Boolean(page && page.hasMore && page.page < MAX_DISCOVER_PAGES);

/** Optimistic like inside a feed list. */
export const toggleFeedLike = (items: DiscoverItem[], id: string): DiscoverItem[] =>
  items.map((item) => (item.id === id
    ? { ...item, isLikedByCurrentUser: !item.isLikedByCurrentUser, likeCount: Math.max(0, item.likeCount + (item.isLikedByCurrentUser ? -1 : 1)) }
    : item));

/** "~150 m" / "1,2 km" from an already coarse server distance; nothing for the following feed. */
export const feedDistanceLabel = (meters: number | null | undefined, language: 'tr' | 'en' = 'tr') => {
  if (meters == null || !Number.isFinite(meters)) return '';
  if (meters < 1000) return `~${Math.round(meters)} m`;
  const km = (Math.round(meters / 100) / 10).toString();
  return `${language === 'tr' ? km.replace('.', ',') : km} km`;
};

/** A feed card may show the owner's like button only for other people's signals. */
export const canLikeFeedItem = (item: Pick<DiscoverItem, 'authorId' | 'anonymous'>, myUserId: string) =>
  item.anonymous ? true : item.authorId !== myUserId;
