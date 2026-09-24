import { useVideoPlayer, VideoView } from 'expo-video';
import { Eye, Heart, Send, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteStory, likeStory, listStoryViewers, listUserStories, markStorySeen, sendMessage, startConversation, storyMediaSource } from '../../api';
import { tap } from '../../haptics';
import { formatAge } from '../../presentation';
import { firstUnseenIndex, nextStep, previousStep, segmentFill, sortViewers, STORY_QUICK_REACTIONS, storyReplyText, storySeconds, storySwipe, withStoryLike, type Story, type StorySwipe, type StoryTrayItem, type StoryViewer as Viewer } from '../../stories';
// Drawn over live camera/photo/video: always the dark media palette, whatever the app theme (plan-devam B3).
import { media, mediaColors as colors, radii, spacing, springs, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';

type Props = {
  auth: AuthResponse;
  /** Everyone with stories in the order of the tray; watching moves on to the next person after the last story. */
  authors: StoryTrayItem[];
  startAuthorId: string;
  onClose: () => void;
  refresh?: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
};

const TICK_MS = 100;
/** Pan activates only after a clear move, so taps on the zones and buttons stay taps. */
const PAN_SLOP = 14;

function StoryVideo({ source, paused }: { source: { uri: string; headers: Record<string, string> }; paused: boolean }) {
  const player = useVideoPlayer({ uri: source.uri, headers: source.headers }, (instance) => { instance.loop = false; instance.play(); });
  useEffect(() => { if (paused) player.pause(); else player.play(); }, [paused, player]);
  return <VideoView contentFit="contain" nativeControls={false} player={player} pointerEvents="none" style={StyleSheet.absoluteFill} />;
}

/**
 * Full-screen story viewer (sinyal-mvp-plan P7.7/P7.8, V2-3): segment bars, tap right/left for next/previous, hold to
 * pause, swipe sideways to change person with a cube turn (a plain slide when Reduce Motion is on), swipe down to
 * close (the story shrinks away). Someone else's story has a heart and six quick emoji replies; replies are ordinary
 * direct messages. My own story shows its viewers (hearts first) and can be deleted. The next person's stories are
 * fetched ahead so the turn lands on a ready story.
 */
export function StoryViewer({ auth, authors, startAuthorId, onClose, refresh = {} }: Props) {
  const { t } = useTranslation('feed');
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [authorIndex, setAuthorIndex] = useState(Math.max(0, authors.findIndex((a) => a.authorId === startAuthorId)));
  const [stories, setStories] = useState<Story[] | null>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replyFocused, setReplyFocused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const elapsed = useRef(0);
  /** Stories already fetched per person (the next person is fetched ahead). */
  const cache = useRef(new Map<string, Story[]>());
  const closing = useRef(false);
  /** When the last drag started or ended: the release of a swipe must not also count as a tap on a zone. */
  const lastDrag = useRef(0);
  const markDrag = useCallback((on: boolean) => { lastDrag.current = Date.now(); setDragging(on); }, []);
  const tapStep = (forward: boolean) => { if (Date.now() - lastDrag.current > 350) step(forward); };
  const author = authors[authorIndex];
  const story = stories?.[index] ?? null;
  const mine = author?.authorId === auth.userId;
  const holding = paused || dragging || replyFocused || Boolean(viewers) || confirmDelete || reply.length > 0;

  // One face of the cube: -1 (left side) .. 0 (facing me) .. 1 (right side). dragY pulls the whole story down.
  const face = useSharedValue(0);
  const dragY = useSharedValue(0);
  const fade = useSharedValue(1);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const done = () => onClose();
    if (reduceMotion) fade.value = withTiming(0, { duration: 140 }, (finished) => { if (finished) runOnJS(done)(); });
    else dragY.value = withTiming(height, { duration: 220, easing: Easing.in(Easing.quad) }, (finished) => { if (finished) runOnJS(done)(); });
  }, [dragY, fade, height, onClose, reduceMotion]);

  /** Change person; `from` is where the new face comes in (1 = from the right, -1 = from the left). */
  const goAuthor = useCallback((next: number, from?: number) => {
    if (next < 0 || next >= authors.length) { close(); return; }
    const side = from ?? (next > authorIndex ? 1 : -1);
    // Keep a face that is already half turned by the finger continuous; otherwise start fully on its side.
    face.value = Math.abs(face.value) > 0.02 ? side * (1 - Math.min(1, Math.abs(face.value))) : side;
    face.value = reduceMotion ? withTiming(0, { duration: 180 }) : withSpring(0, springs.sheet);
    setAuthorIndex(next);
  }, [authorIndex, authors.length, close, face, reduceMotion]);

  // Load the current person's stories (from the cache when fetched ahead) and start at the first one not watched.
  useEffect(() => {
    if (!author) { close(); return undefined; }
    const show = (list: Story[]) => {
      if (list.length === 0) { goAuthor(authorIndex + 1, 1); return; }
      setStories(list);
      setIndex(firstUnseenIndex(list));
    };
    setError(null);
    const cached = cache.current.get(author.authorId);
    if (cached) { show(cached); return undefined; }
    const controller = new AbortController();
    setStories(null);
    listUserStories(auth, author.authorId, controller.signal, refresh)
      .then((list) => { if (!controller.signal.aborted) { cache.current.set(author.authorId, list); show(list); } })
      .catch(() => { if (!controller.signal.aborted) setError(t('stories.loadFailed')); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorIndex]);

  // Fetch the next person ahead: their list, and (below) their first photo into the image cache.
  const nextAuthor = authors[authorIndex + 1];
  useEffect(() => {
    if (!stories || !nextAuthor || cache.current.has(nextAuthor.authorId)) return undefined;
    const controller = new AbortController();
    listUserStories(auth, nextAuthor.authorId, controller.signal, refresh)
      .then((list) => { if (!controller.signal.aborted) cache.current.set(nextAuthor.authorId, list); })
      .catch(() => {}); // only a head start; the normal load retries
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories, nextAuthor?.authorId]);
  const nextList = nextAuthor ? cache.current.get(nextAuthor.authorId) : undefined;
  const warm = nextList?.length ? nextList[firstUnseenIndex(nextList)] : undefined;

  // A new story: reset the clock, and tell the server it was seen (never for my own).
  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
    setLoaded(false);
    setViewers(null);
    setConfirmDelete(false);
    if (story && !mine && !story.seen) void markStorySeen(auth, story.id, refresh).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  const step = useCallback((forward: boolean) => {
    if (!stories) return;
    const move = forward ? nextStep(index, stories.length) : previousStep(index);
    if (move.kind === 'close') goAuthor(authorIndex + 1, 1);
    else if (!forward && index === 0 && authorIndex > 0) goAuthor(authorIndex - 1, -1);
    else { setIndex(move.index); elapsed.current = 0; setProgress(0); }
  }, [stories, index, authorIndex, goAuthor]);

  // The clock only runs once the media has loaded and nothing is holding the story.
  useEffect(() => {
    if (!story || !loaded || holding) return undefined;
    const total = storySeconds(story) * 1000;
    const timer = setInterval(() => {
      elapsed.current += TICK_MS;
      const next = elapsed.current / total;
      setProgress(next);
      if (next >= 1) step(true);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [story, loaded, holding, step]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  }, [close]);

  const settle = useCallback((swipe: StorySwipe) => {
    setDragging(false);
    if (swipe === 'close') { close(); return; }
    if (swipe === 'nextAuthor' && authorIndex + 1 < authors.length) { goAuthor(authorIndex + 1, 1); return; }
    if (swipe === 'previousAuthor' && authorIndex > 0) { goAuthor(authorIndex - 1, -1); return; }
    if (swipe === 'nextAuthor') { close(); return; } // past the last person
    face.value = withSpring(0, springs.sheet);
    dragY.value = withSpring(0, springs.sheet);
  }, [authorIndex, authors.length, close, dragY, face, goAuthor, markDrag]);

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-PAN_SLOP, PAN_SLOP])
    .activeOffsetY([-PAN_SLOP, PAN_SLOP])
    .onStart(() => { runOnJS(markDrag)(true); })
    .onUpdate((e) => {
      if (Math.abs(e.translationY) > Math.abs(e.translationX)) { dragY.value = Math.max(0, e.translationY); face.value = 0; }
      else { face.value = Math.max(-1, Math.min(1, e.translationX / width)); dragY.value = 0; }
    })
    .onEnd((e) => { runOnJS(settle)(storySwipe(e.translationX, e.translationY, e.velocityX, e.velocityY)); })
    .onFinalize((_e, success) => { if (!success) runOnJS(setDragging)(false); }),
  [dragY, face, settle, width]);

  // Cube turn: the face pivots on the edge it shares with its neighbour. Reduce Motion: a plain slide.
  const cubeStyle = useAnimatedStyle(() => {
    const v = face.value;
    const pull = Math.min(1, dragY.value / Math.max(1, height));
    return {
      borderRadius: pull > 0 ? radii.card : 0,
      opacity: fade.value,
      transform: [
        { perspective: 1200 },
        { translateY: dragY.value },
        { scale: 1 - pull * 0.35 },
        { translateX: v * width },
        { rotateY: `${reduceMotion ? 0 : v * 90}deg` },
      ],
      transformOrigin: v < 0 ? 'right center' : v > 0 ? 'left center' : 'center',
    };
  }, [dragY, face, fade, height, reduceMotion, width]);
  // Pulling down lets what is behind show through, so the shrinking story reads as going back where it came from.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value * (1 - Math.min(1, (dragY.value / Math.max(1, height)) * 2.2)) }), [dragY, fade, height]);

  const sendReplyText = async (text: string, sent: string) => {
    if (!text || !author) return;
    try {
      const conversation = await startConversation(auth, author.authorId, refresh.onAuthRefresh, refresh.onSessionExpired);
      await sendMessage(auth, conversation.id, text, refresh.onAuthRefresh, refresh.onSessionExpired);
      setNotice(sent);
      return true;
    } catch {
      setNotice(t('stories.replyFailed'));
      return false;
    }
  };
  const sendReply = async () => { if (await sendReplyText(storyReplyText(reply), t('stories.replySent'))) setReply(''); };
  const sendReaction = (emoji: string) => { tap(); void sendReplyText(storyReplyText(emoji), t('stories.reactionSent', { emoji })); };

  const toggleLike = async () => {
    if (!story || !stories || !author || mine) return;
    const liked = !story.likedByMe;
    tap();
    const optimistic = withStoryLike(stories, story.id, liked);
    setStories(optimistic);
    cache.current.set(author.authorId, optimistic);
    try {
      await likeStory(auth, story.id, liked, refresh);
    } catch {
      setStories((current) => (current ? withStoryLike(current, story.id, !liked) : current));
      cache.current.set(author.authorId, withStoryLike(optimistic, story.id, !liked));
      setNotice(t('stories.likeFailed'));
    }
  };

  const openViewers = async () => {
    if (!story) return;
    try { setViewers(sortViewers(await listStoryViewers(auth, story.id, refresh))); } catch { setViewers([]); }
  };

  const remove = async () => {
    if (!story || !stories) return;
    try {
      await deleteStory(auth, story.id, refresh);
      const left = stories.filter((s) => s.id !== story.id);
      cache.current.set(author.authorId, left);
      if (left.length === 0) { close(); return; } // nothing of mine left to show
      setStories(left);
      setIndex(Math.min(index, left.length - 1));
    } catch {
      setNotice(t('stories.loadFailed'));
    }
  };

  const source = story ? storyMediaSource(auth, story.id) : null;
  const likeCount = story?.likeCount ?? 0;

  return (
    <View style={styles.screen} testID="story-viewer">
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.face, cubeStyle]}>
          {source && story ? (
            story.mediaType === 'Video'
              ? <StoryVideo paused={holding} source={source} />
              : <Image accessibilityLabel={story.caption ?? t('stories.trayLabel')} onError={() => setLoaded(true)} onLoad={() => setLoaded(true)} resizeMode="contain" source={source} style={StyleSheet.absoluteFill} />
          ) : null}
          {story?.mediaType === 'Video' && !loaded ? <VideoReady onReady={() => setLoaded(true)} /> : null}
          {warm && warm.mediaType !== 'Video' ? <Image accessibilityElementsHidden importantForAccessibility="no-hide-descendants" source={storyMediaSource(auth, warm.id)} style={styles.warm} /> : null}
          {!stories && !error ? <ActivityIndicator color={colors.text} style={styles.center} /> : null}
          {error ? <Text style={[styles.center, styles.error]}>{error}</Text> : null}

          {/* Tap zones: left third goes back, the rest goes forward; holding pauses. */}
          <View style={styles.zones}>
            <Pressable accessibilityLabel={t('stories.previous')} accessibilityRole="button" delayLongPress={200} onLongPress={() => setPaused(true)} onPress={() => tapStep(false)} onPressOut={() => setPaused(false)} style={styles.zoneLeft} />
            <Pressable accessibilityLabel={t('stories.next')} accessibilityRole="button" delayLongPress={200} onLongPress={() => setPaused(true)} onPress={() => tapStep(true)} onPressOut={() => setPaused(false)} style={styles.zoneRight} testID="story-next" />
          </View>

          <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.bars}>
              {(stories ?? []).map((s, i) => (
                <View key={s.id} style={styles.bar}>
                  <View style={[styles.barFill, { width: `${segmentFill(i, index, progress) * 100}%` }]} />
                </View>
              ))}
            </View>
            <View style={styles.head}>
              <Avatar avatarKey={mine ? auth.avatarKey : undefined} seed={author?.authorId ?? 'x'} size={32} />
              <Text numberOfLines={1} style={styles.name}>{mine ? t('stories.yours') : author?.authorName}</Text>
              {story ? <Text style={styles.age}>{formatAge(story.createdAtUtc)}</Text> : null}
              <AnimatedPressable accessibilityLabel={t('stories.close')} accessibilityRole="button" hitSlop={10} onPress={close} pressScale={0.9} style={styles.close}>
                <X color={colors.text} size={24} />
              </AnimatedPressable>
            </View>
          </View>

          {story?.caption ? <Text style={styles.caption}>{story.caption}</Text> : null}

          <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
            {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
            {mine ? (
              viewers ? (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>{t('stories.viewersTitle')}</Text>
                  <ScrollView style={styles.viewerList}>
                    {viewers.length === 0 ? <Text style={styles.age}>{t('stories.noViewers')}</Text> : viewers.map((v) => (
                      <View key={v.userId} style={styles.viewerRow}>
                        <Avatar seed={v.userId} size={28} />
                        <Text style={styles.name}>{v.userName}</Text>
                        {v.liked ? <View accessibilityLabel={t('stories.likedIt')} accessible testID={`viewer-liked-${v.userId}`}><Heart color={colors.danger} fill={colors.danger} size={16} /></View> : null}
                        <Text style={styles.viewerAge}>{formatAge(v.seenAtUtc)}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  <AnimatedPressable accessibilityRole="button" onPress={() => setViewers(null)} pressScale={0.97} style={styles.pill}><Text style={styles.pillText}>{t('stories.cancel')}</Text></AnimatedPressable>
                </View>
              ) : confirmDelete ? (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>{t('stories.deleteConfirm')}</Text>
                  <View style={styles.row}>
                    <AnimatedPressable accessibilityRole="button" onPress={() => { void remove(); }} pressScale={0.97} style={[styles.pill, styles.danger]}><Text style={styles.pillText}>{t('stories.deleteYes')}</Text></AnimatedPressable>
                    <AnimatedPressable accessibilityRole="button" onPress={() => setConfirmDelete(false)} pressScale={0.97} style={styles.pill}><Text style={styles.pillText}>{t('stories.cancel')}</Text></AnimatedPressable>
                  </View>
                </View>
              ) : (
                <View style={styles.row}>
                  <AnimatedPressable accessibilityRole="button" onPress={() => { void openViewers(); }} pressScale={0.97} style={styles.pill}>
                    <Eye color={colors.text} size={16} />
                    <Text style={styles.pillText}>{t('stories.viewers', { count: story?.viewerCount ?? 0 })}</Text>
                    {likeCount > 0 ? (
                      <>
                        <Heart color={colors.danger} fill={colors.danger} size={14} />
                        <Text accessibilityLabel={t('stories.likes', { count: likeCount })} style={styles.pillText}>{likeCount}</Text>
                      </>
                    ) : null}
                  </AnimatedPressable>
                  <AnimatedPressable accessibilityLabel={t('stories.delete')} accessibilityRole="button" onPress={() => setConfirmDelete(true)} pressScale={0.95} style={styles.pill}>
                    <Trash2 color={colors.text} size={16} />
                  </AnimatedPressable>
                </View>
              )
            ) : story ? (
              <>
                {replyFocused || reply.length === 0 ? (
                  <View style={styles.reactions} testID="story-reactions">
                    {STORY_QUICK_REACTIONS.map((emoji) => (
                      <AnimatedPressable accessibilityLabel={t('stories.react', { emoji })} accessibilityRole="button" key={emoji} onPress={() => sendReaction(emoji)} pressScale={0.85} style={styles.reaction}>
                        <Text style={styles.reactionText}>{emoji}</Text>
                      </AnimatedPressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.replyRow}>
                  <TextInput
                    accessibilityLabel={t('stories.replyPlaceholder', { name: author?.authorName ?? '' })}
                    maxLength={300}
                    onBlur={() => setReplyFocused(false)}
                    onChangeText={setReply}
                    onFocus={() => setReplyFocused(true)}
                    placeholder={t('stories.replyPlaceholder', { name: author?.authorName ?? '' })}
                    placeholderTextColor={media.textSoft}
                    style={styles.replyInput}
                    value={reply}
                  />
                  {reply.trim() ? (
                    <AnimatedPressable accessibilityLabel={t('stories.send')} accessibilityRole="button" onPress={() => { void sendReply(); }} pressScale={0.9} style={styles.send}>
                      <Send color={colors.ink} size={18} />
                    </AnimatedPressable>
                  ) : (
                    <AnimatedPressable
                      accessibilityLabel={story.likedByMe ? t('stories.unlike') : t('stories.like')}
                      accessibilityRole="button"
                      accessibilityState={{ selected: Boolean(story.likedByMe) }}
                      hitSlop={6}
                      onPress={() => { void toggleLike(); }}
                      pressScale={0.8}
                      style={styles.heart}
                      testID="story-like"
                    >
                      <Heart color={story.likedByMe ? colors.danger : colors.text} fill={story.likedByMe ? colors.danger : 'transparent'} size={26} />
                    </AnimatedPressable>
                  )}
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Videos report readiness through the player; until then the clock waits (a short fallback starts it anyway). */
function VideoReady({ onReady }: { onReady: () => void }) {
  useEffect(() => { const timer = setTimeout(onReady, 800); return () => clearTimeout(timer); }, [onReady]);
  return null;
}

const styles = StyleSheet.create({
  screen: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 50 },
  backdrop: { backgroundColor: media.black },
  face: { backfaceVisibility: 'hidden', backgroundColor: media.black, flex: 1, overflow: 'hidden' },
  warm: { height: 1, left: 0, opacity: 0, position: 'absolute', top: 0, width: 1 },
  center: { alignSelf: 'center', position: 'absolute', top: '48%' },
  error: { ...typography.body, color: colors.text },
  zones: { bottom: 160, flexDirection: 'row', left: 0, position: 'absolute', right: 0, top: 90 },
  zoneLeft: { flex: 1 },
  zoneRight: { flex: 2 },
  top: { gap: spacing.sm, left: 0, paddingHorizontal: spacing.md, position: 'absolute', right: 0, top: 0 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { backgroundColor: media.line, borderRadius: 2, flex: 1, height: 3, overflow: 'hidden' },
  barFill: { backgroundColor: colors.white, height: 3 },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  name: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  age: { ...typography.caption, color: media.textSoft },
  viewerAge: { ...typography.caption, color: media.textSoft, marginLeft: 'auto' },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: 'auto', width: 44 },
  caption: { ...typography.bodyStrong, alignSelf: 'center', backgroundColor: media.scrim, borderRadius: radii.md, bottom: 190, color: colors.text, overflow: 'hidden', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, position: 'absolute' },
  bottom: { bottom: 0, gap: spacing.sm, left: 0, paddingHorizontal: spacing.md, position: 'absolute', right: 0 },
  notice: { ...typography.caption, color: colors.text, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  pill: { alignItems: 'center', backgroundColor: media.lineSoft, borderRadius: radii.pill, flexDirection: 'row', gap: 6, minHeight: 44, paddingHorizontal: spacing.md },
  pillText: { ...typography.bodyStrong, color: colors.text },
  danger: { backgroundColor: colors.danger },
  panel: { backgroundColor: media.panel, borderRadius: radii.card, gap: spacing.sm, padding: spacing.md },
  panelTitle: { ...typography.bodyStrong, color: colors.text },
  viewerList: { maxHeight: 200 },
  viewerRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 40 },
  reactions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  reaction: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  reactionText: { ...typography.headline },
  replyRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  replyInput: { ...typography.body, borderColor: media.textFaint, borderRadius: radii.pill, borderWidth: 1, color: colors.text, flex: 1, minHeight: 44, paddingHorizontal: spacing.md },
  send: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  heart: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
});
