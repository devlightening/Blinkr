import { useVideoPlayer, VideoView } from 'expo-video';
import { Eye, Send, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteStory, listStoryViewers, listUserStories, markStorySeen, sendMessage, startConversation, storyMediaSource } from '../../api';
import { formatAge } from '../../presentation';
import { firstUnseenIndex, nextStep, previousStep, segmentFill, storyReplyText, storySeconds, type Story, type StoryTrayItem, type StoryViewer as Viewer } from '../../stories';
// Drawn over live camera/photo/video: always the dark media palette, whatever the app theme (plan-devam B3).
import { media, mediaColors as colors, radii, spacing, typography } from '../../theme';
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

function StoryVideo({ source, paused }: { source: { uri: string; headers: Record<string, string> }; paused: boolean }) {
  const player = useVideoPlayer({ uri: source.uri, headers: source.headers }, (instance) => { instance.loop = false; instance.play(); });
  useEffect(() => { if (paused) player.pause(); else player.play(); }, [paused, player]);
  return <VideoView contentFit="contain" nativeControls={false} player={player} pointerEvents="none" style={StyleSheet.absoluteFill} />;
}

/**
 * Full-screen story viewer (sinyal-mvp-plan P7.7/P7.8): segment bars, tap right/left for next/previous, hold to pause,
 * moves on to the next person, marks what was watched. My own story shows its viewers and can be deleted; someone
 * else's can be answered - the reply is an ordinary direct message.
 */
