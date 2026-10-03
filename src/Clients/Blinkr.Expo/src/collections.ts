import { tx } from './i18n/tx';

/** D-041 "Koleksiyonlar". Same limits the server enforces. */
export const COLLECTION_LIMITS = { perUser: 20, items: 50, title: 60, description: 160, note: 140 } as const;

export type CollectionVisibility = 'private' | 'link';
export type CollectionItem = { placeId: string; name: string; category?: string | null; latitude: number; longitude: number; note?: string | null; addedAtUtc: string };
export type CollectionSummary = { id: string; title: string; description?: string | null; visibility: CollectionVisibility; shareToken?: string | null; itemCount: number; preview: CollectionItem[]; updatedAtUtc: string; placeIds: string[] };
export type CollectionOwner = { id: string; userName: string; displayName?: string | null; avatarKey?: string | null; photoVersion?: string | null };
export type CollectionDetail = { id: string; title: string; description?: string | null; visibility: CollectionVisibility; shareToken?: string | null; isMine: boolean; owner?: CollectionOwner | null; items: CollectionItem[]; updatedAtUtc: string };

/** The link a shared collection travels as. Only the unguessable token; the server checks visibility and blocks. */
export const collectionLink = (token: string) => `blinkr://collections/${token}`;

/** The text another app receives. */
export const collectionShareText = (title: string, token: string) =>
  tx('profile:collections.shareText', '"{{title}}" yer listem Blinkr\'da: {{link}}', { title, link: collectionLink(token) });

export const itemCountLabel = (count: number) => tx('profile:collections.count', '{{n}} yer', { n: count });

export const visibilityLabel = (visibility: CollectionVisibility) =>
  visibility === 'link' ? tx('profile:collections.link', 'Bağlantıyla paylaşıldı') : tx('profile:collections.private', 'Yalnız sen');

/** Title rules the server applies, checked before sending so the button can say why it is off. */
export const validTitle = (title: string) => {
  const text = title.trim().replace(/\s+/g, ' ');
  return text.length > 0 && text.length <= COLLECTION_LIMITS.title;
};

/** Which of my collections already hold this place (for the "add to collection" checkmarks). */
export const containing = (lists: CollectionSummary[], placeId: string) =>
  new Set(lists.filter((list) => (list.placeIds ?? []).includes(placeId)).map((list) => list.id));
