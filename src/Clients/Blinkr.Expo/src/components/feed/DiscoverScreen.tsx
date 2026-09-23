import * as Location from 'expo-location';
import { Bell, Compass, MapPin, Users, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiCodeError, getDiscoverFollowing, getDiscoverNearby, getPlace, getUnreadNotificationCount, postStory, togglePostLike } from '../../api';
import { NotificationsScreen } from '../notifications/NotificationsScreen';
import { AnimatedPressable } from '../AnimatedPressable';
import { DEFAULT_STORY_SECONDS, type StoryTrayItem } from '../../stories';
import { SignalCamera } from '../camera/SignalCamera';
import { StoryTray } from '../stories/StoryTray';
import { StoryViewer } from '../stories/StoryViewer';
import { LOCATION_TIMEOUT, resolveDeviceOrigin, type Origin } from '../../deviceOrigin';
import { canLoadMore, mergeDiscoverPage, toggleFeedLike, type DiscoverItem, type DiscoverPage, type DiscoverTab } from '../../discoverFeed';
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
};

type LocationPhase = 'checking' | 'needsPermission' | 'blocked' | 'locating' | 'ready';
type FeedState = { items: DiscoverItem[]; page: DiscoverPage | null; loading: boolean; error: string | null; notice: string | null };
const emptyFeed: FeedState = { items: [], page: null, loading: false, error: null, notice: null };

/**
 * Keşfet (sinyal-mvp-plan Faz 7 P7.2-P7.4). "Yakınımda": ranked live signals within 3 km. "Takip": what the people I
 * follow shared this week. "Yerler": the place-status list that used to be this tab (the decision aid stays). Pull to
 * refresh, paged scrolling with an end, a failed refresh keeps the last list (kök CLAUDE.md §16). Location is asked
 * only when the person chooses to use it here.
 */
export function DiscoverScreen({ auth, onAuthChange, onLogout, onOpenPlace, onOpenSignal, onCreateSignal, onMessageUser, onOverlayOpenChange }: Props) {
  const { t } = useTranslation(['feed', 'errors', 'common']);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<DiscoverTab>('nearby');
  const [phase, setPhase] = useState<LocationPhase>('checking');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [feeds, setFeeds] = useState<Record<'nearby' | 'following', FeedState>>({ nearby: emptyFeed, following: emptyFeed });
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

  const patch = (which: 'nearby' | 'following', next: Partial<FeedState>) =>
    setFeeds((current) => ({ ...current, [which]: { ...current[which], ...next } }));

  const load = useCallback(async (which: 'nearby' | 'following', page: number, at: Origin | null) => {
    if (which === 'nearby' && !at) return;
    requests.current[which]?.abort();
    const controller = new AbortController();
    requests.current[which] = controller;
    patch(which, { loading: true, error: null });
    try {
      const result = which === 'nearby'
        ? await getDiscoverNearby(auth, at!.latitude, at!.longitude, page, controller.signal, refresh.current)
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

  const like = async (item: DiscoverItem) => {
    if (likeBusy.current.has(item.id)) return;
    likeBusy.current.add(item.id);
    const which = tab === 'following' ? 'following' : 'nearby';
    const flip = () => setFeeds((current) => ({ ...current, [which]: { ...current[which], items: toggleFeedLike(current[which].items, item.id) } }));
    flip();
    haptics.tap();
    try {
      const liked = await togglePostLike(auth, item.id, refresh.current);
      if (liked === item.isLikedByCurrentUser) flip(); // the server disagrees: trust it
    } catch (err) {
      flip();
      patch(which, { notice: err instanceof ApiCodeError && err.code !== 'UNKNOWN' ? t(engagementErrorKey(err.code)) : t('errors:engagement.likeFailed') });
    } finally {
      likeBusy.current.delete(item.id);
    }
  };

  const showOnMap = async (item: DiscoverItem) => {
    if (!item.placeId) return;
    try { onOpenPlace(await getPlace(item.placeId)); } catch { patch(tab === 'following' ? 'following' : 'nearby', { notice: t('discover.loadFailed') }); }
  };

  const header = (
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
        options={[{ value: 'nearby', label: t('discover.tabNearby') }, { value: 'following', label: t('discover.tabFollowing') }, { value: 'places', label: t('discover.tabPlaces') }]}
        value={tab}
      />
      {tab !== 'places' ? <StoryTray auth={auth} onAdd={() => setStoryCamera(true)} onOpen={(item, all) => setStoryView({ authors: all, start: item.authorId })} refresh={refresh.current} reloadKey={trayKey} /> : null}
      {storyNotice ? <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{storyNotice}</Text> : null}
      <Text style={styles.subtitle}>{tab === 'nearby' ? t('discover.subtitleNearby') : tab === 'following' ? t('discover.subtitleFollowing') : t('discover.subtitlePlaces')}</Text>
    </View>
  );

  const renderFeed = (which: 'nearby' | 'following') => {
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
            description={which === 'nearby' ? t('discover.emptyNearbyBody') : t('discover.emptyFollowingBody')}
            icon={which === 'nearby' ? <Compass color={colors.textSecondary} size={34} /> : <Users color={colors.textSecondary} size={34} />}
            style={styles.empty}
            title={which === 'nearby' ? t('discover.emptyNearbyTitle') : t('discover.emptyFollowingTitle')}
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
        refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); if (which === 'nearby') void locate(false); else void load('following', 1, null); }} refreshing={refreshing} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <FeedCard
            item={item}
            myUserId={auth.userId}
            onLike={(target) => { void like(target); }}
            onOpenAuthor={(target) => { if (target.authorId) setPerson({ id: target.authorId, userName: target.authorName }); }}
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
      {tab === 'places'
        ? <NearbyScreen embedded onCreateSignal={onCreateSignal} onOpenPlace={onOpenPlace} onOpenSignal={onOpenSignal} />
        : renderFeed(tab)}

      {thread ? (
        <Sheet onClose={() => setThread(null)}>
          <BlinkrSheetPanel maxHeightRatio={0.92}>
            <SignalThreadPanel
              auth={auth}
              header={<FeedCard item={thread} myUserId={auth.userId} onLike={() => {}} onOpenThread={() => {}} />}
              onClose={() => setThread(null)}
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
