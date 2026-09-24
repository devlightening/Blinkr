/**
 * Post reactions (V2-4, D-027). Pure logic. One reaction per person from a fixed set; a plain like is the heart.
 * Server: `POST /api/posts/{id}/reactions { reaction }` answers `{ reaction, counts }`.
 */
export const HEART = '❤️';
export const REACTIONS = [HEART, '🔥', '😂', '😮', '😢', '👏'] as const;
export type Reaction = (typeof REACTIONS)[number];
export type ReactionCounts = Record<string, number>;
export type ReactionState = { mine: string | null; counts: ReactionCounts };

export const isReaction = (value: unknown): value is Reaction => typeof value === 'string' && (REACTIONS as readonly string[]).includes(value);

export const totalReactions = (counts: ReactionCounts | null | undefined) =>
  Object.values(counts ?? {}).reduce((sum, n) => sum + Math.max(0, n), 0);

/** Choosing a reaction: the same one again takes it back, another replaces mine (optimistic, mirrors the server). */
export const chooseReaction = (state: ReactionState, reaction: string | null): ReactionState => {
  const next = reaction !== null && reaction === state.mine ? null : reaction;
  const counts: ReactionCounts = { ...state.counts };
  if (state.mine) counts[state.mine] = Math.max(0, (counts[state.mine] ?? 0) - 1);
  if (next) counts[next] = (counts[next] ?? 0) + 1;
  for (const key of Object.keys(counts)) if (counts[key] <= 0) delete counts[key];
  return { mine: next, counts };
};

/** The heart button: a tap on no reaction adds the heart, a tap on any reaction takes it back. */
export const tapHeart = (state: ReactionState): ReactionState => chooseReaction(state, state.mine ? state.mine : HEART);

/** The most used emojis first (ties in catalogue order), at most `limit`, for the little summary next to the count. */
export const topReactions = (counts: ReactionCounts | null | undefined, limit = 3) =>
  REACTIONS.filter((r) => (counts?.[r] ?? 0) > 0)
    .sort((a, b) => (counts![b] ?? 0) - (counts![a] ?? 0) || REACTIONS.indexOf(a) - REACTIONS.indexOf(b))
    .slice(0, limit);

/** Reads the server fields, with a like from an older server as the heart. */
export const reactionStateOf = (post: { reactionCounts?: ReactionCounts | null; myReaction?: string | null; likeCount?: number; isLikedByCurrentUser?: boolean }): ReactionState => {
  if (post.reactionCounts && Object.keys(post.reactionCounts).length > 0) return { mine: post.myReaction ?? null, counts: { ...post.reactionCounts } };
  const likes = Math.max(0, post.likeCount ?? 0);
  return { mine: post.myReaction ?? (post.isLikedByCurrentUser ? HEART : null), counts: likes > 0 ? { [HEART]: likes } : {} };
};

/** Comment likes: toggle optimistically. */
export const toggleCommentLike = (comment: { likeCount?: number; likedByMe?: boolean }) => ({
  likedByMe: !comment.likedByMe,
  likeCount: Math.max(0, (comment.likeCount ?? 0) + (comment.likedByMe ? -1 : 1)),
});

/** The fields a feed item or card keeps for a reaction state (liked/likeCount stay the sum, for older screens). */
export const reactionFields = (state: ReactionState) => ({
  reactionCounts: state.counts,
  myReaction: state.mine,
  likeCount: totalReactions(state.counts),
  isLikedByCurrentUser: state.mine !== null,
});
