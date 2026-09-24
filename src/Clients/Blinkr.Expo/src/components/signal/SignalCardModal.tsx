import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Flag, Trash2, UserX, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut, interpolate, ReduceMotion, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { blockUser, deleteSignal, getPostComments, getSignalDetail, recordPostViews, sendReport, togglePostLike } from '../../api';
import type { SignalShare } from '../../chatExtras';
import type { ReportReasonId } from '../../friends';
import { distanceMeters } from '../../nearbyRequestOwnership';
import { formatCategory, formatDistance } from '../../presentation';
import { recheckSignal } from '../../productPresentation';
import { isPlaceSaved, savePlace, unsavePlace } from '../../savedPlaces';
import { stepIndex, verifyState, withDetail, type CardSignal } from '../../signalCard';
import { colors, radii, shadowFloat, spacing, springs, typography } from '../../theme';
import type { AuthResponse, BlinkrPlace } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { PlaceSymbol } from '../PlaceSymbol';
import { ReportPanel } from '../ReportPanel';
import { Sheet } from '../Sheet';
import { ShareToChatSheet } from '../chat/ShareToChatSheet';
import { BlinkrButton } from '../ui/BlinkrButton';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { MediaViewer } from './MediaViewer';
import { SignalCard, type TopComment } from './SignalCard';
import { SignalThreadPanel } from './SignalThreadPanel';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

type Props = {
  auth: AuthResponse;
  refresh: Refresh;
  cards: CardSignal[];
  initialIndex?: number;
  /** The place the cards belong to (a place pin), for the summary strip and "save place". */
  place?: BlinkrPlace | null;
  /** Where the device is, when known: distances and the 500 m verify rule. */
  deviceOrigin: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onOpenPlace?: () => void;
  onOpenAuthor: (user: { id: string; userName: string }) => void;
  /** "Evet": publish a confirming signal from the device's real position (the server decides whether it is live). */
  onConfirm: (card: CardSignal) => Promise<void>;
  /** "Değişti": pick the new value (the composer, prefilled with the type). */
  onChanged: (card: CardSignal) => void;
  onDeleted: (postId: string) => void;
  onCreateSignal?: () => void;
  /** The place's signals are still on their way: a spinner rather than "no signals". */
  loading?: boolean;
};

const VIEW_AFTER_MS = 1000;
const CARD_MARGIN = 10;
const HEADER_HEIGHT = 64;
const VIEW_FLUSH_MS = 10_000;

/**
 * The Sinyal Kartı host (plan-devam Faz C, reworked after device feedback): like a Snap Map place card, it rises from
 * the bottom over a lightly dimmed map - the map stays visible and in context. One animation model on the UI thread: a
 * progress value (0 hidden, 1 shown) springs in, the card follows the finger when dragged by its header, and every close
 * (drag, overlay, X, back) animates out first and only then unmounts, so nothing ever jumps. Several signals of one place or cluster sit side
 * by side (swipe, or ‹ ›). The card fills itself from GET /api/posts/{id}; a card seen for a second is counted as a
 * view (sent every 10 s, never for your own).
 */