export function StoryViewer({ auth, authors, startAuthorId, onClose, refresh = {} }: Props) {
  const { t } = useTranslation('feed');
  const insets = useSafeAreaInsets();
  const [authorIndex, setAuthorIndex] = useState(Math.max(0, authors.findIndex((a) => a.authorId === startAuthorId)));
  const [stories, setStories] = useState<Story[] | null>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const elapsed = useRef(0);
  const author = authors[authorIndex];
  const story = stories?.[index] ?? null;
  const mine = author?.authorId === auth.userId;
  const holding = paused || Boolean(viewers) || confirmDelete || reply.length > 0;

  const goAuthor = useCallback((next: number) => {
    if (next < 0 || next >= authors.length) { onClose(); return; }
    setAuthorIndex(next);
  }, [authors.length, onClose]);

  // Load the current person's stories and start at the first one not yet watched.
  useEffect(() => {
    if (!author) { onClose(); return undefined; }
    const controller = new AbortController();
    setStories(null);
    setError(null);
    listUserStories(auth, author.authorId, controller.signal, refresh)
      .then((list) => {
        if (controller.signal.aborted) return;
        if (list.length === 0) { goAuthor(authorIndex + 1); return; }
        setStories(list);
        setIndex(firstUnseenIndex(list));
      })
      .catch(() => { if (!controller.signal.aborted) setError(t('stories.loadFailed')); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorIndex]);

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
    if (move.kind === 'close') goAuthor(authorIndex + 1);
    else if (!forward && index === 0 && authorIndex > 0) goAuthor(authorIndex - 1);
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
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);

  const sendReply = async () => {
    const text = storyReplyText(reply);
    if (!text || !author) return;
    try {
      const conversation = await startConversation(auth, author.authorId, refresh.onAuthRefresh, refresh.onSessionExpired);
      await sendMessage(auth, conversation.id, text, refresh.onAuthRefresh, refresh.onSessionExpired);
      setReply('');
      setNotice(t('stories.replySent'));
    } catch {
      setNotice(t('stories.replyFailed'));
    }
  };

  const openViewers = async () => {
    if (!story) return;
    try { setViewers(await listStoryViewers(auth, story.id, refresh)); } catch { setViewers([]); }
  };

  const remove = async () => {
    if (!story || !stories) return;
    try {
      await deleteStory(auth, story.id, refresh);
      const left = stories.filter((s) => s.id !== story.id);
      if (left.length === 0) { onClose(); return; } // nothing of mine left to show
      setStories(left);
      setIndex(Math.min(index, left.length - 1));
    } catch {
      setNotice(t('stories.loadFailed'));
    }
  };

  const source = story ? storyMediaSource(auth, story.id) : null;

  return (
    <View style={styles.screen} testID="story-viewer">
      {source && story ? (
        story.mediaType === 'Video'
          ? <StoryVideo paused={holding} source={source} />
          : <Image accessibilityLabel={story.caption ?? t('stories.trayLabel')} onError={() => setLoaded(true)} onLoad={() => setLoaded(true)} resizeMode="contain" source={source} style={StyleSheet.absoluteFill} />
      ) : null}
      {story?.mediaType === 'Video' && !loaded ? <VideoReady onReady={() => setLoaded(true)} /> : null}
      {!stories && !error ? <ActivityIndicator color={colors.text} style={styles.center} /> : null}
      {error ? <Text style={[styles.center, styles.error]}>{error}</Text> : null}

      {/* Tap zones: left third goes back, the rest goes forward; holding pauses. */}
      <View style={styles.zones}>
        <Pressable accessibilityLabel={t('stories.previous')} accessibilityRole="button" delayLongPress={200} onLongPress={() => setPaused(true)} onPress={() => step(false)} onPressOut={() => setPaused(false)} style={styles.zoneLeft} />
        <Pressable accessibilityLabel={t('stories.next')} accessibilityRole="button" delayLongPress={200} onLongPress={() => setPaused(true)} onPress={() => step(true)} onPressOut={() => setPaused(false)} style={styles.zoneRight} testID="story-next" />
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
          <AnimatedPressable accessibilityLabel={t('stories.close')} accessibilityRole="button" hitSlop={10} onPress={onClose} pressScale={0.9} style={styles.close}>
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
                    <Text style={styles.age}>{formatAge(v.seenAtUtc)}</Text>
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
              </AnimatedPressable>
              <AnimatedPressable accessibilityLabel={t('stories.delete')} accessibilityRole="button" onPress={() => setConfirmDelete(true)} pressScale={0.95} style={styles.pill}>
                <Trash2 color={colors.text} size={16} />
              </AnimatedPressable>
            </View>
          )
        ) : story ? (
          <View style={styles.replyRow}>
            <TextInput
              accessibilityLabel={t('stories.replyPlaceholder', { name: author?.authorName ?? '' })}
              maxLength={300}
              onChangeText={setReply}
              placeholder={t('stories.replyPlaceholder', { name: author?.authorName ?? '' })}
              placeholderTextColor={media.textSoft}
              style={styles.replyInput}
              value={reply}
            />
            <AnimatedPressable accessibilityLabel={t('stories.send')} accessibilityRole="button" disabled={!reply.trim()} onPress={() => { void sendReply(); }} pressScale={0.9} style={[styles.send, !reply.trim() && styles.dim]}>
              <Send color={colors.ink} size={18} />
            </AnimatedPressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Videos report readiness through the player; until then the clock waits (a short fallback starts it anyway). */
function VideoReady({ onReady }: { onReady: () => void }) {
  useEffect(() => { const timer = setTimeout(onReady, 800); return () => clearTimeout(timer); }, [onReady]);
  return null;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: media.black, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 50 },
  center: { alignSelf: 'center', position: 'absolute', top: '48%' },
  error: { ...typography.body, color: colors.text },
  zones: { bottom: 120, flexDirection: 'row', left: 0, position: 'absolute', right: 0, top: 90 },
  zoneLeft: { flex: 1 },
  zoneRight: { flex: 2 },
  top: { gap: spacing.sm, left: 0, paddingHorizontal: spacing.md, position: 'absolute', right: 0, top: 0 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { backgroundColor: media.line, borderRadius: 2, flex: 1, height: 3, overflow: 'hidden' },
  barFill: { backgroundColor: colors.white, height: 3 },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  name: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  age: { ...typography.caption, color: media.textSoft },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', marginLeft: 'auto', width: 44 },
  caption: { ...typography.bodyStrong, alignSelf: 'center', backgroundColor: media.scrim, borderRadius: radii.md, bottom: 140, color: colors.text, overflow: 'hidden', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, position: 'absolute' },
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
  replyRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  replyInput: { ...typography.body, borderColor: media.textFaint, borderRadius: radii.pill, borderWidth: 1, color: colors.text, flex: 1, minHeight: 44, paddingHorizontal: spacing.md },
  send: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  dim: { opacity: 0.4 },
});
