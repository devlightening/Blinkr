import type { ChatMessage, Conversation } from './types';
import { tx } from './i18n/tx';

/**
 * How snaps (view-once photos and videos) are described in the chat list and inside a conversation. The words and
 * colour roles follow the Snapchat chat page people already know: a filled square means something new and waiting,
 * an outlined one means it is done; red is a snap, blue is a chat. Pure functions, so every state is testable.
 */
export type StatusTone = 'snap' | 'chat' | 'quiet';
export type StatusIcon = 'square' | 'arrow' | 'none';

export type ConversationStatus = {
  /** Machine-readable state, also used by tests and accessibility labels. */
  kind: 'new-snap' | 'new-chat' | 'snap-received-opened' | 'snap-expired' | 'snap-sent' | 'snap-opened' | 'chat-sent' | 'chat' | 'empty';
  label: string;
  tone: StatusTone;
  icon: StatusIcon;
  /** Filled square/arrow = new or waiting; outlined = handled. */
  filled: boolean;
  /** Tapping the row opens the snap viewer instead of the conversation. */
  opensSnap: boolean;
};

const STATUS = (kind: ConversationStatus['kind'], label: string, tone: StatusTone, icon: StatusIcon, filled: boolean, opensSnap = false): ConversationStatus =>
  ({ kind, label, tone, icon, filled, opensSnap });

/** The status line of one row in the chat list. `preview` is shown for read text, like a normal messenger. */
export const conversationStatus = (conversation: Conversation, myId: string): ConversationStatus => {
  const mine = conversation.lastMessageSenderId === myId;
  const unread = conversation.unreadCount ?? 0;

  if (conversation.lastMessageKind === 'snap') {
    const state = conversation.lastMessageState ?? 'sent';
    if (state === 'expired') return STATUS('snap-expired', tx('chat:snap.expired', 'Süresi doldu'), 'quiet', mine ? 'arrow' : 'square', false);
    if (mine) return state === 'opened' ? STATUS('snap-opened', tx('chat:snap.opened', 'Açıldı'), 'quiet', 'arrow', false) : STATUS('snap-sent', tx('chat:snap.sent', 'Gönderildi'), 'snap', 'arrow', false);
    return state === 'opened'
      ? STATUS('snap-received-opened', tx('chat:snap.opened', 'Açıldı'), 'quiet', 'square', false)
      : STATUS('new-snap', tx('chat:snap.new', 'Yeni Snap'), 'snap', 'square', true, true);
  }

  if (!conversation.lastMessagePreview) return STATUS('empty', tx('chat:snap.newConversation', 'Yeni konuşma'), 'quiet', 'none', false);
  if (!mine && unread > 0) return STATUS('new-chat', tx('chat:snap.newChat', 'Yeni sohbet'), 'chat', 'square', true);
  return STATUS(mine ? 'chat-sent' : 'chat', conversation.lastMessagePreview ?? '', 'quiet', 'none', false);
};

export type SnapRow = {
  title: string;
  /** What the person can do or has done with it. */
  status: string;
  tone: StatusTone;
  icon: StatusIcon;
  filled: boolean;
  /** Only the recipient of a snap that is still waiting can tap it. */
  tappable: boolean;
};

/** A snap inside a conversation. Returns null for text messages. */
export const snapRow = (message: ChatMessage, myId: string): SnapRow | null => {
  if (message.kind !== 'snap' || !message.snap) return null;
  const mine = message.senderId === myId;
  const title = message.snap.mediaType === 'Video' ? tx('chat:snap.video', 'Video') : tx('chat:snap.snap', 'Snap');
  const { state } = message.snap;
  if (state === 'expired') return { title, status: tx('chat:snap.expired', 'Süresi doldu'), tone: 'quiet', icon: mine ? 'arrow' : 'square', filled: false, tappable: false };
  if (mine) return { title, status: state === 'opened' ? tx('chat:snap.opened', 'Açıldı') : tx('chat:snap.sent', 'Gönderildi'), tone: state === 'opened' ? 'quiet' : 'snap', icon: 'arrow', filled: false, tappable: false };
  return state === 'opened'
    ? { title, status: tx('chat:snap.opened', 'Açıldı'), tone: 'quiet', icon: 'square', filled: false, tappable: false }
    : { title, status: tx('chat:snap.tapToView', 'Görmek için dokun'), tone: 'snap', icon: 'square', filled: true, tappable: true };
};

/** Timer choices offered to the sender of a photo; 0 (until closed) is not offered for photos. */
export const TIMER_OPTIONS = [3, 5, 10] as const;
export const DEFAULT_TIMER = 5;
export const nextTimer = (current: number) => TIMER_OPTIONS[(TIMER_OPTIONS.indexOf(current as typeof TIMER_OPTIONS[number]) + 1) % TIMER_OPTIONS.length];
export const timerLabel = (seconds: number) => (seconds > 0 ? `${seconds} sn` : 'Sonuna kadar');

/** Share of the timer that is left, for the progress bar (1 = full, 0 = over). */
export const timerFraction = (remainingMs: number, durationSeconds: number) => {
  if (!(durationSeconds > 0)) return 1;
  return Math.min(1, Math.max(0, remainingMs / (durationSeconds * 1000)));
};

export const MAX_CAPTION_LENGTH = 80;
export const cleanCaption = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, MAX_CAPTION_LENGTH);

export type Recipient = { conversationId: string; userId: string };

/** Toggle a recipient in a multi-select list; the order of selection is kept. */
export const toggleRecipient = (selected: string[], conversationId: string, limit = 10): string[] =>
  selected.includes(conversationId)
    ? selected.filter((id) => id !== conversationId)
    : selected.length >= limit ? selected : [...selected, conversationId];

export const sendButtonLabel = (count: number, firstName?: string) =>
  count <= 0 ? tx('chat:snap.pickPeople', 'Kişi seç') : count === 1 && firstName ? tx('chat:snap.sendTo', 'Gönder · {{name}}', { name: firstName }) : tx('chat:snap.sendToMany', 'Gönder · {{count}} kişi', { count });

/** Result of sending one snap to several people: which conversations still need a retry. */
export const summarizeSend = (results: Array<{ conversationId: string; ok: boolean }>) => {
  const failed = results.filter((item) => !item.ok).map((item) => item.conversationId);
  return { sent: results.length - failed.length, failed, allSent: failed.length === 0 && results.length > 0 };
};

/** Spoken/accessible description of a chat list row. */
export const conversationLabel = (name: string, status: ConversationStatus, when: string) =>
  `${name}, ${status.label}${when ? `, ${when}` : ''}${status.opensSnap ? tx('chat:snap.openSnap', '. Snapı aç') : tx('chat:snap.openChat', '. Sohbeti aç')}`;

/**
 * "Also send to friends as a snap" from the signal composer (sinyal-mvp-plan P5.9). Only a photo can go as a snap,
 * and never from an anonymous signal: friends receiving the same picture would learn who posted it.
 */
export const shareToFriendsAvailability = (params: { anonymous: boolean; hasPhoto: boolean }): 'ok' | 'anonymous' | 'no-photo' => {
  if (params.anonymous) return 'anonymous';
  if (!params.hasPhoto) return 'no-photo';
  return 'ok';
};
/** Composer snaps use the middle viewing time. */
export const COMPOSER_SNAP_SECONDS = 5;
export const MAX_COMPOSER_SNAP_FRIENDS = 10;
export const toggleSnapFriend = (selected: string[], id: string) =>
  selected.includes(id) ? selected.filter((item) => item !== id) : selected.length >= MAX_COMPOSER_SNAP_FRIENDS ? selected : [...selected, id];