export function SignalCardModal({ auth, refresh, cards: initialCards, initialIndex = 0, place, deviceOrigin, onClose, onOpenPlace, onOpenAuthor, onConfirm, onChanged, onDeleted, onCreateSignal, loading = false }: Props) {
  const { t } = useTranslation(['signal', 'common']);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = screenWidth - CARD_MARGIN * 2;
  const maxHeight = Math.min(screenHeight * 0.8, screenHeight - insets.top - 24);
  const [cards, setCards] = useState(initialCards);
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, initialCards.length - 1)));
  const [topComments, setTopComments] = useState<Record<string, TopComment>>({});
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [thread, setThread] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ items: CardSignal['media']; start: number } | null>(null);
  const [report, setReport] = useState<{ kind: 'signal' | 'user'; card: CardSignal } | null>(null);
  const [share, setShare] = useState<SignalShare | null>(null);
  const [saved, setSaved] = useState(false);
  const listRef = useRef<FlatList<CardSignal>>(null);
  const inFlight = useRef(new Set<string>());
  const session = useRef({ auth, refresh });
  session.current = { auth, refresh };
  const pendingViews = useRef(new Set<string>());
  const seenViews = useRef(new Set<string>());
  const current = cards[index] ?? null;

  useEffect(() => { setCards(initialCards); }, [initialCards]);

  // Fill the current card and its neighbours from the server (author, counts, trust, media sizes, top comment).
  useEffect(() => {
    const controller = new AbortController();
    for (const i of [index, index + 1, index - 1]) {
      const card = cards[i];
      if (!card || card.complete || inFlight.current.has(card.postId)) continue;
      inFlight.current.add(card.postId);
      getSignalDetail(auth, card.postId, controller.signal, refresh)
        .then((dto) => setCards((list) => list.map((c) => (c.postId === card.postId ? withDetail(c, dto) : c))))
        .catch(() => { /* the card keeps what it already shows */ })
        .finally(() => inFlight.current.delete(card.postId));
      getPostComments(auth, card.postId, 1, 'newest', controller.signal, refresh)
        .then((page) => {
          const first = page.items[0];
          setTopComments((all) => ({ ...all, [card.postId]: first ? { authorName: first.authorName, text: first.text } : null }));
        })
        .catch(() => {});
    }
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, cards.length]);

  // Views (C12): a card on screen for a second counts once; sent in batches, and on close.
  useEffect(() => {
    if (!current || current.isMine || seenViews.current.has(current.postId)) return undefined;
    const timer = setTimeout(() => { seenViews.current.add(current.postId); pendingViews.current.add(current.postId); }, VIEW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [current]);
  const flushViews = useCallback(() => {
    const ids = [...pendingViews.current];
    pendingViews.current.clear();
    if (ids.length) void recordPostViews(session.current.auth, ids, session.current.refresh).catch(() => {});
  }, []);
  useEffect(() => {
    const timer = setInterval(flushViews, VIEW_FLUSH_MS);
    return () => { clearInterval(timer); flushViews(); };
  }, [flushViews]);

  useEffect(() => {
    if (!place) return;
    let alive = true;
    isPlaceSaved(auth.userId, place.id).then((value) => { if (alive) setSaved(value); }).catch(() => {});
    return () => { alive = false; };
  }, [auth.userId, place]);

  // --- presentation: one progress value + the drag offset, both on the UI thread ---
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const closing = useRef(false);
  useEffect(() => {
    progress.value = reduceMotion ? withTiming(1, { duration: 160 }) : withSpring(1, springs.sheet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const finishClose = useCallback(() => onClose(), [onClose]);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    progress.value = withTiming(0, { duration: reduceMotion ? 120 : 220, easing: Easing.bezier(0.4, 0, 1, 1) }, (done) => { if (done) runOnJS(finishClose)(); });
  }, [finishClose, progress, reduceMotion]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (viewer) setViewer(null); else close();
      return true;
    });
    return () => back.remove();
  }, [close, viewer]);

  // Drag the card by its header: it follows the finger (with resistance upwards), a firm pull or flick closes it.
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-16, 16])
    .onUpdate((e) => { drag.value = e.translationY > 0 ? e.translationY : e.translationY / 6; })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) runOnJS(close)();
      else drag.value = withSpring(0, springs.sheet);
    }), [close, drag]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25, 1], [0, 1, 1]),
    transform: [
      { translateY: (1 - progress.value) * (maxHeight * 0.6 + 80) + drag.value },
      { scale: interpolate(progress.value, [0, 1], [0.97, 1]) },
    ],
  }), [maxHeight, progress, drag]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * interpolate(drag.value, [0, 400], [1, 0.3], 'clamp') }), [progress, drag]);

  const update = (postId: string, change: (card: CardSignal) => CardSignal) => setCards((list) => list.map((c) => (c.postId === postId ? change(c) : c)));

  const like = async (card: CardSignal, onlyOn = false) => {
    if (card.isMine || (onlyOn && card.liked)) return;
    const next = !card.liked;
    update(card.postId, (c) => ({ ...c, liked: next, likeCount: Math.max(0, c.likeCount + (next ? 1 : -1)) }));
    void Haptics.selectionAsync().catch(() => {});
    try {
      const liked = await togglePostLike(auth, card.postId, refresh);
      if (liked !== next) update(card.postId, (c) => ({ ...c, liked, likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1) - (next ? 1 : -1)) }));
    } catch {
      update(card.postId, (c) => ({ ...c, liked: !next, likeCount: Math.max(0, c.likeCount + (next ? -1 : 1)) }));
    }
  };

  const verify = async (card: CardSignal, mode: 'confirm' | 'changed') => {
    if (mode === 'changed') { onChanged(card); return; }
    setVerifyBusy(true);
    setConfirmed((set) => new Set(set).add(card.postId));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await onConfirm(card);
      setNotice(t('signal:card.confirmSent'));
    } catch (err) {
      setConfirmed((set) => { const next = new Set(set); next.delete(card.postId); return next; });
      setNotice(err instanceof Error && err.message ? err.message : t('signal:card.confirmFailed'));
    } finally {
      setVerifyBusy(false);
    }
  };

  const toggleSave = async () => {
    if (!place) return;
    const next = !saved;
    setSaved(next);
    try { if (next) await savePlace(auth.userId, place); else await unsavePlace(auth.userId, place.id); } catch { setSaved(!next); }
  };

  const go = (step: number) => {
    const next = stepIndex(index, step, cards.length);
    if (next === index) return;
    setIndex(next);
    listRef.current?.scrollToIndex({ animated: true, index: next });
  };
  const onPageEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, cardWidth)));

  const block = async (card: CardSignal) => {
    if (!card.authorId) return;
    setMenuOpen(false);
    try { await blockUser(auth, card.authorId, refresh); close(); } catch { setNotice(t('signal:card.actionFailed')); }
  };
  const remove = async (card: CardSignal) => {
    setMenuOpen(false);
    setConfirmDelete(false);
    try { await deleteSignal(auth, card.postId, refresh); onDeleted(card.postId); close(); } catch { setNotice(t('signal:card.actionFailed')); }
  };

  const distanceTo = (card: CardSignal) => {
    const lat = card.latitude ?? place?.latitude; const lon = card.longitude ?? place?.longitude;
    if (!deviceOrigin || lat === null || lat === undefined || lon === null || lon === undefined) return null;
    return distanceMeters(deviceOrigin, { latitude: lat, longitude: lon });
  };

  return (
    <View style={styles.host} testID="signal-card-modal">
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable accessibilityLabel={t('signal:card.close')} onPress={close} style={[StyleSheet.absoluteFill, styles.scrim]} testID="card-backdrop" />
      </Animated.View>

      {notice ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={[styles.noticeWrap, { top: insets.top + spacing.md }]}>
          <AnimatedPressable accessibilityRole="alert" onPress={() => setNotice(null)} style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </AnimatedPressable>
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.card, { bottom: insets.bottom + CARD_MARGIN, left: CARD_MARGIN, maxHeight, right: CARD_MARGIN }, cardStyle]}>
        <GestureDetector gesture={pan}>
          <View collapsable={false} style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              {place ? (
                <AnimatedPressable accessibilityRole="button" disabled={!onOpenPlace} onPress={onOpenPlace} pressScale={0.98} style={styles.placeStrip} testID="card-place-strip">
                  <View style={styles.placeTile}><PlaceSymbol category={place.category} color={colors.text} size={18} /></View>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.stripName}>{place.name}</Text>
                    <Text numberOfLines={1} style={styles.stripMeta}>{[formatCategory(place.category), cards.length ? t('common:stats.signals', { count: cards.length }) : null, current ? formatDistance(distanceTo(current)) : null].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {onOpenPlace ? <ChevronRight color={colors.textSecondary} size={18} /> : null}
                </AnimatedPressable>
              ) : <View style={styles.flex} />}
              {cards.length > 1 ? (
                <View style={styles.pager} testID="card-pager">
                  <AnimatedPressable accessibilityLabel={t('signal:card.prev')} accessibilityRole="button" disabled={index === 0} hitSlop={6} onPress={() => go(-1)} style={[styles.pagerButton, index === 0 && styles.dim]}>
                    <ChevronLeft color={colors.text} size={18} />
                  </AnimatedPressable>
                  <Text style={styles.pagerText}>{t('signal:card.position', { index: index + 1, count: cards.length })}</Text>
                  <AnimatedPressable accessibilityLabel={t('signal:card.next')} accessibilityRole="button" disabled={index === cards.length - 1} hitSlop={6} onPress={() => go(1)} style={[styles.pagerButton, index === cards.length - 1 && styles.dim]}>
                    <ChevronRight color={colors.text} size={18} />
                  </AnimatedPressable>
                </View>
              ) : null}
              <AnimatedPressable accessibilityLabel={t('signal:card.close')} accessibilityRole="button" hitSlop={8} onPress={close} pressScale={0.9} style={styles.close} testID="card-close">
                <X color={colors.text} size={18} strokeWidth={2.4} />
              </AnimatedPressable>
            </View>
          </View>
        </GestureDetector>

        {cards.length === 0 && loading ? (
          <View style={styles.empty} testID="card-loading"><ActivityIndicator color={colors.primary} /></View>
        ) : cards.length === 0 ? (
          <View style={styles.empty} testID="card-empty">
            <Text style={styles.emptyTitle}>{t('signal:card.noSignals')}</Text>
            <Text style={styles.emptyBody}>{t('signal:card.noSignalsHint')}</Text>
            {onCreateSignal ? <BlinkrButton label={t('signal:card.firstSignal')} onPress={onCreateSignal} /> : null}
          </View>
        ) : (
          <FlatList
            data={cards}
            getItemLayout={(_, i) => ({ index: i, length: cardWidth, offset: cardWidth * i })}
            horizontal
            initialScrollIndex={index}
            keyExtractor={(card) => card.postId}
            onMomentumScrollEnd={onPageEnd}
            pagingEnabled
            ref={listRef}
            renderItem={({ item }) => {
              const recheck = recheckSignal({ signalType: item.signalType, signalValue: item.signalValue, freshness: 'FRESH', expiresAtUtc: item.expiresAtUtc });
              return (
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: maxHeight - HEADER_HEIGHT, width: cardWidth }}>
                  <SignalCard
                    card={item}
                    confirmed={confirmed.has(item.postId)}
                    distanceMeters={distanceTo(item)}
                    onDoubleTapLike={() => { void like(item, true); }}
                    onLike={() => { void like(item); }}
                    onMenu={() => setMenuOpen(true)}
                    onOpenAuthor={() => { if (item.authorId) onOpenAuthor({ id: item.authorId, userName: item.authorName ?? '' }); }}
                    onOpenMedia={(start) => setViewer({ items: item.media, start })}
                    onOpenPlace={item.placeId && onOpenPlace ? onOpenPlace : undefined}
                    onOpenThread={() => setThread(item.postId)}
                    onSave={place ? () => { void toggleSave(); } : undefined}
                    onShare={() => setShare({ postId: item.postId, signalType: item.signalType, signalValue: item.signalValue, title: item.text.slice(0, 80), locationName: item.placeName })}
                    onVerify={(mode) => { void verify(item, mode); }}
                    saved={saved}
                    showVerify={Boolean(item.placeId && recheck)}
                    topComment={topComments[item.postId] ?? null}
                    verify={verifyState(item, distanceTo(item))}
                    verifyBusy={verifyBusy}
                    hidePlace={Boolean(place)}
                    width={cardWidth}
                  />
                </ScrollView>
              );
            }}
            scrollEnabled={cards.length > 1}
            showsHorizontalScrollIndicator={false}
          />
        )}
      </Animated.View>

      {menuOpen && current ? (
        <Sheet onClose={() => { setMenuOpen(false); setConfirmDelete(false); }}>
          <BlinkrSheetPanel>
            <View style={styles.menu} testID="card-menu-sheet">
              <MenuRow icon={<Flag color={colors.text} size={20} />} label={t('signal:card.report')} onPress={() => { setMenuOpen(false); setReport({ kind: 'signal', card: current }); }} />
              {current.authorId && !current.isMine ? (
                <>
                  <MenuRow icon={<Flag color={colors.text} size={20} />} label={t('signal:card.reportUser')} onPress={() => { setMenuOpen(false); setReport({ kind: 'user', card: current }); }} />
                  <MenuRow icon={<UserX color={colors.danger} size={20} />} label={t('signal:card.block')} onPress={() => { void block(current); }} tone={colors.danger} />
                </>
              ) : null}
              {current.isMine ? (
                confirmDelete
                  ? <MenuRow icon={<Trash2 color={colors.danger} size={20} />} label={t('signal:card.deleteConfirm')} onPress={() => { void remove(current); }} tone={colors.danger} />
                  : <MenuRow icon={<Trash2 color={colors.danger} size={20} />} label={t('signal:card.delete')} onPress={() => setConfirmDelete(true)} tone={colors.danger} />
              ) : null}
            </View>
          </BlinkrSheetPanel>
        </Sheet>
      ) : null}

      {report ? (
        <Sheet onClose={() => setReport(null)}>
          <BlinkrSheetPanel maxHeightRatio={0.9}>
            <ReportPanel
              onDone={() => setReport(null)}
              onSubmit={async (reason: ReportReasonId, note: string) => {
                const targetId = report.kind === 'user' ? report.card.authorId ?? '' : report.card.postId;
                await sendReport(auth, { targetType: report.kind, targetId, reason, note }, refresh);
              }}
              subject={report.kind === 'user' ? report.card.authorName ?? '' : report.card.placeName ?? t('signal:card.signal')}
              target={report.kind}
            />
          </BlinkrSheetPanel>
        </Sheet>
      ) : null}

      {thread ? (
        <Sheet onClose={() => setThread(null)}>
          <BlinkrSheetPanel maxHeightRatio={0.92}>
            <SignalThreadPanel auth={auth} header={null} onClose={() => setThread(null)} postId={thread} refresh={refresh} />
          </BlinkrSheetPanel>
        </Sheet>
      ) : null}

      {share ? <ShareToChatSheet auth={auth} onClose={() => setShare(null)} refresh={refresh} share={share} /> : null}
      {viewer ? <MediaViewer items={viewer.items} onClose={() => setViewer(null)} startIndex={viewer.start} /> : null}
    </View>
  );
}

