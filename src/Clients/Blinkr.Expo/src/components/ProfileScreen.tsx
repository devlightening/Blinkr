import { Bookmark, Camera, EyeOff, Image as ImageIcon, LogOut, MapPin, Pencil, Radio, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMyPosts } from '../api';
import { formatAge, formatCategory, signalLabels } from '../presentation';
import { friendlyError, signalValueLabel } from '../productPresentation';
import { listSavedPlaces, toPlace, type SavedPlace } from '../savedPlaces';
import { categoryTone, colors, radii, signalColors, sizes, spacing, typography } from '../theme';
import type { AuthoredPost, AuthResponse, BlinkrPlace } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { Avatar } from './Avatar';
import { AvatarPickerSheet } from './AvatarPickerSheet';
import { PlaceSymbol } from './PlaceSymbol';
import { SignalSymbol } from './SignalSymbol';
import { BlinkrButton } from './ui/BlinkrButton';
import { bottomBarClearance } from './ui/BlinkrBottomBar';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';

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
};

function PostRow({ post }: { post: AuthoredPost }) {
  const tone = signalColors[post.signalType] ?? colors.mint;
  const expired = post.expiresAt ? Date.parse(post.expiresAt) < Date.now() : false;
  const anonymous = post.identityDisclosure === 'AnonymousMap';
  const value = signalValueLabel(post.signalType, post.signalValue);
  return (
    <View style={styles.post}>
      <View style={styles.postIcon}><SignalSymbol color={tone} size={18} type={post.signalType} /></View>
      <View style={styles.postBody}>
        <View style={styles.postTop}>
          <Text numberOfLines={1} style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postAge}>{formatAge(post.createdAtUtc)}</Text>
        </View>
        {post.content ? <Text numberOfLines={2} style={styles.postText}>{post.content}</Text> : null}
        <View style={styles.postMeta}>
          <Text style={[styles.chip, { backgroundColor: `${tone}24`, color: tone }]}>{signalLabels[post.signalType] ?? 'Sinyal'}{value ? ` · ${value}` : ''}</Text>
          {anonymous ? <View style={styles.chipRow}><EyeOff color={colors.textSecondary} size={12} /><Text style={styles.chipMuted}>Anonim</Text></View> : null}
          {post.mediaUrls?.length ? <View style={styles.chipRow}><ImageIcon color={colors.textSecondary} size={12} /><Text style={styles.chipMuted}>{post.mediaUrls.length}</Text></View> : null}
          {post.locationName ? <View style={styles.chipRow}><MapPin color={colors.textSecondary} size={12} /><Text numberOfLines={1} style={[styles.chipMuted, styles.place]}>{post.locationName}</Text></View> : null}
          {expired ? <Text style={styles.chipMuted}>Sona erdi</Text> : <View style={styles.chipRow}><Radio color={colors.primary} size={12} /><Text style={styles.chipLive}>Canlı</Text></View>}
        </View>
      </View>
    </View>
  );
}

/**
 * Profile shows only what the app really knows: who is signed in, the places saved on this device,
 * the user's own posts (paged from the server, so thousands of them never freeze the screen) and the
 * privacy promise. Nothing here is decorative data.
 */
export function ProfileScreen({ auth, onAuthChange, onLogout, onOpenPlace, onCreateSignal, onOverlayOpenChange }: Props) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState<SavedPlace[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [posts, setPosts] = useState<AuthoredPost[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
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

  useEffect(() => { void loadSaved(); }, [loadSaved]);
  useEffect(() => { void loadPosts(true); return () => inFlight.current?.abort(); }, [auth.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reachable = nextPage.current <= MAX_PAGE;
  const hasMore = total !== null && posts.length < total && reachable;
  const capped = total !== null && posts.length < total && !reachable;
  const [avatarOpen, setAvatarOpen] = useState(false);
  useEffect(() => {
    onOverlayOpenChange?.(avatarOpen);
    return () => onOverlayOpenChange?.(false);
  }, [avatarOpen, onOverlayOpenChange]);

  const header = (
    <View style={styles.headerBlock}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <Text accessibilityRole="header" style={styles.screenTitle}>Profil</Text>
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
            <View style={styles.stat}>
              <Text style={styles.statValue}>{saved ? saved.length : '–'}</Text>
              <Text style={styles.statLabel}>Kaydedilen</Text>
            </View>
          </View>
        </View>
        <View>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>{auth.userName}</Text>
          <Text numberOfLines={1} style={styles.email}>{auth.email}</Text>
        </View>
        <BlinkrButton label="Avatarı düzenle" onPress={() => setAvatarOpen(true)} style={styles.editButton} variant="secondary" />
      </View>

      <View style={styles.group}>
        <View style={styles.groupHeader}>
          <Text accessibilityRole="header" style={styles.groupTitle}>Kaydettiğin yerler</Text>
          <Text style={styles.groupSub}>Bu cihazda saklanır</Text>
        </View>

        {saved === null ? (
          <ActivityIndicator accessibilityLabel="Yükleniyor" color={colors.primary} style={styles.loading} />
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
            {saved.map((place) => {
              const tone = categoryTone(place.category);
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
        refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); void loadSaved(); void loadPosts(true); }} refreshing={refreshing} tintColor={colors.mint} />}
        removeClippedSubviews
        renderItem={({ item }) => <PostRow post={item} />}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />
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
  post: { alignItems: 'flex-start', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  postIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.sm + 2, height: 36, justifyContent: 'center', width: 36 },
  postBody: { flex: 1, gap: 3 },
  postTop: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  postTitle: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  postAge: { ...typography.label, color: colors.textSecondary, fontWeight: '400' },
  postText: { ...typography.caption, color: colors.textSecondary },
  postMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  chip: { ...typography.label, borderRadius: radii.sm, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  chipRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  chipMuted: { ...typography.label, color: colors.textSecondary, fontWeight: '400' },
  chipLive: { ...typography.label, color: colors.primary },
  place: { maxWidth: 140 },
  endText: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.lg, textAlign: 'center' },
});
