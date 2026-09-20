import { Bookmark, Camera, ChevronRight, EyeOff, Image as ImageIcon, LogOut, MapPin, Radio, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMyPosts } from '../api';
import { formatAge, formatCategory, signalLabels } from '../presentation';
import { friendlyError, signalValueLabel } from '../productPresentation';
import { listSavedPlaces, toPlace, type SavedPlace } from '../savedPlaces';
import { categoryTone, colors, radii, signalColors, spacing, typography } from '../theme';
import type { AuthoredPost, AuthResponse, BlinkrPlace } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { PlaceSymbol } from './PlaceSymbol';
import { SignalSymbol } from './SignalSymbol';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrCard } from './ui/BlinkrCard';
import { bottomBarClearance } from './ui/BlinkrBottomBar';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';
import { BlinkrHeader } from './ui/BlinkrHeader';

const PAGE_SIZE = 20;
const formatCount = (value: number) => value.toLocaleString('tr-TR');

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onLogout: () => void;
  /** Opens a saved Place on the map. */
  onOpenPlace: (place: BlinkrPlace) => void;
  /** Empty-state call to action; opens the camera/composer. */
  onCreateSignal?: () => void;
};

function PostRow({ post }: { post: AuthoredPost }) {
  const tone = signalColors[post.signalType] ?? colors.mint;
  const expired = post.expiresAt ? Date.parse(post.expiresAt) < Date.now() : false;
  const anonymous = post.identityDisclosure === 'AnonymousMap';
  const value = signalValueLabel(post.signalType, post.signalValue);
  return (
    <View style={styles.post}>
      <View style={[styles.postIcon, { borderColor: tone }]}><SignalSymbol color={tone} size={22} type={post.signalType} /></View>
      <View style={styles.postBody}>
        <View style={styles.postTop}>
          <Text numberOfLines={1} style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postAge}>{formatAge(post.createdAtUtc)}</Text>
        </View>
        {post.content ? <Text numberOfLines={2} style={styles.postText}>{post.content}</Text> : null}
        <View style={styles.postMeta}>
          <Text style={[styles.chip, { color: tone, borderColor: tone }]}>{signalLabels[post.signalType] ?? 'Sinyal'}{value ? ` · ${value}` : ''}</Text>
          {anonymous ? <View style={styles.chipRow}><EyeOff color={colors.textSecondary} size={13} /><Text style={styles.chipMuted}>Anonim</Text></View> : null}
          {post.mediaUrls?.length ? <View style={styles.chipRow}><ImageIcon color={colors.textSecondary} size={13} /><Text style={styles.chipMuted}>{post.mediaUrls.length}</Text></View> : null}
          {post.locationName ? <View style={styles.chipRow}><MapPin color={colors.textSecondary} size={13} /><Text numberOfLines={1} style={[styles.chipMuted, styles.place]}>{post.locationName}</Text></View> : null}
          {expired ? <Text style={styles.chipMuted}>Sona erdi</Text> : <View style={styles.chipRow}><Radio color={colors.mint} size={13} /><Text style={styles.chipLive}>Canlı</Text></View>}
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
export function ProfileScreen({ auth, onAuthChange, onLogout, onOpenPlace, onCreateSignal }: Props) {
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

  const hasMore = total !== null && posts.length < total;
  const initial = auth.userName.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';

  const header = (
    <View style={styles.headerBlock}>
      <BlinkrHeader subtitle={<Text style={styles.headerSub}>SENİN ÇEVREN</Text>} />

      <BlinkrCard style={styles.identity}>
        <View style={styles.identityTop}>
          <View style={styles.ring}><Text style={styles.ringText}>{initial}</Text></View>
          <View style={styles.identityCopy}>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>{auth.userName}</Text>
            <Text numberOfLines={1} style={styles.email}>{auth.email}</Text>
          </View>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Radio color={colors.mint} size={22} />
            <View>
              <Text accessibilityLabel={total === null ? 'Sinyal sayısı yükleniyor' : `${formatCount(total)} sinyal`} style={styles.statValue}>{total === null ? '–' : formatCount(total)}</Text>
              <Text style={styles.statLabel}>Sinyal</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Bookmark color={colors.mint} size={22} />
            <View>
              <Text style={styles.statValue}>{saved ? saved.length : '–'}</Text>
              <Text style={styles.statLabel}>Kaydedilen</Text>
            </View>
          </View>
        </View>
      </BlinkrCard>

      <BlinkrCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}><Bookmark color={colors.ink} size={20} /></View>
          <View style={styles.sectionCopy}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Kaydettiğin yerler</Text>
            <Text style={styles.sectionSub}>Bu cihazda saklanır</Text>
          </View>
        </View>

        {saved === null ? (
          <ActivityIndicator accessibilityLabel="Yükleniyor" color={colors.mint} style={styles.loading} />
        ) : savedError ? (
          <View style={styles.inline}>
            <Text accessibilityRole="alert" style={styles.error}>{savedError}</Text>
            <BlinkrButton label="Tekrar dene" onPress={() => void loadSaved()} variant="secondary" />
          </View>
        ) : saved.length === 0 ? (
          <BlinkrEmptyState
            description="Haritada bir yerin detayını açıp yer imi simgesine dokunarak kaydet."
            icon={<Bookmark color={colors.textSecondary} size={30} />}
            style={styles.empty}
            title="Henüz kayıtlı yerin yok"
          />
        ) : (
          <View>
            {saved.map((place, index) => {
              const tone = categoryTone(place.category);
              return (
                <AnimatedPressable
                  accessibilityLabel={`${place.name}, haritada aç`}
                  accessibilityRole="button"
                  key={place.id}
                  onPress={() => onOpenPlace(toPlace(place))}
                  pressScale={0.98}
                  style={[styles.row, index > 0 && styles.rowDivider]}
                >
                  <View style={[styles.rowIcon, { borderColor: tone }]}>
                    <PlaceSymbol category={place.category} color={tone} size={22} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={styles.rowTitle}>{place.name}</Text>
                    <Text numberOfLines={1} style={styles.rowSub}>{formatCategory(place.category)}</Text>
                  </View>
                  <ChevronRight color={colors.textSecondary} size={22} />
                </AnimatedPressable>
              );
            })}
          </View>
        )}
      </BlinkrCard>

      <BlinkrCard style={styles.privacy}>
        <ShieldCheck color={colors.mint} size={24} />
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>Gizlilik</Text>
          <Text style={styles.sectionSub}>Kesin cihaz konumun diğer kullanıcılara gösterilmez. Anonim paylaşımlarını yalnızca sen görürsün.</Text>
        </View>
      </BlinkrCard>

      <BlinkrButton icon={<LogOut color={colors.danger} size={20} />} label="Oturumu kapat" onPress={onLogout} variant="danger" />

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
    : loadingMore ? <ActivityIndicator accessibilityLabel="Daha fazla yükleniyor" color={colors.mint} style={styles.loading} />
    : !hasMore && posts.length > 0 ? <Text style={styles.endText}>Hepsi bu kadar</Text>
    : null;

  return (
    <View style={styles.screen}>
      <FlatList
        ListEmptyComponent={
          postsLoading ? <ActivityIndicator accessibilityLabel="Sinyallerin yükleniyor" color={colors.mint} style={styles.loading} />
            : postsError ? (
              <View style={styles.inline}>
                <Text accessibilityRole="alert" style={styles.error}>{postsError}</Text>
                <BlinkrButton label="Tekrar dene" onPress={() => { setPostsLoading(true); void loadPosts(true); }} variant="secondary" />
              </View>
            ) : (
              <BlinkrEmptyState
                action={onCreateSignal ? { label: 'İlk sinyalini bırak', onPress: onCreateSignal, icon: <Camera color={colors.ink} size={20} /> } : undefined}
                description="Paylaştığın sinyaller burada görünür."
                icon={<Radio color={colors.textSecondary} size={30} />}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { paddingHorizontal: spacing.md },
  headerBlock: { gap: spacing.lg, paddingBottom: spacing.md },
  headerSub: { ...typography.label, color: colors.mint },
  identity: { gap: spacing.lg },
  identityTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  ring: { alignItems: 'center', borderColor: colors.primary, borderRadius: radii.pill, borderWidth: 3, height: 72, justifyContent: 'center', width: 72 },
  ringText: { ...typography.headline, color: colors.text },
  identityCopy: { flex: 1 },
  name: { ...typography.title, color: colors.text },
  email: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  stats: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingTop: spacing.lg },
  stat: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  statDivider: { alignSelf: 'stretch', backgroundColor: colors.border, width: 1 },
  statValue: { ...typography.title, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  section: { padding: 0 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  sectionIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, height: 44, justifyContent: 'center', width: 44 },
  sectionCopy: { flex: 1 },
  sectionTitle: { ...typography.bodyStrong, color: colors.text },
  sectionSub: { ...typography.caption, color: colors.textSecondary },
  loading: { paddingBottom: spacing.xl, paddingTop: spacing.md },
  inline: { gap: spacing.md, padding: spacing.lg },
  error: { ...typography.body, color: colors.danger },
  empty: { paddingBottom: spacing.xl },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 68, paddingHorizontal: spacing.lg },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  rowIcon: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.md, borderWidth: 2, height: 46, justifyContent: 'center', width: 46 },
  rowCopy: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary },
  privacy: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  postsHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  postsTitle: { ...typography.heading, color: colors.text },
  postsCount: { ...typography.caption, backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, color: colors.textSecondary, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 },
  post: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
  postIcon: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.md, borderWidth: 2, height: 46, justifyContent: 'center', width: 46 },
  postBody: { flex: 1, gap: 4 },
  postTop: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  postTitle: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  postAge: { ...typography.caption, color: colors.textSecondary },
  postText: { ...typography.caption, color: colors.textSecondary },
  postMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  chip: { ...typography.label, borderRadius: radii.pill, borderWidth: 1, letterSpacing: 0, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  chipRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  chipMuted: { ...typography.caption, color: colors.textSecondary },
  chipLive: { ...typography.caption, color: colors.mint, fontWeight: '700' },
  place: { maxWidth: 140 },
  endText: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.lg, textAlign: 'center' },
});