function MenuRow({ icon, label, onPress, tone }: { icon: React.ReactNode; label: string; onPress: () => void; tone?: string }) {
  return (
    <AnimatedPressable accessibilityRole="button" onPress={onPress} style={styles.menuRow}>
      {icon}
      <Text style={[styles.menuText, tone ? { color: tone } : null]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, zIndex: 120 },
  scrim: { backgroundColor: colors.scrimSoft },
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, overflow: 'hidden', position: 'absolute', ...shadowFloat },
  header: { minHeight: HEADER_HEIGHT, paddingBottom: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  handle: { alignSelf: 'center', backgroundColor: colors.lineStrong, borderRadius: radii.pill, height: 5, marginBottom: spacing.sm, width: 36 },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  placeStrip: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  placeTile: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.md, height: 40, justifyContent: 'center', width: 40 },
  stripName: { ...typography.heading, color: colors.text },
  stripMeta: { ...typography.caption, color: colors.textSecondary },
  close: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 34, justifyContent: 'center', width: 34 },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  pager: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flexDirection: 'row', height: 34, paddingHorizontal: 2 },
  pagerButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 30 },
  pagerText: { ...typography.caption, color: colors.text, fontWeight: '700', minWidth: 34, textAlign: 'center' },
  dim: { opacity: 0.3 },
  noticeWrap: { left: spacing.lg, position: 'absolute', right: spacing.lg, zIndex: 2 },
  notice: { backgroundColor: colors.text, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, ...shadowFloat },
  noticeText: { ...typography.callout, color: colors.background, textAlign: 'center' },
  menu: { gap: spacing.xs },
  menuRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.sm },
  menuText: { ...typography.bodyStrong, color: colors.text },
});
