import { Bookmark, Camera, LogOut, Pencil, Radio, Settings, ShieldCheck, Users } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMyPosts, getMyProfile, getPlacesByIds } from '../api';
import { badgeText } from '../friends';
import { formatAge, formatCategory } from '../presentation';
import { friendlyError } from '../productPresentation';
import { listSavedPlaces, toPlace, type SavedPlace } from '../savedPlaces';
import { liveLookupIds, mergeLive, orderSavedByLive, type SavedLive } from '../savedLive';
import { categoryTone, colors, radii, sizes, spacing, typography } from '../theme';
import type { AuthoredPost, AuthResponse, BlinkrPlace, UserSummary } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { Avatar } from './Avatar';
import { AvatarPickerSheet } from './AvatarPickerSheet';
import { EditProfileSheet } from './EditProfileSheet';
import { FollowListSheet, type FollowListTab } from './friends/FollowListSheet';
import { FriendsScreen } from './friends/FriendsScreen';
import { UserProfileSheet } from './friends/UserProfileSheet';
import { PlaceSymbol } from './PlaceSymbol';
import { PostRow } from './PostRow';
import { SettingsScreen } from './SettingsScreen';
import { BlinkrButton } from './ui/BlinkrButton';
import { bottomBarClearance } from './ui/BlinkrBottomBar';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';
import { SkeletonList } from './ui/BlinkrSkeleton';

// 50 per page keeps the request count low, and the server refuses page numbers above 1000 (an abuse
// guard), so 50 x 1000 = 50,000 posts stay reachable; 20 per page would strand posts past 20,000.
const PAGE_SIZE = 50;
const MAX_PAGE = 1000;
const formatCount = (value: number) => value.toLocaleString('tr-TR');

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

/**
 * Profile shows only what the app really knows: who is signed in, the places saved on this device,
 * the user's own posts (paged from the server, so thousands of them never freeze the screen) and the
 * privacy promise. Nothing here is decorative data.
 */
