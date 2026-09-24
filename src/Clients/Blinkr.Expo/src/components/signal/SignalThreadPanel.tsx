import { ChevronLeft, CornerDownRight, Heart, MessageCircle, MoreHorizontal, Send, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiCodeError, addPostComment, deletePostComment, getPostComments, getPostEngagement, togglePostLike } from '../../api';
import {
  COMMENT_MAX,
  COMMENT_POLL_MS,
  type CommentSort,
  type CommentView,
  commentState,
  confirmComment,
  countComments,
  engagementErrorKey,
  formatCount,
  insertComment,
  mergeCommentPages,
  optimisticComment,
  removeComment,
  toggleLike,
  visibleReplies,
} from '../../engagement';
import * as haptics from '../../haptics';
import { formatAge } from '../../presentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { SegmentedControl } from '../ui/BlinkrSegmentedControl';
import { PersonalDataNotice } from '../ui/PersonalDataNotice';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

type Props = {
  auth: AuthResponse | null;
  postId: string;
  /** The signal itself (card), shown above the actions. */
  header: React.ReactNode;
  onBack?: () => void;
  onClose: () => void;
  refresh?: Refresh;
  /** Reports a comment's author (or, for an anonymous post author, the signal). */
  onReport?: (target: { kind: 'user'; userId: string; label: string } | { kind: 'signal'; label: string }) => void;
  /** Opens the likers list. */
  onOpenLikers?: () => void;
  /** Full page (V2-2): the list takes the free height and the comment box sits at the bottom. */
  fill?: boolean;
  /** Top bar title; "Yorumlar" by default. */
  title?: string;
  /** The header already shows like/comment actions (the full-page signal card). */
  hideActions?: boolean;
};

const errorMessage = (t: (key: string) => string, err: unknown, fallbackKey: string) =>
  err instanceof ApiCodeError && err.code !== 'UNKNOWN' ? t(engagementErrorKey(err.code)) : t(fallbackKey);

/**
 * Signal detail with likes and comments (sinyal-mvp-plan Faz 4 P4.2-P4.6). Lives inside the existing detail
 * sheet (swaps content like the report panel - no second sheet). Likes and comments are optimistic and roll
 * back on failure; while open, page 1 is refreshed every few seconds (REST polling, DECISIONS D-005).
 */
