import type { SignalShare } from './chatExtras';
import { postLink, shareMessage } from './deepLinks';
import { formatCategory } from './presentation';
import type { PlaceShare } from './types';

/**
 * What the share menu can send (V2-7, doc B1): a signal, or a catalog place. Each kind knows its own link, the text
 * another app receives, and what goes into a chat message; the menu itself does not branch on the kind.
 */
export type ShareTarget =
  | { kind: 'signal'; share: SignalShare }
  | { kind: 'place'; place: PlaceShare & { latitude: number; longitude: number } };

export const signalTarget = (share: SignalShare): ShareTarget => ({ kind: 'signal', share });

export const placeTarget = (place: { id: string; name: string; category?: string | null; latitude: number; longitude: number }): ShareTarget => ({
  kind: 'place',
  place: { placeId: place.id, name: place.name.trim().slice(0, 120), category: place.category ?? null, latitude: place.latitude, longitude: place.longitude },
});

/** The link "Bağlantıyı kopyala" copies: a Blinkr link for a signal, a map link for a public catalog place. */
export const shareLink = (target: ShareTarget) =>
  target.kind === 'signal'
    ? postLink(target.share.postId)
    : `https://maps.apple.com/?q=${encodeURIComponent(target.place.name)}&ll=${target.place.latitude},${target.place.longitude}`;

/** The text another app receives. Never a poster's name; a place is public catalog data, not anyone's position. */
export const shareText = (target: ShareTarget) =>
  target.kind === 'signal'
    ? shareMessage(target.share)
    : `${target.place.name} · ${formatCategory(target.place.category)}\n${shareLink(target)}`;

/** The chat message extras for a send: a signal share, or a place share without its coordinates (D-034). */
export const chatExtras = (target: ShareTarget): { signal?: SignalShare; place?: PlaceShare } =>
  target.kind === 'signal'
    ? { signal: target.share }
    : { place: { placeId: target.place.placeId, name: target.place.name, category: target.place.category ?? null } };
