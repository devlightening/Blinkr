import * as Location from 'expo-location';
import { Bell, ChevronLeft, Compass, Hash, MapPin, Users, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiCodeError, getDiscoverFollowing, getDiscoverNearby, getHashtagFeed, getPlace, getUnreadNotificationCount, postStory, recordPostViews, setPostReaction } from '../../api';
import { chooseReaction, HEART, reactionFields, reactionStateOf, tapHeart } from '../../reactions';
import { useRealtimeEvent } from '../../useRealtime';
import { NotificationsScreen } from '../notifications/NotificationsScreen';
import { AnimatedPressable } from '../AnimatedPressable';
import { DEFAULT_STORY_SECONDS, type StoryTrayItem } from '../../stories';
import { SignalCamera } from '../camera/SignalCamera';
import { StoryTray } from '../stories/StoryTray';
import { StoryViewer } from '../stories/StoryViewer';
import { LOCATION_TIMEOUT, resolveDeviceOrigin, type Origin } from '../../deviceOrigin';
import { canLoadMore, mergeDiscoverPage, type DiscoverItem, type DiscoverPage, type DiscoverTab } from '../../discoverFeed';
import { engagementErrorKey } from '../../engagement';
import * as haptics from '../../haptics';
import { colors, spacing, typography } from '../../theme';
import type { AuthResponse, BlinkrPlace, CoordinateSignal, UserSummary } from '../../types';
import { NearbyScreen } from '../NearbyScreen';
import { Sheet } from '../Sheet';
import { UserProfileSheet } from '../friends/UserProfileSheet';
import { SignalThreadPanel } from '../signal/SignalThreadPanel';
import { bottomBarClearance } from '../ui/BlinkrBottomBar';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { SegmentedControl } from '../ui/BlinkrSegmentedControl';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { SkeletonList } from '../ui/BlinkrSkeleton';
import { FeedCard } from './FeedCard';
import { HashtagSearch } from './HashtagSearch';
import { ShareToChatSheet } from '../chat/ShareToChatSheet';
import { signalShareOf, type SignalShare } from '../../chatExtras';

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onLogout: () => void;
  onOpenPlace: (place: BlinkrPlace) => void;
  onOpenSignal: (signal: CoordinateSignal) => void;
  onCreateSignal?: () => void;
  onMessageUser?: (user: UserSummary) => void;
  /** Tells the app shell a sheet is open (the bottom bar hides). */
  onOverlayOpenChange?: (open: boolean) => void;
  /** V2-4: a #tag tapped elsewhere (the signal card on the map) opens its feed here once. */
  hashtagRequest?: string | null;
  onHashtagHandled?: () => void;
};

type Which = 'nearby' | 'following' | 'hashtag';

/** V2-6: a card seen this long counts as a view (sent in batches every 10 s, never for my own). */
const VIEW_AFTER_MS = 1000;
const VIEW_FLUSH_MS = 10_000;
const VISIBLE = { itemVisiblePercentThreshold: 60, minimumViewTime: 150 };

type LocationPhase = 'checking' | 'needsPermission' | 'blocked' | 'locating' | 'ready';
type FeedState = { items: DiscoverItem[]; page: DiscoverPage | null; loading: boolean; error: string | null; notice: string | null };
const emptyFeed: FeedState = { items: [], page: null, loading: false, error: null, notice: null };

/**
 * Keşfet (sinyal-mvp-plan Faz 7 P7.2-P7.4). "Yakınımda": ranked live signals within 3 km. "Takip": what the people I
 * follow shared this week. "Yerler": the place-status list that used to be this tab (the decision aid stays). Pull to
 * refresh, paged scrolling with an end, a failed refresh keeps the last list (kök CLAUDE.md §16). Location is asked
 * only when the person chooses to use it here.
 */
