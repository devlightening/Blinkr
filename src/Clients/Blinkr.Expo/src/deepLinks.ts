import { parseDeepLink } from './notifications';

/**
 * Links into Blinkr (V2-2). One format for notifications and shared signals: blinkr://posts/{id} and
 * blinkr://users/{id} (the parser lives in notifications.ts). A post link opens that signal on the map.
 */
export const postLink = (postId: string) => `blinkr://posts/${postId}`;

/** A person's link (doc P2, "Profili paylaş"): what the profile QR code carries. Only the id; no name or anything else. */
export const userLink = (userId: string) => `blinkr://users/${userId}`;

export type AppLink = { kind: 'post'; postId: string } | { kind: 'user'; userId: string } | { kind: 'collection'; token: string };

/** A post, a person or a shared collection (D-041) from a Blinkr link (opened from outside or scanned), or null. */
export function parseAppLink(url: string | null | undefined): AppLink | null {
  const clean = url?.trim().replace(/\/?(?:[?#].*)?$/, '') ?? null;
  const collection = /^blinkr:\/\/collections\/([A-Za-z0-9_-]{22})$/.exec(clean ?? '');
  if (collection) return { kind: 'collection', token: collection[1] };
  const target = parseDeepLink(clean);
  if (!target) return null;
  return target.kind === 'post' ? { kind: 'post', postId: target.postId } : { kind: 'user', userId: target.userId };
}

/** The post id from a Blinkr link, or null for anything else. */
export function parsePostLink(url: string | null | undefined): string | null {
  const target = parseDeepLink(url?.trim().replace(/\/?(?:[?#].*)?$/, '') ?? null);
  return target?.kind === 'post' ? target.postId : null;
}

/**
 * The text another app receives when a signal is shared (V2-7): what and where, then the link. Never the poster's
 * name (an anonymous signal stays anonymous wherever it goes).
 */
export const shareMessage = (share: { postId: string; title?: string | null; locationName?: string | null }) => {
  const what = (share.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const where = (share.locationName ?? '').trim();
  const head = [what, where ? `📍 ${where}` : ''].filter(Boolean).join(' · ');
  return head ? `${head}\n${postLink(share.postId)}` : postLink(share.postId);
};
