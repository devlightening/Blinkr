import { Archive, Bookmark, Camera, ChevronRight, Lock, Pencil, Radio, Settings, UserPlus, Users } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMyPosts, getMyProfile, getPlacesByIds } from '../api';
import { badgeText } from '../friends';
import { formatAge, formatCategory } from '../presentation';
import { friendlyError } from '../productPresentation';
import { listSavedPlaces, toPlace, type SavedPlace } from '../savedPlaces';
import { liveLookupIds, mergeLive, orderSavedByLive, type SavedLive } from '../savedLive';
import { fromAuthoredPost } from '../signalCard';
import { categoryTone, colors, radii, shadowSoft, sizes, spacing, typography } from '../theme';
import type { AuthoredPost, AuthResponse, BlinkrPlace, UserSummary } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { Avatar } from './Avatar';
import { AvatarPickerSheet } from './AvatarPickerSheet';
import { EditProfileSheet } from './EditProfileSheet';
import { FollowListSheet, type FollowListTab } from './friends/FollowListSheet';
import { FriendsScreen } from './friends/FriendsScreen';
import { UserProfileSheet } from './friends/UserProfileSheet';
import { PlaceSymbol } from './PlaceSymbol';
import { SignalArchiveScreen } from './SignalArchiveScreen';
import { SignalCardModal } from './signal/SignalCardModal';
import { SignalGridTile } from './SignalGridTile';
import { GRID_GAP, PROFILE_RECENT, gridTileSize } from '../profileGrid';
import { SegmentedControl } from './ui/BlinkrSegmentedControl';
import { SettingsScreen } from './SettingsScreen';
import { BlinkrButton } from './ui/BlinkrButton';
import { bottomBarClearance } from './ui/BlinkrBottomBar';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';
import { SkeletonList } from './ui/BlinkrSkeleton';
import { tx } from '../i18n/tx';
import { displayLocale } from '../i18n/locale';

const formatCount = (value: number) => value.toLocaleString(displayLocale());

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onLogout: () => void;
  /** Opens a saved Place on the map. */
  onOpenPlace: (place: BlinkrPlace) => void;
  /** Empty-state call to action; opens the camera/composer. */
  onCreateSignal?: () => void;
  /** True while a sheet (avatar picker) covers the screen, so the tab bar can step aside. */
  onOverlayOpenChange?: (open: boolean) => void;
  /** Opens a 1:1 conversation from a profile or the friends list. */
  onMessageUser?: (user: UserSummary) => void;
  /** Number of friend requests waiting for an answer (drives the dot on the Profil tab). */
  onRequestsChange?: (waiting: number) => void;
};

type ProfileTab = 'signals' | 'places';

/**
 * My profile: who I am (avatar, numbers, bio), then two tabs - my newest signals and my saved places. There is no
 * endless list: the profile shows the newest PROFILE_RECENT signals and "all signals" opens the archive, read page by
 * page (SignalArchiveScreen). A signal opens as its Sinyal Kartı. Only real data; account things (privacy, sign out)
 * live in Ayarlar.
 */
