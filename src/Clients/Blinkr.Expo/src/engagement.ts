/**
 * Likes and comments on a signal (sinyal-mvp-plan Faz 4). Pure logic only - no React Native imports, so the
 * plain Node test pipeline (`test:nearby`) can compile it.
 *
 * Server contract (BlogService):
 * - `POST /api/posts/{id}/likes` toggles and answers `{ liked }`; own post → 400 `CANNOT_LIKE_OWN`.
 * - `GET /api/posts/{id}/comments?page&pageSize&sort` → top-level comments with their replies (one level).
 * - `POST /api/posts/{id}/comments` `{ commentText, parentCommentId? }`; 400 `COMMENT_EMPTY`/`COMMENT_TOO_LONG`.
 * - `DELETE /api/posts/{id}/comments/{commentId}` - the comment's author or the post's author; replies go too.
 * On an AnonymousMap post the post author's own comment has no `authorId` and is labelled "Paylaşan".
 */

export const COMMENT_MAX = 500;
export const COMMENT_PAGE_SIZE = 20;
/** While a thread is open it is refreshed this often (REST polling, no socket: DECISIONS D-005). */
export const COMMENT_POLL_MS = 8000;

export type CommentView = {
  commentId: string;
  authorId?: string | null;
  authorName: string;
  isPostAuthor: boolean;
  isMine: boolean;
  canDelete: boolean;
  parentCommentId?: string | null;
  text: string;
  createdAtUtc: string;
  replies?: CommentView[];
  /** Local only: sent, waiting for the server to confirm. */
  pending?: boolean;
};

export type CommentPage = {
  postId: string;
  items: CommentView[];
  page: number;
  pageSize: number;
  totalCount: number;
  commentCount: number;
  hasMore: boolean;
};

export type CommentSort = 'newest' | 'oldest';

export type LikeState = { liked: boolean; count: number };

/** Optimistic like toggle; the count never goes below zero. */
export const toggleLike = (state: LikeState): LikeState =>
  state.liked
    ? { liked: false, count: Math.max(0, state.count - 1) }
    : { liked: true, count: state.count + 1 };

export const commentState = (text: string) => {
  const trimmed = text.trim();
  return { trimmed, empty: trimmed.length === 0, tooLong: trimmed.length > COMMENT_MAX, remaining: COMMENT_MAX - trimmed.length };
};

/** 950 → "950", 1200 → "1,2B"/"1.2K", 2_000_000 → "2M". Short enough for an action row. */
export const formatCount = (value: number, language: 'tr' | 'en' = 'tr') => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const fmt = (n: number, suffix: string) => {
    const rounded = n >= 10 ? Math.floor(n).toString() : (Math.floor(n * 10) / 10).toString();
    return `${language === 'tr' ? rounded.replace('.', ',') : rounded}${suffix}`;
  };
  if (value >= 1_000_000) return fmt(value / 1_000_000, 'M');
  if (value >= 1_000) return fmt(value / 1_000, language === 'tr' ? 'B' : 'K');
  return String(Math.floor(value));
};

/** Page 1 replaces what is shown (fresh poll); later pages append, dropping any comment already shown. */
export const mergeCommentPages = (current: CommentView[], incoming: CommentPage): CommentView[] => {
  if (incoming.page <= 1) {
    // Keep local pending comments the server has not confirmed yet, so a poll never "eats" what I just wrote.
    const confirmedIds = new Set(incoming.items.flatMap((c) => [c.commentId, ...(c.replies ?? []).map((r) => r.commentId)]));
    const pendingTop = current.filter((c) => c.pending && !confirmedIds.has(c.commentId));
    const withPendingReplies = incoming.items.map((c) => {
      const local = current.find((x) => x.commentId === c.commentId);
      const pendingReplies = (local?.replies ?? []).filter((r) => r.pending && !confirmedIds.has(r.commentId));
      return pendingReplies.length ? { ...c, replies: [...(c.replies ?? []), ...pendingReplies] } : c;
    });
    return [...pendingTop, ...withPendingReplies];
  }
  const shown = new Set(current.map((c) => c.commentId));
  return [...current, ...incoming.items.filter((c) => !shown.has(c.commentId))];
};

export const optimisticComment = (params: {
  localId: string;
  text: string;
  authorName: string;
  authorId: string;
  isPostAuthor: boolean;
  parentCommentId?: string | null;
  nowIso: string;
}): CommentView => ({
  commentId: params.localId,
  authorId: params.authorId,
  authorName: params.authorName,
  isPostAuthor: params.isPostAuthor,
  isMine: true,
  canDelete: false, // not until the server knows it
  parentCommentId: params.parentCommentId ?? null,
  text: params.text,
  createdAtUtc: params.nowIso,
  replies: [],
  pending: true,
});

/** New top-level comments go first (newest sort); replies go at the end of their parent's replies. */
export const insertComment = (items: CommentView[], comment: CommentView): CommentView[] => {
  if (!comment.parentCommentId) return [comment, ...items];
  return items.map((c) => (c.commentId === comment.parentCommentId ? { ...c, replies: [...(c.replies ?? []), comment] } : c));
};

/** Swaps a pending local comment for the server's id once it is accepted. */
export const confirmComment = (items: CommentView[], localId: string, serverId: string): CommentView[] =>
  items.map((c) => {
    if (c.commentId === localId) return { ...c, commentId: serverId, pending: false, canDelete: true };
    const replies = c.replies?.map((r) => (r.commentId === localId ? { ...r, commentId: serverId, pending: false, canDelete: true } : r));
    return replies ? { ...c, replies } : c;
  });

/** Removes a comment and, for a top-level one, its replies - the same as the server does. */
export const removeComment = (items: CommentView[], commentId: string): CommentView[] =>
  items
    .filter((c) => c.commentId !== commentId)
    .map((c) => (c.replies?.some((r) => r.commentId === commentId) ? { ...c, replies: c.replies.filter((r) => r.commentId !== commentId) } : c));

export const countComments = (items: CommentView[]) => items.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0);

/** Replies are collapsed past this many; "n yanıtı gör" shows the rest. */
export const REPLIES_PREVIEW = 1;
export const visibleReplies = (comment: CommentView, expanded: boolean) => {
  const replies = comment.replies ?? [];
  if (expanded || replies.length <= REPLIES_PREVIEW) return { shown: replies, hidden: 0 };
  return { shown: replies.slice(0, REPLIES_PREVIEW), hidden: replies.length - REPLIES_PREVIEW };
};

/** Server error codes → `errors` namespace keys. Unknown codes fall back to the generic message. */
export const engagementErrorKey = (code: string | null | undefined) => {
  switch (code) {
    case 'CANNOT_LIKE_OWN': return 'errors:engagement.cannotLikeOwn';
    case 'COMMENT_EMPTY': return 'errors:engagement.commentEmpty';
    case 'COMMENT_TOO_LONG': return 'errors:engagement.commentTooLong';
    case 'COMMENT_FORBIDDEN': return 'errors:engagement.commentForbidden';
    case 'NOT_FOUND': return 'errors:engagement.notFound';
    case 'CONTENT_BLOCKED': return 'errors:contentBlocked';
    default: return 'errors:generic';
  }
};
