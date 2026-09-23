/**
 * Chat extras (sinyal-mvp-plan Faz 8): shared signals, reactions, taking a message back, retry-safe sending.
 * Pure logic, no React Native imports. Server rules live in NotificationsService (BLK-CHAT-02).
 */
export const CHAT_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'] as const;
export type ChatReaction = { userId: string; emoji: string };
export type SignalShare = { postId: string; signalType: string; signalValue?: string | null; title?: string | null; locationName?: string | null };

type MessageLike = { senderId: string; kind?: string; reactions?: ChatReaction[] | null };

/** A client id for one send; reused when the same text is retried so the server never stores it twice. */
export const newClientId = (now = Date.now(), random = Math.random()) => `m-${now.toString(36)}-${Math.floor(random * 1e9).toString(36)}`;

/** Reactions grouped for display: emoji, how many, whether one of them is mine; in the fixed order. */
export const reactionSummary = (reactions: ChatReaction[] | null | undefined, me: string) =>
  CHAT_REACTIONS
    .map((emoji) => {
      const matching = (reactions ?? []).filter((r) => r.emoji === emoji);
      return { emoji, count: matching.length, mine: matching.some((r) => r.userId === me) };
    })
    .filter((entry) => entry.count > 0);

/** My reaction after pressing an emoji: the same emoji again clears it (server: null). */
export const nextReaction = (reactions: ChatReaction[] | null | undefined, me: string, pressed: string): string | null => {
  const mine = (reactions ?? []).find((r) => r.userId === me);
  return mine?.emoji === pressed ? null : pressed;
};

/** Optimistic reactions list after setting (or clearing) mine. */
export const applyReaction = (reactions: ChatReaction[] | null | undefined, me: string, emoji: string | null): ChatReaction[] => {
  const others = (reactions ?? []).filter((r) => r.userId !== me);
  return emoji ? [...others, { userId: me, emoji }] : others;
};

export const canUnsend = (message: MessageLike, me: string) => message.senderId === me && message.kind !== 'snap' && message.kind !== 'unsent';
export const canReact = (message: MessageLike) => message.kind !== 'unsent' && message.kind !== 'snap';

/** What a shared signal carries: a link and a snapshot to recognise it - never who posted it. */
export const signalShareOf = (item: { id: string; signalType: string; signalValue?: string | null; title?: string | null; locationName?: string | null }): SignalShare => ({
  postId: item.id,
  signalType: item.signalType,
  signalValue: item.signalValue ?? null,
  title: item.title?.trim() ? item.title.trim().slice(0, 120) : null,
  locationName: item.locationName?.trim() ? item.locationName.trim().slice(0, 120) : null,
});