export function ProfileScreen({ auth, onAuthChange, onLogout, onOpenPlace, onCreateSignal, onOverlayOpenChange, onMessageUser, onRequestsChange }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('profile');
  const { width: screenWidth } = useWindowDimensions();
  const tileSize = gridTileSize(screenWidth, spacing.lg);
  const [tab, setTab] = useState<ProfileTab>('signals');
  const [saved, setSaved] = useState<SavedPlace[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [posts, setPosts] = useState<AuthoredPost[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [followRequests, setFollowRequests] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [followList, setFollowList] = useState<FollowListTab | null>(null);
  const [person, setPerson] = useState<UserSummary | null>(null);
  const [incoming, setIncoming] = useState(0);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [openPost, setOpenPost] = useState<AuthoredPost | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [live, setLive] = useState<Record<string, SavedLive | undefined>>({});
  const postsRequest = useRef<AbortController | null>(null);

  const loadSaved = useCallback(async () => {
    setSavedError(null);
    try {
      setSaved(await listSavedPlaces(auth.userId));
    } catch (err) {
      setSaved((current) => current ?? []);
      setSavedError(friendlyError(err, tx('profile:me.savedFailed', 'Kaydedilen yerler okunamadı.')));
    }
  }, [auth.userId]);

  // Only the newest few: the archive reads the rest page by page. A failure keeps what is shown.
  const loadPosts = useCallback(async () => {
    postsRequest.current?.abort();
    const controller = new AbortController();
    postsRequest.current = controller;
    try {
      const result = await getMyPosts(auth, 1, PROFILE_RECENT, controller.signal, onAuthChange, onLogout);
      if (controller.signal.aborted) return;
      setPosts(result.items);
      setTotal(result.total);
      setPostsError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setPosts((current) => current ?? []);
      setPostsError(friendlyError(err, tx('profile:me.postsFailed', 'Sinyallerin yüklenemedi. Tekrar dene.')));
    } finally {
      if (postsRequest.current === controller) { postsRequest.current = null; setRefreshing(false); }
    }
  }, [auth, onAuthChange, onLogout]);

  // Bio and numbers come from the account; a failure keeps what is shown (they are not worth an error banner).
  const loadProfile = useCallback(async () => {
    try {
      const mine = await getMyProfile(auth, undefined, { onAuthRefresh: onAuthChange, onSessionExpired: onLogout });
      setBio(mine.bio ?? null);
      setFollowerCount(mine.followerCount ?? 0);
      setFollowingCount(mine.followingCount ?? 0);
      setFollowRequests(mine.followRequestCount ?? 0);
      setIsPrivate(Boolean(mine.isPrivate));
      setIncoming(mine.incomingRequestCount);
      onRequestsChange?.(mine.incomingRequestCount);
    } catch { /* keep the previous numbers */ }
  }, [auth, onAuthChange, onLogout, onRequestsChange]);

  // How the saved places are doing right now. A failed lookup keeps whatever was shown; it never blanks the list.
  const loadLive = useCallback(async (places: SavedPlace[]) => {
    const ids = liveLookupIds(places);
    if (ids.length === 0) return;
    let found: BlinkrPlace[] | null = null;
    try { found = await getPlacesByIds(ids); } catch { found = null; }
    setLive((current) => mergeLive(current, found, ids));
  }, []);

  useEffect(() => { void loadSaved(); }, [loadSaved]);
  useEffect(() => { if (saved && saved.length > 0) void loadLive(saved); }, [saved, loadLive]);
  useEffect(() => { void loadProfile(); }, [auth.userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadPosts(); return () => postsRequest.current?.abort(); }, [auth.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const overlayOpen = avatarOpen || friendsOpen || editOpen || settingsOpen || archiveOpen || Boolean(openPost) || Boolean(followList) || Boolean(person);
  useEffect(() => {
    onOverlayOpenChange?.(overlayOpen);
    return () => onOverlayOpenChange?.(false);
  }, [overlayOpen, onOverlayOpenChange]);

  const refresh = () => { setRefreshing(true); void loadSaved(); void loadProfile(); void loadPosts(); };
  const savedCount = saved?.length ?? 0;

  const stat = (value: number | null, label: string, onPress?: () => void) => (
    <AnimatedPressable accessibilityLabel={value === null ? label : `${formatCount(value)} ${label}`} accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} pressScale={0.95} style={styles.stat}>
      <Text style={styles.statValue}>{value === null ? '–' : formatCount(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </AnimatedPressable>
  );

  const signalsTab = posts === null ? (
    <ActivityIndicator accessibilityLabel={tx('profile:me.postsLoading', 'Sinyallerin yükleniyor')} color={colors.primary} style={styles.loading} />
  ) : postsError && posts.length === 0 ? (
    <View style={styles.inline}>
      <Text accessibilityRole="alert" style={styles.error}>{postsError}</Text>
      <BlinkrButton label={tx('common:actions.retry', 'Tekrar dene')} onPress={() => void loadPosts()} variant="secondary" />
    </View>
  ) : posts.length === 0 ? (
    <BlinkrEmptyState
      action={onCreateSignal ? { label: tx('profile:me.firstSignal', 'İlk sinyalini bırak'), onPress: onCreateSignal, icon: <Camera color={colors.ink} size={20} /> } : undefined}
      description={tx('profile:me.postsEmptyHint', 'Paylaştığın sinyaller burada görünür.')}
      icon={<Radio color={colors.textSecondary} size={24} />}
      style={styles.empty}
      title={tx('profile:me.postsEmpty', 'Henüz sinyal paylaşmadın')}
    />
  ) : (
    <View style={styles.signals}>
      <View style={styles.grid}>
        {posts.map((post) => <SignalGridTile key={post.id} onPress={() => setOpenPost(post)} post={post} size={tileSize} />)}
      </View>
      {total !== null && total > posts.length ? (
        <BlinkrButton
          icon={<Archive color={colors.text} size={18} />}
          label={tx('profile:me.allSignals', 'Tüm sinyaller · {{count}}', { count: formatCount(total) })}
          onPress={() => setArchiveOpen(true)}
          variant="secondary"
        />
      ) : null}
    </View>
  );

  const placesTab = saved === null ? (
    <SkeletonList rows={2} style={styles.savedSkeleton} />
  ) : savedError && saved.length === 0 ? (
    <View style={styles.inline}>
      <Text accessibilityRole="alert" style={styles.error}>{savedError}</Text>
      <BlinkrButton label={tx('common:actions.retry', 'Tekrar dene')} onPress={() => void loadSaved()} variant="secondary" />
    </View>
  ) : saved.length === 0 ? (
    <BlinkrEmptyState
      description={tx('profile:me.savedEmptyHint', 'Haritada bir yerin detayını açıp yer imi simgesine dokunarak kaydet.')}
      icon={<Bookmark color={colors.textSecondary} size={24} />}
      style={styles.empty}
      title={tx('profile:me.savedEmpty', 'Henüz kayıtlı yerin yok')}
    />
  ) : (
    <View style={styles.card}>
      <Text style={styles.cardHint}>{t('saved.synced')}</Text>
      {orderSavedByLive(saved, live).map((place) => {
        const status = live[place.id];
        return (
          <AnimatedPressable
            accessibilityLabel={tx('profile:me.openPlaceA11y', '{{name}}, haritada aç', { name: place.name })}
            accessibilityRole="button"
            key={place.id}
            onPress={() => onOpenPlace(toPlace(place))}
            pressScale={0.99}
            style={styles.row}
          >
            <View style={styles.rowIcon}><PlaceSymbol category={place.category} color={categoryTone(place.category)} size={18} /></View>
            <View style={styles.rowCopy}>
              <Text numberOfLines={1} style={styles.rowTitle}>{place.name}</Text>
              <Text numberOfLines={1} style={styles.rowSub}>{formatCategory(place.category)}</Text>
              {status ? (
                <View style={styles.liveLine}>
                  <Radio color={colors.primary} size={12} />
                  <Text numberOfLines={1} style={styles.liveText}>{tx('profile:me.liveLine', 'Canlı · {{headline}}', { headline: status.headline })}{status.observedAtUtc ? ` · ${formatAge(status.observedAtUtc)}` : ''}</Text>
                </View>
              ) : null}
            </View>
            <ChevronRight color={colors.textSecondary} size={18} />
          </AnimatedPressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomBarClearance(insets.bottom) + spacing.lg }]}
        refreshControl={<RefreshControl onRefresh={refresh} refreshing={refreshing} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.handleRow}>
            {isPrivate ? <Lock accessibilityLabel={t('private.badge')} color={colors.text} size={16} /> : null}
            <Text accessibilityRole="header" numberOfLines={1} style={styles.handle}>{auth.userName}</Text>
          </View>
          <AnimatedPressable accessibilityLabel={tx('settings:title', 'Ayarlar')} accessibilityRole="button" onPress={() => setSettingsOpen(true)} pressScale={0.92} style={styles.iconButton}>
            <Settings color={colors.text} size={22} />
          </AnimatedPressable>
        </View>

        <View style={styles.identityTop}>
          <AnimatedPressable accessibilityLabel={tx('profile:me.changeAvatar', 'Avatarı değiştir')} accessibilityRole="button" onPress={() => setAvatarOpen(true)} pressScale={0.97} style={styles.avatarButton}>
            <Avatar avatarKey={auth.avatarKey} seed={auth.userId} size={AVATAR} />
            <View style={styles.avatarEdit}><Pencil color={colors.ink} size={12} strokeWidth={2.6} /></View>
          </AnimatedPressable>
          <View style={styles.stats}>
            {stat(total, tx('profile:me.signals', 'Sinyal'))}
            {stat(followerCount, t('stats.followers'), () => setFollowList('followers'))}
            {stat(followingCount, t('stats.following'), () => setFollowList('following'))}
          </View>
        </View>

        <View style={styles.about}>
          {bio
            ? <Text style={styles.bio}>{bio}</Text>
            : (
              <AnimatedPressable accessibilityLabel={tx('profile:me.bioPrompt', 'Kendini kısaca tanıt')} accessibilityRole="button" onPress={() => setEditOpen(true)} pressScale={0.99}>
                <Text style={styles.bioEmpty}>{tx('profile:me.bioPromptEllipsis', 'Kendini kısaca tanıt…')}</Text>
              </AnimatedPressable>
            )}
        </View>

        <View style={styles.buttonRow}>
          <BlinkrButton label={tx('profile:me.edit', 'Profili düzenle')} onPress={() => setEditOpen(true)} style={styles.flex} variant="secondary" />
          <BlinkrButton
            accessibilityLabel={incoming > 0 ? tx('profile:me.friendsA11y', 'Arkadaşlar, {{count}} yeni istek', { count: incoming }) : tx('profile:friends.title', 'Arkadaşlar')}
            icon={<Users color={colors.text} size={16} />}
            label={incoming > 0 ? tx('profile:me.friendsBadge', 'Arkadaşlar · {{count}}', { count: badgeText(incoming) }) : tx('profile:friends.title', 'Arkadaşlar')}
            onPress={() => setFriendsOpen(true)}
           
            style={styles.flex}
            variant="secondary"
          />
        </View>

        {followRequests > 0 ? (
          <AnimatedPressable accessibilityRole="button" onPress={() => setFollowList('requests')} pressScale={0.99} style={styles.requests}>
            <View style={styles.requestsIcon}><UserPlus color={colors.primary} size={18} /></View>
            <Text style={styles.requestsText}>{t('lists.requestsRow', { count: followRequests })}</Text>
            <View style={styles.dot} />
            <ChevronRight color={colors.textSecondary} size={18} />
          </AnimatedPressable>
        ) : null}

        <SegmentedControl
          accessibilityLabel={tx('profile:me.tabs', 'Profil bölümleri')}
          onChange={setTab}
          options={[
            { value: 'signals', label: total ? tx('profile:me.tabSignalsCount', 'Sinyaller · {{count}}', { count: formatCount(total) }) : tx('profile:me.tabSignals', 'Sinyaller') },
            { value: 'places', label: savedCount ? tx('profile:me.tabPlacesCount', 'Yerler · {{count}}', { count: formatCount(savedCount) }) : tx('profile:me.tabPlaces', 'Yerler') },
          ]}
          value={tab}
        />

        {tab === 'signals' ? signalsTab : placesTab}
      </ScrollView>

      {archiveOpen ? <SignalArchiveScreen auth={auth} onAuthChange={onAuthChange} onBack={() => setArchiveOpen(false)} onLogout={onLogout} onOpenPost={setOpenPost} /> : null}
      {openPost ? (
        <SignalCardModal
          auth={auth}
          cards={[fromAuthoredPost(openPost, { userId: auth.userId, userName: auth.userName })]}
          deviceOrigin={null}
          key={openPost.id}
          onChanged={() => setOpenPost(null)}
          onClose={() => setOpenPost(null)}
          onConfirm={async () => {}}
          onDeleted={() => { setOpenPost(null); void loadPosts(); }}
          onOpenAuthor={() => setOpenPost(null)}
          refresh={{ onAuthRefresh: onAuthChange, onSessionExpired: onLogout }}
        />
      ) : null}
      {friendsOpen ? (
        <FriendsScreen
          auth={auth}
          initialTab={incoming > 0 ? 'requests' : 'friends'}
          onAuthChange={onAuthChange}
          onBack={() => { setFriendsOpen(false); void loadProfile(); }}
          onCountsChange={({ incoming: waiting }) => { setIncoming(waiting); onRequestsChange?.(waiting); }}
          onMessage={(user) => { setFriendsOpen(false); onMessageUser?.(user); }}
          onSessionExpired={onLogout}
        />
      ) : null}
      {editOpen ? (
        <EditProfileSheet
          auth={auth}
          bio={bio ?? ''}
          onAuthChange={onAuthChange}
          onChangeAvatar={() => { setEditOpen(false); setAvatarOpen(true); }}
          onClose={() => setEditOpen(false)}
          onSaved={setBio}
          onSessionExpired={onLogout}
        />
      ) : null}
      {followList ? (
        <FollowListSheet
          auth={auth}
          initialTab={followList}
          onClose={() => { setFollowList(null); void loadProfile(); }}
          onCountsChange={() => { void loadProfile(); }}
          onOpenUser={(user) => { setFollowList(null); setPerson(user); }}
          ownerId={auth.userId}
          ownerName={auth.userName}
          refresh={{ onAuthRefresh: onAuthChange, onSessionExpired: onLogout }}
          showRequests={isPrivate || followRequests > 0}
        />
      ) : null}
      {person ? (
        <UserProfileSheet
          auth={auth}
          onAuthChange={onAuthChange}
          onClose={() => { setPerson(null); void loadProfile(); }}
          onMessage={(user) => { setPerson(null); onMessageUser?.(user); }}
          onSessionExpired={onLogout}
          user={person}
        />
      ) : null}
      {settingsOpen ? <SettingsScreen auth={auth} isPrivate={isPrivate} onAuthChange={onAuthChange} onBack={() => { setSettingsOpen(false); void loadProfile(); }} onLogout={onLogout} onPrivacyChange={setIsPrivate} onSessionExpired={onLogout} /> : null}
      {avatarOpen ? <AvatarPickerSheet auth={auth} onAuthChange={onAuthChange} onClose={() => setAvatarOpen(false)} onSessionExpired={onLogout} /> : null}
    </View>
  );
}

const AVATAR = 84;

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.md, paddingHorizontal: spacing.lg },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  handleRow: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: spacing.xs },
  handle: { ...typography.headline, color: colors.text, flexShrink: 1 },
  iconButton: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', marginRight: -spacing.sm, width: sizes.touch },
  identityTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  avatarButton: { height: AVATAR, width: AVATAR },
  avatarEdit: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.background, borderRadius: radii.pill, borderWidth: 2, bottom: 0, height: 26, justifyContent: 'center', position: 'absolute', right: 0, width: 26 },
  stats: { alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 1, minWidth: 64 },
  statValue: { ...typography.title, color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  about: { gap: 2 },
  bio: { ...typography.body, color: colors.text },
  bioEmpty: { ...typography.body, color: colors.textSecondary },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  requests: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.card, flexDirection: 'row', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.md, ...shadowSoft },
  requestsIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 36, justifyContent: 'center', width: 36 },
  requestsText: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  dot: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 8, width: 8 },
  signals: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: 'hidden', paddingVertical: spacing.xs, ...shadowSoft },
  cardHint: { ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  savedSkeleton: { padding: spacing.lg },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.lg },
  rowIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.sm + 2, height: 38, justifyContent: 'center', width: 38 },
  rowCopy: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary },
  liveLine: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 1 },
  liveText: { ...typography.label, color: colors.primary, flexShrink: 1 },
  loading: { paddingBottom: spacing.xl, paddingTop: spacing.md },
  inline: { gap: spacing.md, paddingVertical: spacing.lg },
  error: { ...typography.body, color: colors.danger },
  empty: { paddingBottom: spacing.xl, paddingTop: spacing.md },
});