export function DiscoverScreen({ auth, onAuthChange, onLogout, onOpenPlace, onOpenSignal, onCreateSignal, onMessageUser, onOverlayOpenChange, hashtagRequest, onHashtagHandled }: Props) {
  const { t } = useTranslation(['feed', 'errors', 'common']);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<DiscoverTab>('nearby');
  const [phase, setPhase] = useState<LocationPhase>('checking');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [feeds, setFeeds] = useState<Record<Which, FeedState>>({ nearby: emptyFeed, following: emptyFeed, hashtag: emptyFeed });
  /** V2-4: the tag whose feed is shown instead of the tabs (null = the tabs). */
  const [hashtag, setHashtag] = useState<string | null>(null);
  const hashtagRef = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [thread, setThread] = useState<DiscoverItem | null>(null);
  const [person, setPerson] = useState<UserSummary | null>(null);
  const [storyView, setStoryView] = useState<{ authors: StoryTrayItem[]; start: string } | null>(null);
  const [storyCamera, setStoryCamera] = useState(false);
  const [trayKey, setTrayKey] = useState(0);
  const [storyNotice, setStoryNotice] = useState<string | null>(null);
  const [sharing, setSharing] = useState<SignalShare | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const requests = useRef<Record<string, AbortController | undefined>>({});
  const likeBusy = useRef(new Set<string>());
  const refresh = useRef({ onAuthRefresh: onAuthChange, onSessionExpired: onLogout });
  refresh.current = { onAuthRefresh: onAuthChange, onSessionExpired: onLogout };

  useEffect(() => {
    onOverlayOpenChange?.(Boolean(thread || person || storyView || storyCamera || sharing || notificationsOpen));
  }, [thread, person, storyView, storyCamera, sharing, notificationsOpen, onOverlayOpenChange]);

  // The bell's dot: checked on open and now and then while Keşfet is on screen (no push yet, D-012).
  useEffect(() => {
    if (notificationsOpen) return undefined;
    let cancelled = false;
    const check = () => { getUnreadNotificationCount(auth, undefined, refresh.current).then((count) => { if (!cancelled) setUnread(count); }).catch(() => {}); };
    check();
    const timer = setInterval(check, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [auth, notificationsOpen]);
  useEffect(() => () => { Object.values(requests.current).forEach((c) => c?.abort()); onOverlayOpenChange?.(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // V2-5 (D-028): a new notification lights the bell at once (the minute poll stays as the safety net).
  useRealtimeEvent('notification.created', () => {
    if (notificationsOpen) return;
    getUnreadNotificationCount(auth, undefined, refresh.current).then(setUnread).catch(() => {});
  });

  const patch = (which: Which, next: Partial<FeedState>) =>
    setFeeds((current) => ({ ...current, [which]: { ...current[which], ...next } }));

  const load = useCallback(async (which: Which, page: number, at: Origin | null) => {
    if (which === 'nearby' && !at) return;
    requests.current[which]?.abort();
    const controller = new AbortController();
    requests.current[which] = controller;
    patch(which, { loading: true, error: null });
    try {
      const result = which === 'nearby'
        ? await getDiscoverNearby(auth, at!.latitude, at!.longitude, page, controller.signal, refresh.current)
        : which === 'hashtag'
          ? await getHashtagFeed(auth, hashtagRef.current ?? '', page, controller.signal, refresh.current)
          : await getDiscoverFollowing(auth, page, controller.signal, refresh.current);
      if (controller.signal.aborted) return;
      setFeeds((current) => ({ ...current, [which]: { ...current[which], items: mergeDiscoverPage(current[which].items, result), page: result, loading: false, error: null, notice: null } }));
    } catch {
      if (controller.signal.aborted) return;
      // Stale-while-revalidate: with something already shown, a failure is a quiet notice, not an empty screen.
      setFeeds((current) => {
        const had = current[which].items.length > 0;
        return { ...current, [which]: { ...current[which], loading: false, error: had ? null : t('discover.loadFailed'), notice: had ? t('discover.staleNotice') : null } };
      });
    } finally {
      if (requests.current[which] === controller) setRefreshing(false);
    }
  }, [auth, t]);

  const locate = useCallback(async (ask: boolean) => {
    try {
      const permission = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      if (!permission.granted) { setPhase(permission.canAskAgain === false ? 'blocked' : 'needsPermission'); return; }
      setPhase('locating');
      const at = await resolveDeviceOrigin();
      setOrigin(at);
      setPhase('ready');
      void load('nearby', 1, at);
    } catch (err) {
      setPhase('ready');
      patch('nearby', { error: err instanceof Error && err.message === LOCATION_TIMEOUT ? t('discover.locationTimeout') : t('discover.loadFailed') });
    }
  }, [load, t]);

  useEffect(() => { void locate(false); }, [locate]);
  useEffect(() => { if (tab === 'following' && !feeds.following.page && !feeds.following.loading) void load('following', 1, null); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const openHashtag = useCallback((tag: string) => {
    hashtagRef.current = tag;
    setHashtag(tag);
    setThread(null);
    setFeeds((current) => ({ ...current, hashtag: emptyFeed }));
    void load('hashtag', 1, null);
  }, [load]);
  const closeHashtag = () => { requests.current.hashtag?.abort(); hashtagRef.current = null; setHashtag(null); };

  useEffect(() => {
    if (!hashtagRequest) return;
    openHashtag(hashtagRequest);
    onHashtagHandled?.();
  }, [hashtagRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const current: Which = hashtag ? 'hashtag' : tab === 'following' ? 'following' : 'nearby';

  // V2-6: only the most visible card plays its video; a card on screen for a second counts as a view.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const visibleSince = useRef(new Map<string, number>());
  const pendingViews = useRef(new Set<string>());
  const countedViews = useRef(new Set<string>());
  const authRef = useRef(auth);
  authRef.current = auth;
  const onViewable = useRef(({ viewableItems }: { viewableItems: Array<{ item: DiscoverItem; isViewable: boolean }> }) => {
    const now = Date.now();
    const shown = viewableItems.filter((v) => v.isViewable).map((v) => v.item);
    setPlayingId(shown.find((item) => item.media.some((m) => m.type === 'Video'))?.id ?? null);
    const ids = new Set(shown.map((item) => item.id));
    for (const [id, since] of visibleSince.current) {
      if (!ids.has(id)) {
        if (now - since >= VIEW_AFTER_MS && !countedViews.current.has(id)) { countedViews.current.add(id); pendingViews.current.add(id); }
        visibleSince.current.delete(id);
      }
    }
    for (const item of shown) if (!visibleSince.current.has(item.id) && item.authorId !== authRef.current.userId) visibleSince.current.set(item.id, now);
  }).current;
  useEffect(() => {
    const flush = () => {
      const now = Date.now();
      for (const [id, since] of visibleSince.current) if (now - since >= VIEW_AFTER_MS && !countedViews.current.has(id)) { countedViews.current.add(id); pendingViews.current.add(id); }
      const ids = [...pendingViews.current];
      pendingViews.current.clear();
      if (ids.length) void recordPostViews(authRef.current, ids, refresh.current).catch(() => {});
    };
    const timer = setInterval(flush, VIEW_FLUSH_MS);
    return () => { clearInterval(timer); flush(); };
  }, []);

  /** V2-4 (D-027): a tap is the heart (or takes my reaction back); a picked emoji sets or replaces it. Optimistic. */
  const react = async (item: DiscoverItem, pick: string | null | undefined) => {
    if (likeBusy.current.has(item.id)) return;
    likeBusy.current.add(item.id);
    const which = current;
    const before = reactionStateOf(item);
    const after = pick === undefined ? tapHeart(before) : chooseReaction(before, pick);
    const put = (fields: ReturnType<typeof reactionFields>) => setFeeds((all) => ({ ...all, [which]: { ...all[which], items: all[which].items.map((x) => (x.id === item.id ? { ...x, ...fields } : x)) } }));
    put(reactionFields(after));
    haptics.tap();
    try {
      const answer = await setPostReaction(auth, item.id, after.mine, refresh.current);
      put(reactionFields({ mine: answer.reaction, counts: answer.counts }));
    } catch (err) {
      put(reactionFields(before));
      patch(which, { notice: err instanceof ApiCodeError && err.code !== 'UNKNOWN' ? t(engagementErrorKey(err.code)) : t('errors:engagement.likeFailed') });
    } finally {
      likeBusy.current.delete(item.id);
    }
  };

  const showOnMap = async (item: DiscoverItem) => {
    if (!item.placeId) return;
    try { onOpenPlace(await getPlace(item.placeId)); } catch { patch(current, { notice: t('discover.loadFailed') }); }
  };

  const header = hashtag ? (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.tagRow}>
        <AnimatedPressable accessibilityLabel={t('discover.hashtagBack')} accessibilityRole="button" hitSlop={8} onPress={closeHashtag} pressScale={0.9} style={styles.bell} testID="hashtag-back">
          <ChevronLeft color={colors.text} size={24} />
        </AnimatedPressable>
        <Hash color={colors.primary} size={22} />
        <Text accessibilityRole="header" numberOfLines={1} style={styles.tagTitle}>{hashtag}</Text>
      </View>
      <Text style={styles.subtitle}>{t('discover.hashtagSubtitle')}</Text>
    </View>
  ) : (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={styles.title}>{t('discover.title')}</Text>
        <AnimatedPressable
          accessibilityLabel={unread > 0 ? t('common:notifications.openUnread', { count: unread }) : t('common:notifications.open')}
          accessibilityRole="button"
          onPress={() => setNotificationsOpen(true)}
          pressScale={0.9}
          style={styles.bell}
          testID="notifications-bell"
        >
          <Bell color={colors.text} size={22} />
          {unread > 0 ? <View style={styles.bellDot} /> : null}
        </AnimatedPressable>
      </View>
      <SegmentedControl
        accessibilityLabel={t('discover.title')}
        onChange={setTab}
        options={[{ value: 'nearby', label: t('discover.tabNearby') }, { value: 'following', label: t('discover.tabFollowing') }, { value: 'places', label: t('discover.tabPlaces') }, { value: 'tags', label: '#', accessibilityLabel: t('hashtags.tab') }]}
        value={tab}
      />
      {tab !== 'places' && tab !== 'tags' ? <StoryTray auth={auth} onAdd={() => setStoryCamera(true)} onOpen={(item, all) => setStoryView({ authors: all, start: item.authorId })} refresh={refresh.current} reloadKey={trayKey} /> : null}
      {storyNotice ? <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{storyNotice}</Text> : null}
      <Text style={styles.subtitle}>{tab === 'nearby' ? t('discover.subtitleNearby') : tab === 'following' ? t('discover.subtitleFollowing') : tab === 'tags' ? t('hashtags.subtitle') : t('discover.subtitlePlaces')}</Text>
    </View>
  );

  const renderFeed = (which: Which) => {
    const feed = feeds[which];
    if (which === 'nearby' && (phase === 'needsPermission' || phase === 'blocked')) {
      return (
        <View style={styles.center}>
          <BlinkrEmptyState
            action={phase === 'blocked' ? { label: t('discover.openSettings'), onPress: () => { void Linking.openSettings(); } } : { label: t('discover.useLocation'), onPress: () => { void locate(true); } }}
            description={phase === 'blocked' ? t('discover.blockedBody') : t('discover.needLocationBody')}
            icon={<MapPin color={colors.textSecondary} size={34} />}
            title={t('discover.needLocationTitle')}
          />
        </View>
      );
    }
    if ((which === 'nearby' && (phase === 'checking' || phase === 'locating')) || (feed.loading && feed.items.length === 0)) {
      return (
        <View style={styles.loadingBlock}>
          {phase === 'locating' ? <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{t('discover.locating')}</Text> : null}
          <SkeletonList rows={3} variant="card" />
        </View>
      );
    }
    if (feed.error && feed.items.length === 0) {
      return (
        <View style={styles.center}>
          <BlinkrEmptyState
            action={{ label: t('discover.retry'), onPress: () => { if (which === 'nearby' && !origin) void locate(false); else void load(which, 1, origin); } }}
            description={feed.error}
            icon={<WifiOff color={colors.textSecondary} size={32} />}
            title={t('discover.loadFailed')}
          />
        </View>
      );
    }
    return (
      <FlatList
        ListEmptyComponent={
          <BlinkrEmptyState
            action={which === 'nearby' && onCreateSignal ? { label: t('discover.share'), onPress: onCreateSignal } : undefined}
            description={which === 'nearby' ? t('discover.emptyNearbyBody') : which === 'hashtag' ? t('discover.emptyHashtagBody') : t('discover.emptyFollowingBody')}
            icon={which === 'nearby' ? <Compass color={colors.textSecondary} size={34} /> : which === 'hashtag' ? <Hash color={colors.textSecondary} size={34} /> : <Users color={colors.textSecondary} size={34} />}
            style={styles.empty}
            title={which === 'nearby' ? t('discover.emptyNearbyTitle') : which === 'hashtag' ? t('discover.emptyHashtagTitle', { tag: hashtag ?? '' }) : t('discover.emptyFollowingTitle')}
          />
        }
        ListFooterComponent={
          feed.loading ? <ActivityIndicator color={colors.primary} style={styles.footer} />
            : feed.items.length > 0 && !canLoadMore(feed.page) ? <Text style={styles.end}>{t('discover.end')}</Text> : null
        }
        ListHeaderComponent={feed.notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{feed.notice}</Text> : null}
        contentContainerStyle={[styles.list, { paddingBottom: bottomBarClearance(insets.bottom) + spacing.lg }]}
        data={feed.items}
        keyExtractor={(item) => item.id}
        onEndReached={() => { if (!feed.loading && canLoadMore(feed.page)) void load(which, (feed.page?.page ?? 1) + 1, origin); }}
        onEndReachedThreshold={0.5}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VISIBLE}
        initialNumToRender={3}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); if (which === 'nearby') void locate(false); else void load(which, 1, null); }} refreshing={refreshing} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <FeedCard
            item={item}
            myUserId={auth.userId}
            onDoubleTap={(target) => { if (!reactionStateOf(target).mine) void react(target, HEART); }}
            onHashtag={openHashtag}
            onLike={(target) => { void react(target, undefined); }}
            playing={playingId === item.id}
            onMention={(m) => setPerson({ id: m.userId, userName: m.userName })}
            onOpenAuthor={(target) => { if (target.authorId) setPerson({ id: target.authorId, userName: target.authorName }); }}
            onReact={(target, reaction) => { void react(target, reaction); }}
            onOpenThread={setThread}
            onShare={(target) => setSharing(signalShareOf(target))}
            onShowOnMap={(target) => { void showOnMap(target); }}
          />
        )}
      />
    );
  };

  return (
    <View style={styles.screen}>
      {header}
      {tab === 'places' && !hashtag
        ? <NearbyScreen embedded onCreateSignal={onCreateSignal} onOpenPlace={onOpenPlace} onOpenSignal={onOpenSignal} />
        : tab === 'tags' && !hashtag
          ? <HashtagSearch auth={auth} bottomPadding={bottomBarClearance(insets.bottom) + spacing.lg} onOpen={openHashtag} refresh={refresh.current} />
          : renderFeed(current)}

      {thread ? (
        <Sheet onClose={() => setThread(null)}>
          <BlinkrSheetPanel maxHeightRatio={0.92}>
            <SignalThreadPanel
              auth={auth}
              header={<FeedCard hideActions item={thread} myUserId={auth.userId} onHashtag={openHashtag} onLike={() => {}} onMention={(m) => { setThread(null); setPerson({ id: m.userId, userName: m.userName }); }} onOpenThread={() => {}} />}
              onClose={() => setThread(null)}
              onHashtag={openHashtag}
              onMention={(m) => { setThread(null); setPerson({ id: m.userId, userName: m.userName }); }}
              postId={thread.id}
              refresh={refresh.current}
            />
          </BlinkrSheetPanel>
        </Sheet>
      ) : null}
      {notificationsOpen ? <NotificationsScreen auth={auth} onAuthChange={onAuthChange} onBack={() => { setNotificationsOpen(false); setUnread(0); }} onLogout={onLogout} onMessageUser={onMessageUser} /> : null}
      {sharing ? <ShareToChatSheet auth={auth} onClose={() => setSharing(null)} refresh={refresh.current} share={sharing} /> : null}
      {storyView ? (
        <StoryViewer auth={auth} authors={storyView.authors} onClose={() => { setStoryView(null); setTrayKey((k) => k + 1); }} refresh={refresh.current} startAuthorId={storyView.start} />
      ) : null}
      {storyCamera ? (
        <View style={styles.cameraLayer}>
          <SignalCamera
            onCapture={(asset) => {
              setStoryCamera(false);
              setStoryNotice(t('stories.posting'));
              postStory(auth, asset, { durationSeconds: DEFAULT_STORY_SECONDS }, refresh.current)
                .then(() => { setStoryNotice(t('stories.posted')); setTrayKey((k) => k + 1); })
                .catch(() => setStoryNotice(t('stories.postFailed')));
            }}
            onClose={() => setStoryCamera(false)}
            submitLabel={t('stories.share')}
          />
        </View>
      ) : null}
      {person ? (
        <UserProfileSheet
          auth={auth}
          onAuthChange={onAuthChange}
          onClose={() => setPerson(null)}
          onMessage={(user) => { setPerson(null); onMessageUser?.(user); }}
          onSessionExpired={onLogout}
          user={person}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  cameraLayer: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 60 },
  header: { gap: spacing.sm, paddingBottom: spacing.md, paddingHorizontal: spacing.lg },
  title: { ...typography.headline, color: colors.text },
  tagRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginLeft: -spacing.sm },
  tagTitle: { ...typography.headline, color: colors.text, flexShrink: 1 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bell: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  bellDot: { backgroundColor: colors.danger, borderColor: colors.background, borderRadius: 999, borderWidth: 2, height: 12, position: 'absolute', right: 9, top: 9, width: 12 },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  loadingBlock: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  list: { gap: spacing.md, paddingHorizontal: spacing.lg },
  empty: { marginTop: spacing.xxl },
  notice: { ...typography.caption, color: colors.textSecondary, paddingBottom: spacing.sm },
  footer: { marginVertical: spacing.lg },
  end: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.lg, textAlign: 'center' },
});