export function ProfileScreen({ auth, onAuthChange, onLogout, onOpenPlace, onCreateSignal, onOverlayOpenChange, onMessageUser, onRequestsChange }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('profile');
  const [saved, setSaved] = useState<SavedPlace[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [posts, setPosts] = useState<AuthoredPost[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
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
  const [live, setLive] = useState<Record<string, SavedLive | undefined>>({});
  const nextPage = useRef(1);
  const inFlight = useRef<AbortController | null>(null);

  const loadSaved = useCallback(async () => {
    setSavedError(null);
    try {
      setSaved(await listSavedPlaces(auth.userId));
    } catch (err) {
      setSaved((current) => current ?? []);
      setSavedError(friendlyError(err, 'Kaydedilen yerler okunamadı.'));
    }
  }, [auth.userId]);

  // Pages are appended and de-duplicated by id: a post published while the user scrolls shifts the
  // server-side page boundaries, which would otherwise show the same row twice.
  const loadPosts = useCallback(async (reset: boolean) => {
    if (inFlight.current && !reset) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    if (reset) { nextPage.current = 1; setPostsError(null); } else setLoadingMore(true);
    try {
      const page = nextPage.current;
      const result = await getMyPosts(auth, page, PAGE_SIZE, controller.signal, onAuthChange, onLogout);
      if (controller.signal.aborted) return;
      nextPage.current = page + 1;
      setTotal(result.total);
      setPosts((current) => {
        const merged = reset ? result.items : [...current, ...result.items];
        const seen = new Set<string>();
        return merged.filter((post) => (seen.has(post.id) ? false : (seen.add(post.id), true)));
      });
      setPostsError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setPostsError(friendlyError(err, 'Sinyallerin yüklenemedi. Tekrar dene.'));
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setPostsLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [auth, onAuthChange, onLogout]);

  // Bio and friend numbers come from the account; a failure keeps what is shown (they are not worth an error banner).
  const loadProfile = useCallback(async () => {
    try {
      const mine = await getMyProfile(auth, undefined, { onAuthRefresh: onAuthChange, onSessionExpired: onLogout });
      setBio(mine.bio ?? null);
      setFriendCount(mine.friendCount);
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
  useEffect(() => { void loadPosts(true); return () => inFlight.current?.abort(); }, [auth.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reachable = nextPage.current <= MAX_PAGE;
  const hasMore = total !== null && posts.length < total && reachable;
  const capped = total !== null && posts.length < total && !reachable;
  const [avatarOpen, setAvatarOpen] = useState(false);
  const overlayOpen = avatarOpen || friendsOpen || editOpen || settingsOpen || Boolean(followList) || Boolean(person);
  useEffect(() => {
    onOverlayOpenChange?.(overlayOpen);
    return () => onOverlayOpenChange?.(false);
  }, [overlayOpen, onOverlayOpenChange]);

  const header = (
    <View style={styles.headerBlock}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <Text accessibilityRole="header" style={styles.screenTitle}>Profil</Text>
        <AnimatedPressable accessibilityLabel="Ayarlar" accessibilityRole="button" onPress={() => setSettingsOpen(true)} pressScale={0.92} style={styles.settingsButton}>
          <Settings color={colors.text} size={22} />
        </AnimatedPressable>
      </View>

      <View style={styles.identity}>
        <View style={styles.identityTop}>
          <AnimatedPressable accessibilityLabel="Avatarı değiştir" accessibilityRole="button" onPress={() => setAvatarOpen(true)} pressScale={0.97} style={styles.avatarButton}>
            <Avatar avatarKey={auth.avatarKey} seed={auth.userId} size={72} />
            <View style={styles.avatarEdit}><Pencil color={colors.ink} size={12} strokeWidth={2.6} /></View>
          </AnimatedPressable>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text accessibilityLabel={total === null ? 'Sinyal sayısı yükleniyor' : `${formatCount(total)} sinyal`} style={styles.statValue}>{total === null ? '–' : formatCount(total)}</Text>
              <Text style={styles.statLabel}>Sinyal</Text>
            </View>
            <AnimatedPressable accessibilityLabel={followerCount === null ? t('stats.followers') : `${formatCount(followerCount)} ${t('stats.followers')}`} accessibilityRole="button" onPress={() => setFollowList('followers')} pressScale={0.95} style={styles.stat}>
              <Text style={styles.statValue}>{followerCount === null ? '–' : formatCount(followerCount)}</Text>
              <Text style={styles.statLabel}>{t('stats.followers')}</Text>
            </AnimatedPressable>
            <AnimatedPressable accessibilityLabel={followingCount === null ? t('stats.following') : `${formatCount(followingCount)} ${t('stats.following')}`} accessibilityRole="button" onPress={() => setFollowList('following')} pressScale={0.95} style={styles.stat}>
              <Text style={styles.statValue}>{followingCount === null ? '–' : formatCount(followingCount)}</Text>
              <Text style={styles.statLabel}>{t('stats.following')}</Text>
            </AnimatedPressable>
          </View>
        </View>
        <View>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>{auth.userName}</Text>
          {isPrivate ? <Text style={styles.email}>{t('private.badge')}</Text> : null}
        </View>
        {bio
          ? <Text style={styles.bio}>{bio}</Text>
          : (
            <AnimatedPressable accessibilityLabel="Kendini kısaca tanıt" accessibilityRole="button" onPress={() => setEditOpen(true)} pressScale={0.99}>
              <Text style={styles.bioEmpty}>Kendini kısaca tanıt…</Text>
            </AnimatedPressable>
          )}
        {followRequests > 0 ? (
          <BlinkrButton label={t('lists.requestsRow', { count: followRequests })} onPress={() => setFollowList('requests')} variant="secondary" />
        ) : null}
        <View style={styles.buttonRow}>
          <BlinkrButton label="Profili düzenle" onPress={() => setEditOpen(true)} style={styles.flex} variant="secondary" />
          <BlinkrButton
            accessibilityLabel={incoming > 0 ? `Arkadaşlar, ${incoming} yeni istek` : 'Arkadaşlar'}
            icon={<Users color={colors.text} size={16} />}
            label={incoming > 0 ? `Arkadaşlar · ${badgeText(incoming)}` : 'Arkadaşlar'}
            onPress={() => setFriendsOpen(true)}
            style={styles.flex}
            variant="secondary"
          />
        </View>
      </View>

      <View style={styles.group}>
        <View style={styles.groupHeader}>
          <Text accessibilityRole="header" style={styles.groupTitle}>Kaydettiğin yerler</Text>
          <Text style={styles.groupSub}>{t('saved.synced')}</Text>
        </View>

        {saved === null ? (
          <SkeletonList rows={2} style={styles.savedSkeleton} />
        ) : savedError ? (
          <View style={styles.inline}>
            <Text accessibilityRole="alert" style={styles.error}>{savedError}</Text>
            <BlinkrButton label="Tekrar dene" onPress={() => void loadSaved()} variant="secondary" />
          </View>
        ) : saved.length === 0 ? (
          <BlinkrEmptyState
            description="Haritada bir yerin detayını açıp yer imi simgesine dokunarak kaydet."
            icon={<Bookmark color={colors.textSecondary} size={24} />}
            style={styles.empty}
            title="Henüz kayıtlı yerin yok"
          />
        ) : (
          <View>
            {orderSavedByLive(saved, live).map((place) => {
              const tone = categoryTone(place.category);
              const status = live[place.id];
              return (
                <AnimatedPressable
                  accessibilityLabel={`${place.name}, haritada aç`}
                  accessibilityRole="button"
                  key={place.id}
                  onPress={() => onOpenPlace(toPlace(place))}
                  pressScale={0.99}
                  style={styles.row}
                >
                  <View style={styles.rowIcon}>
                    <PlaceSymbol category={place.category} color={tone} size={18} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={styles.rowTitle}>{place.name}</Text>
                    <Text numberOfLines={1} style={styles.rowSub}>{formatCategory(place.category)}</Text>
                    {status ? (
                      <View style={styles.liveLine}>
                        <Radio color={colors.primary} size={12} />
                        <Text numberOfLines={1} style={styles.liveText}>Canlı · {status.headline}{status.observedAtUtc ? ` · ${formatAge(status.observedAtUtc)}` : ''}</Text>
                      </View>
                    ) : null}
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.note}>
        <ShieldCheck color={colors.textSecondary} size={18} />
        <Text style={styles.noteText}>Kesin cihaz konumun diğer kullanıcılara gösterilmez. Anonim paylaşımlarını yalnızca sen görürsün.</Text>
      </View>

      <AnimatedPressable accessibilityLabel="Oturumu kapat" accessibilityRole="button" onPress={onLogout} pressScale={0.98} style={styles.logout}>
        <LogOut color={colors.danger} size={18} />
        <Text style={styles.logoutText}>Oturumu kapat</Text>
      </AnimatedPressable>

      <View style={styles.postsHeading}>
        <Text accessibilityRole="header" style={styles.postsTitle}>Sinyallerim</Text>
        {total !== null ? <Text style={styles.postsCount}>{formatCount(total)}</Text> : null}
      </View>
    </View>
  );

  const footer = postsError && posts.length > 0
    ? (
      <View style={styles.inline}>
        <Text accessibilityRole="alert" style={styles.error}>{postsError}</Text>
        <BlinkrButton label="Tekrar dene" onPress={() => void loadPosts(false)} variant="secondary" />
      </View>
    )
    : loadingMore ? <ActivityIndicator accessibilityLabel="Daha fazla yükleniyor" color={colors.primary} style={styles.loading} />
    : capped ? <Text style={styles.endText}>En yeni {formatCount(posts.length)} sinyal gösteriliyor</Text>
    : !hasMore && posts.length > 0 ? <Text style={styles.endText}>Hepsi bu kadar</Text>
    : null;

  return (
    <View style={styles.screen}>
      <FlatList
        ListEmptyComponent={
          postsLoading ? <ActivityIndicator accessibilityLabel="Sinyallerin yükleniyor" color={colors.primary} style={styles.loading} />
            : postsError ? (
              <View style={styles.inline}>
                <Text accessibilityRole="alert" style={styles.error}>{postsError}</Text>
                <BlinkrButton label="Tekrar dene" onPress={() => { setPostsLoading(true); void loadPosts(true); }} variant="secondary" />
              </View>
            ) : (
              <BlinkrEmptyState
                action={onCreateSignal ? { label: 'İlk sinyalini bırak', onPress: onCreateSignal, icon: <Camera color={colors.ink} size={20} /> } : undefined}
                description="Paylaştığın sinyaller burada görünür."
                icon={<Radio color={colors.textSecondary} size={24} />}
                style={styles.empty}
                title="Henüz sinyal paylaşmadın"
              />
            )
        }
        ListFooterComponent={footer}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.content, { paddingBottom: bottomBarClearance(insets.bottom) + spacing.lg }]}
        data={posts}
        initialNumToRender={10}
        keyExtractor={(item) => item.id}
        maxToRenderPerBatch={10}
        onEndReached={() => { if (hasMore && !postsError) void loadPosts(false); }}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); void loadSaved(); void loadProfile(); void loadPosts(true); }} refreshing={refreshing} tintColor={colors.mint} />}
        removeClippedSubviews
        renderItem={({ item }) => <PostRow post={item} />}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />
      {friendsOpen ? (
        <FriendsScreen
          auth={auth}
          initialTab={incoming > 0 ? 'requests' : 'friends'}
          onAuthChange={onAuthChange}
          onBack={() => { setFriendsOpen(false); void loadProfile(); }}
          onCountsChange={({ friends, incoming: waiting }) => { setFriendCount(friends); setIncoming(waiting); onRequestsChange?.(waiting); }}
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

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  headerBlock: { gap: spacing.lg, paddingBottom: spacing.sm },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  screenTitle: { ...typography.headline, color: colors.text },
  identity: { gap: spacing.md },
  identityTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.xl },
  avatarButton: { height: 72, width: 72 },
  avatarEdit: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.background, borderRadius: radii.pill, borderWidth: 2, bottom: -2, height: 24, justifyContent: 'center', position: 'absolute', right: -2, width: 24 },
  stats: { alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 1 },
  statValue: { ...typography.heading, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  name: { ...typography.heading, color: colors.text },
  email: { ...typography.caption, color: colors.textSecondary },
  settingsButton: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', marginRight: -spacing.sm, width: sizes.touch },
  savedSkeleton: { padding: spacing.lg },
  liveLine: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 1 },
  liveText: { ...typography.label, color: colors.primary, flexShrink: 1 },
  bio: { ...typography.body, color: colors.text },
  bioEmpty: { ...typography.body, color: colors.textSecondary },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  editButton: { minHeight: 36 },
  group: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, overflow: 'hidden' },
  groupHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  groupTitle: { ...typography.heading, color: colors.text, fontSize: 16, lineHeight: 21 },
  groupSub: { ...typography.caption, color: colors.textSecondary },
  loading: { paddingBottom: spacing.xl, paddingTop: spacing.md },
  inline: { gap: spacing.md, padding: spacing.lg },
  error: { ...typography.body, color: colors.danger },
  empty: { paddingBottom: spacing.xl, paddingTop: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg },
  rowIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.sm + 2, height: 36, justifyContent: 'center', width: 36 },
  rowCopy: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary },
  note: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xs },
  noteText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  logout: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, minHeight: sizes.touch, paddingHorizontal: spacing.xs },
  logoutText: { ...typography.bodyStrong, color: colors.danger },
  postsHeading: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  postsTitle: { ...typography.heading, color: colors.text },
  postsCount: { ...typography.caption, color: colors.textSecondary },
  endText: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.lg, textAlign: 'center' },
});
