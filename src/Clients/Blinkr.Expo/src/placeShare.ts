import { formatAge, formatCategory } from './presentation';
import { savedLiveStatus } from './savedLive';
import type { BlinkrPlace, ChatMessage, PlaceShare } from './types';
import { tx } from './i18n/tx';

/** The place service answers at most 20 ids per batch. */
export const PLACE_BATCH_LIMIT = 20;

/** What gets sent: the id and the name/category the sender sees. No coordinates, nothing about the sender's position. */
export const placeShareFrom = (place: { id: string; name: string; category?: string | null }): PlaceShare => ({
  placeId: place.id,
  name: place.name.trim().slice(0, 120),
  category: place.category ?? null,
});

/** Place ids shared in a thread, newest first, without repeats, at most one batch. */
export const sharedPlaceIds = (messages: Pick<ChatMessage, 'kind' | 'place'>[]): string[] => {
  const ids: string[] = [];
  for (const message of messages) {
    const id = message.kind === 'place' ? message.place?.placeId : undefined;
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length >= PLACE_BATCH_LIMIT) break;
  }
  return ids;
};

export type PlaceCard = {
  /** The live name from the place service when known; the sender's snapshot otherwise. */
  name: string;
  category: string;
  /** "Doluluk · Kalabalık · 6 dk önce" only for verified, fresh activity (savedLive rules). */
  liveLine: string | null;
  /** True once the place service has answered for this place (so "no live info" is a fact, not a guess). */
  known: boolean;
};

/**
 * Doc B1: what a shared-place bubble says. The live line follows the same rule as saved places: verified and fresh
 * (FRESH/RECENT) or nothing - a stale state is never shown as current. The name from the place service wins over the
 * sender's snapshot, so a bubble can never present one place under another's name.
 */
export const placeCard = (share: PlaceShare, place: BlinkrPlace | null | undefined): PlaceCard => {
  const live = savedLiveStatus(place);
  return {
    name: place?.name || share.name,
    category: formatCategory(place?.category ?? share.category),
    liveLine: live ? (live.observedAtUtc ? `${live.headline} · ${formatAge(live.observedAtUtc)}` : live.headline) : null,
    known: Boolean(place),
  };
};

export const placeCardLabel = (card: PlaceCard) =>
  card.liveLine
    ? tx('chat:place.a11yLive', '{{name}}, {{category}}. Şu an: {{live}}. Haritada aç', { name: card.name, category: card.category, live: card.liveLine })
    : tx('chat:place.a11y', '{{name}}, {{category}}. Güncel bilgi yok. Haritada aç', { name: card.name, category: card.category });