export function SignalThreadPanel({ auth, postId, header, onBack, onClose, refresh = {}, onReport, onOpenLikers, fill = false, title, hideActions = false }: Props) {
  const { t, i18n } = useTranslation(['signal', 'errors', 'common']);
  const lang = i18n.language === 'en' ? 'en' : 'tr';
  const [like, setLike] = useState({ liked: false, count: 0 });
  const [postAuthorId, setPostAuthorId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<CommentSort>('newest');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const likeBusy = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const loadFirstPage = useCallback(async (signal?: AbortSignal, quiet = false) => {
    try {
      const [engagement, first] = await Promise.all([
        getPostEngagement(auth, postId, signal, refreshRef.current),
        getPostComments(auth, postId, 1, sort, signal, refreshRef.current),
      ]);
      if (signal?.aborted) return;
      if (!likeBusy.current) setLike({ liked: engagement.isLikedByCurrentUser, count: engagement.likeCount });
      setPostAuthorId(engagement.authorId ?? null);
      setComments((current) => mergeCommentPages(current, first));
      setTotal(first.commentCount);
      setHasMore(first.hasMore);
      setPage(1);
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      // A failed refresh keeps what is already shown (kök CLAUDE.md §16); only the first load shows an error.
      if (!quiet) setError(errorMessage(t, err, 'errors:engagement.loadFailed'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [auth, postId, sort, t]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setComments([]);
    void loadFirstPage(controller.signal);
    return () => controller.abort();
  }, [loadFirstPage]);

  // Light polling while the thread is open, only while nothing past page 1 is shown (a poll replaces page 1).
  useEffect(() => {
    if (page > 1) return undefined;
    const controller = new AbortController();
    const timer = setInterval(() => { void loadFirstPage(controller.signal, true); }, COMMENT_POLL_MS);
    return () => { clearInterval(timer); controller.abort(); };
  }, [loadFirstPage, page]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await getPostComments(auth, postId, page + 1, sort, undefined, refreshRef.current);
      setComments((current) => mergeCommentPages(current, next));
      setHasMore(next.hasMore);
      setPage(next.page);
    } catch (err) {
      setNotice(errorMessage(t, err, 'errors:engagement.loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  };

  const isOwnPost = Boolean(auth && postAuthorId && postAuthorId === auth.userId);

  const pressLike = async () => {
    if (!auth || likeBusy.current || isOwnPost) return;
    likeBusy.current = true;
    const before = like;
    const after = toggleLike(before);
    setLike(after);
    haptics.tap();
    try {
      const liked = await togglePostLike(auth, postId, refreshRef.current);
      if (liked !== after.liked) setLike(before); // the server disagrees: trust it
    } catch (err) {
      setLike(before);
      setNotice(errorMessage(t, err, 'errors:engagement.likeFailed'));
    } finally {
      likeBusy.current = false;
    }
  };

  const send = async () => {
    if (!auth) return;
    const { trimmed, empty, tooLong } = commentState(draft);
    if (empty || tooLong) return;
    const localId = `local-${Date.now()}`;
    const parent = replyTo ? (replyTo.parentCommentId ?? replyTo.commentId) : null;
    const local = optimisticComment({
      localId,
      text: trimmed,
      authorName: auth.userName,
      authorId: auth.userId,
      isPostAuthor: isOwnPost,
      parentCommentId: parent,
      nowIso: new Date().toISOString(),
    });
    setComments((current) => insertComment(current, local));
    if (parent) setExpanded((current) => ({ ...current, [parent]: true }));
    setTotal((n) => n + 1);
    setDraft('');
    setReplyTo(null);
    try {
      const serverId = await addPostComment(auth, postId, trimmed, parent, refreshRef.current);
      setComments((current) => confirmComment(current, localId, serverId));
      haptics.success();
    } catch (err) {
      setComments((current) => removeComment(current, localId));
      setTotal((n) => Math.max(0, n - 1));
      setDraft(trimmed); // nothing typed is lost
      setNotice(errorMessage(t, err, 'errors:engagement.commentFailed'));
    }
  };

  const remove = async (comment: CommentView) => {
    if (!auth) return;
    setConfirmDelete(null);
    setMenuFor(null);
    const before = comments;
    const beforeTotal = total;
    const next = removeComment(comments, comment.commentId);
    setComments(next);
    setTotal(Math.max(0, beforeTotal - (countComments(before) - countComments(next))));
    try {
      await deletePostComment(auth, postId, comment.commentId, refreshRef.current);
    } catch (err) {
      setComments(before);
      setTotal(beforeTotal);
      setNotice(errorMessage(t, err, 'errors:engagement.deleteFailed'));
    }
  };

  const startReply = (comment: CommentView) => {
    setReplyTo(comment);
    setMenuFor(null);
    inputRef.current?.focus();
  };

  const authorLabel = (comment: CommentView) =>
    comment.isPostAuthor && !comment.authorId ? t('signal:comments.author') : comment.authorName;

  const renderComment = (comment: CommentView, isReply: boolean) => {
    const menuOpen = menuFor === comment.commentId;
    const confirming = confirmDelete === comment.commentId;
    return (
      <View key={comment.commentId} style={[styles.comment, isReply && styles.reply, comment.pending && styles.pending]} testID={`comment-${comment.commentId}`}>
        <Avatar seed={comment.authorId ?? `anon-${postId}`} size={isReply ? 28 : 34} />
        <View style={styles.commentBody}>
          <View style={styles.commentMeta}>
            <Text numberOfLines={1} style={styles.commentAuthor}>{authorLabel(comment)}</Text>
            {comment.isPostAuthor && comment.authorId ? <Text style={styles.authorBadge}>{t('signal:comments.author')}</Text> : null}
            <Text style={styles.commentAge}>{comment.pending ? t('signal:comments.sending') : formatAge(comment.createdAtUtc)}</Text>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          {!comment.pending ? (
            <View style={styles.commentActions}>
              {auth ? (
                <AnimatedPressable accessibilityLabel={t('signal:comments.reply')} accessibilityRole="button" hitSlop={8} onPress={() => startReply(comment)} pressScale={0.95}>
                  <Text style={styles.linkText}>{t('signal:comments.reply')}</Text>
                </AnimatedPressable>
              ) : null}
              {auth && (comment.canDelete || (!comment.isMine && onReport)) ? (
                <AnimatedPressable accessibilityLabel={t('signal:comments.options')} accessibilityRole="button" hitSlop={8} onPress={() => { setMenuFor(menuOpen ? null : comment.commentId); setConfirmDelete(null); }} pressScale={0.95}>
                  <MoreHorizontal color={colors.textSecondary} size={18} />
                </AnimatedPressable>
              ) : null}
            </View>
          ) : null}
          {menuOpen ? (
            <View style={styles.menu}>
              {comment.canDelete && !confirming ? (
                <AnimatedPressable accessibilityRole="button" onPress={() => setConfirmDelete(comment.commentId)} pressScale={0.97} style={styles.menuItem}>
                  <Text style={styles.dangerText}>{t('signal:comments.delete')}</Text>
                </AnimatedPressable>
              ) : null}
              {confirming ? (
                <View style={styles.confirm}>
                  <Text style={styles.confirmTitle}>{t('signal:comments.deleteConfirm')}</Text>
                  <Text style={styles.commentAge}>{t('signal:comments.deleteConfirmHint')}</Text>
                  <View style={styles.confirmRow}>
                    <AnimatedPressable accessibilityRole="button" onPress={() => setConfirmDelete(null)} pressScale={0.97} style={styles.menuItem}>
                      <Text style={styles.linkText}>{t('common:action.cancel')}</Text>
                    </AnimatedPressable>
                    <AnimatedPressable accessibilityRole="button" onPress={() => { void remove(comment); }} pressScale={0.97} style={styles.menuItem}>
                      <Text style={styles.dangerText}>{t('signal:comments.delete')}</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              ) : null}
              {!comment.isMine && onReport ? (
                <AnimatedPressable
                  accessibilityRole="button"
                  onPress={() => { setMenuFor(null); onReport(comment.authorId ? { kind: 'user', userId: comment.authorId, label: comment.authorName } : { kind: 'signal', label: authorLabel(comment) }); }}
                  pressScale={0.97}
                  style={styles.menuItem}
                >
                  <Text style={styles.linkText}>{t('signal:comments.report')}</Text>
                </AnimatedPressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const { empty, tooLong, remaining } = commentState(draft);

  return (
    <View style={[styles.root, fill && styles.fill]}>
      <View style={styles.topBar}>
        {onBack ? (
          <AnimatedPressable accessibilityLabel={t('signal:back')} accessibilityRole="button" hitSlop={10} onPress={onBack} pressScale={0.88} style={styles.iconButton}>
            <ChevronLeft color={colors.text} size={22} />
          </AnimatedPressable>
        ) : <View style={styles.iconSpacer} />}
        <Text accessibilityRole="header" numberOfLines={1} style={styles.topTitle}>{title ?? t('signal:comments.title')}</Text>
        <AnimatedPressable accessibilityLabel={t('common:action.close')} accessibilityRole="button" hitSlop={10} onPress={onClose} pressScale={0.88} style={styles.iconButton}>
          <X color={colors.text} size={22} />
        </AnimatedPressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={[styles.scroll, fill && styles.fill]} testID="thread-scroll">
        {header}

        {hideActions ? null : <View style={styles.actionRow}>
          <AnimatedPressable
            accessibilityLabel={like.liked ? t('signal:engagement.unlike') : t('signal:engagement.like')}
            accessibilityRole="button"
            aria-selected={like.liked}
            disabled={!auth || isOwnPost}
            onPress={() => { void pressLike(); }}
            pressScale={0.9}
            style={[styles.actionButton, (!auth || isOwnPost) && styles.actionDisabled]}
            testID="like-button"
          >
            <Heart color={like.liked ? colors.danger : colors.text} fill={like.liked ? colors.danger : 'none'} size={22} />
            <Text style={styles.actionCount}>{formatCount(like.count, lang)}</Text>
          </AnimatedPressable>
          <View style={styles.actionButton}>
            <MessageCircle color={colors.text} size={22} />
            <Text style={styles.actionCount}>{formatCount(total, lang)}</Text>
          </View>
          {onOpenLikers && like.count > 0 ? (
            <AnimatedPressable accessibilityRole="button" onPress={onOpenLikers} pressScale={0.95} style={styles.likersLink}>
              <Text style={styles.linkText}>{t('signal:engagement.likes', { count: like.count })}</Text>
            </AnimatedPressable>
          ) : null}
        </View>}

        {notice ? (
          <AnimatedPressable accessibilityRole="alert" onPress={() => setNotice(null)} pressScale={0.98} style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </AnimatedPressable>
        ) : null}

        <View style={styles.sortRow}>
          <SegmentedControl
            accessibilityLabel={t('signal:comments.title')}
            onChange={(value) => setSort(value)}
            options={[{ value: 'newest', label: t('signal:comments.sortNewest') }, { value: 'oldest', label: t('signal:comments.sortOldest') }]}
            value={sort}
          />
        </View>

        {loading ? <ActivityIndicator color={colors.mint} style={styles.loading} /> : null}
        {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!loading && !error && comments.length === 0 ? (
          <BlinkrEmptyState description={t('signal:comments.emptyHint')} icon={<MessageCircle color={colors.textSecondary} size={28} />} title={t('signal:comments.empty')} />
        ) : null}

        {comments.map((comment) => {
          const { shown, hidden } = visibleReplies(comment, Boolean(expanded[comment.commentId]));
          const replyCount = comment.replies?.length ?? 0;
          return (
            <View key={comment.commentId}>
              {renderComment(comment, false)}
              {shown.map((reply) => renderComment(reply, true))}
              {hidden > 0 ? (
                <AnimatedPressable accessibilityRole="button" onPress={() => setExpanded((c) => ({ ...c, [comment.commentId]: true }))} pressScale={0.97} style={styles.repliesToggle}>
                  <CornerDownRight color={colors.textSecondary} size={14} />
                  <Text style={styles.linkText}>{t('signal:comments.showReplies', { count: hidden })}</Text>
                </AnimatedPressable>
              ) : expanded[comment.commentId] && replyCount > 1 ? (
                <AnimatedPressable accessibilityRole="button" onPress={() => setExpanded((c) => ({ ...c, [comment.commentId]: false }))} pressScale={0.97} style={styles.repliesToggle}>
                  <Text style={styles.linkText}>{t('signal:comments.hideReplies')}</Text>
                </AnimatedPressable>
              ) : null}
            </View>
          );
        })}

        {hasMore ? (
          <AnimatedPressable accessibilityRole="button" disabled={loadingMore} onPress={() => { void loadMore(); }} pressScale={0.97} style={styles.loadMore}>
            {loadingMore ? <ActivityIndicator color={colors.mint} size="small" /> : <Text style={styles.linkText}>{t('signal:comments.loadMore')}</Text>}
          </AnimatedPressable>
        ) : null}
      </ScrollView>

      {auth ? (
        <View style={styles.composer}>
          {replyTo ? (
            <View style={styles.replyBar}>
              <Text numberOfLines={1} style={styles.commentAge}>{t('signal:comments.replyingTo', { name: authorLabel(replyTo) })}</Text>
              <AnimatedPressable accessibilityLabel={t('signal:comments.cancelReply')} accessibilityRole="button" hitSlop={8} onPress={() => setReplyTo(null)} pressScale={0.9}>
                <X color={colors.textSecondary} size={16} />
              </AnimatedPressable>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel={t('signal:comments.placeholder')}
              maxLength={COMMENT_MAX + 50}
              multiline
              onChangeText={setDraft}
              placeholder={replyTo ? t('signal:comments.replyPlaceholder', { name: authorLabel(replyTo) }) : t('signal:comments.placeholder')}
              placeholderTextColor={colors.textSecondary}
              ref={inputRef}
              style={styles.input}
              testID="comment-input"
              value={draft}
            />
            <AnimatedPressable
              accessibilityLabel={t('signal:comments.send')}
              accessibilityRole="button"
              disabled={empty || tooLong}
              onPress={() => { void send(); }}
              pressScale={0.9}
              style={[styles.sendButton, (empty || tooLong) && styles.actionDisabled]}
              testID="comment-send"
            >
              <Send color={colors.ink} size={18} />
            </AnimatedPressable>
          </View>
          {remaining < 60 ? <Text style={[styles.commentAge, tooLong && styles.errorText]}>{t('signal:comments.remaining', { count: remaining })}</Text> : null}
          <PersonalDataNotice texts={[draft]} />
        </View>
      ) : (
        <Text style={styles.readOnly}>{t('signal:comments.readOnly')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexShrink: 1 },
  fill: { flex: 1 },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  topTitle: { ...typography.heading, color: colors.text, flex: 1, textAlign: 'center' },
  iconButton: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 36, justifyContent: 'center', width: 36 },
  iconSpacer: { height: 36, width: 36 },
  scroll: { flexShrink: 1 },
  actionRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  actionButton: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 44, minWidth: 44 },
  actionDisabled: { opacity: 0.45 },
  actionCount: { ...typography.bodyStrong, color: colors.text },
  likersLink: { marginLeft: 'auto', minHeight: 44, justifyContent: 'center' },
  notice: { backgroundColor: colors.errorSoft, borderColor: colors.errorLine, borderRadius: radii.md, borderWidth: 1, marginTop: spacing.sm, padding: spacing.sm },
  noticeText: { ...typography.caption, color: colors.danger },
  sortRow: { marginBottom: spacing.sm, marginTop: spacing.md },
  loading: { marginVertical: spacing.lg },
  errorText: { ...typography.caption, color: colors.danger, marginVertical: spacing.sm },
  comment: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
  reply: { marginLeft: 42 },
  pending: { opacity: 0.6 },
  commentBody: { flex: 1, gap: 2 },
  commentMeta: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  commentAuthor: { ...typography.label, color: colors.text, flexShrink: 1 },
  authorBadge: { ...typography.micro, backgroundColor: colors.greenSoft, borderRadius: radii.pill, color: colors.mint, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 1 },
  commentAge: { ...typography.caption, color: colors.textSecondary },
  commentText: { ...typography.body, color: colors.text },
  commentActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, marginTop: 2 },
  linkText: { ...typography.label, color: colors.textSecondary },
  dangerText: { ...typography.label, color: colors.danger },
  menu: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, marginTop: spacing.xs, paddingHorizontal: spacing.sm },
  menuItem: { justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.xs },
  confirm: { gap: 2, paddingVertical: spacing.xs },
  confirmTitle: { ...typography.bodyStrong, color: colors.text },
  confirmRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  repliesToggle: { alignItems: 'center', flexDirection: 'row', gap: 4, marginLeft: 42, minHeight: 36 },
  loadMore: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  composer: { borderTopColor: colors.border, borderTopWidth: 1, gap: 4, marginTop: spacing.sm, paddingTop: spacing.sm },
  replyBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  inputRow: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm },
  input: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, color: colors.text, flex: 1, maxHeight: 110, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: 10 },
  sendButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  readOnly: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.md, textAlign: 'center' },
});
