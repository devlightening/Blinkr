import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMyPosts } from '../api';
import { tx } from '../i18n/tx';
import { displayLocale } from '../i18n/locale';
import { friendlyError } from '../productPresentation';
import { ARCHIVE_PAGE_SIZE, GRID_GAP, archivePaging, gridTileSize, type ProfileView } from '../profileGrid';
import { colors, radii, sizes, spacing, typography } from '../theme';
import type { AuthoredPost, AuthResponse } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { PostRow } from './PostRow';
import { SignalGridTile } from './SignalGridTile';
import { BlinkrButton } from './ui/BlinkrButton';
import { SegmentedControl } from './ui/BlinkrSegmentedControl';

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onLogout: () => void;
  onBack: () => void;
  onOpenPost: (post: AuthoredPost) => void;
};

/**
 * All of my signals, read like an archive: one page of ARCHIVE_PAGE_SIZE at a time with explicit "newer" and "older"
 * buttons and "page x of y" - never an endless list that loads while scrolling (the profile itself shows only the
 * newest few). A failed page keeps the one on screen.
 */
export function SignalArchiveScreen({ auth, onAuthChange, onLogout, onBack, onOpenPost }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileSize = gridTileSize(width, spacing.lg);
  const [view, setView] = useState<ProfileView>('grid');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuthoredPost[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => back.remove();
  }, [onBack]);

  const load = useCallback(async (target: number) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await getMyPosts(auth, target, ARCHIVE_PAGE_SIZE, controller.signal, onAuthChange, onLogout);
      if (controller.signal.aborted) return;
      setItems(result.items);
      setTotal(result.total);
      setPage(target);
      scroll.current?.scrollTo({ y: 0, animated: false });
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(friendlyError(err, tx('profile:archive.failed', 'Bu sayfa yüklenemedi. Tekrar dene.')));
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }, [auth, onAuthChange, onLogout]);

  useEffect(() => { void load(1); return () => request.current?.abort(); }, [load]);

  const paging = archivePaging(total ?? 0, page);
  const count = (value: number) => value.toLocaleString(displayLocale());

  const pager = total !== null && paging.pages > 1 ? (
    <View style={styles.pager}>
      <AnimatedPressable accessibilityLabel={tx('profile:archive.newer', 'Daha yeni')} accessibilityRole="button" disabled={!paging.hasNewer || loading} onPress={() => void load(page - 1)} pressScale={0.95} style={[styles.pageButton, !paging.hasNewer && styles.pageButtonOff]}>
        <ChevronLeft color={paging.hasNewer ? colors.text : colors.textSecondary} size={18} />
        <Text style={[styles.pageButtonText, !paging.hasNewer && styles.pageButtonTextOff]}>{tx('profile:archive.newer', 'Daha yeni')}</Text>
      </AnimatedPressable>
      <Text accessibilityLiveRegion="polite" style={styles.pageLabel}>{tx('profile:archive.page', '{{page}} / {{pages}}', { page: count(paging.page), pages: count(paging.pages) })}</Text>
      <AnimatedPressable accessibilityLabel={tx('profile:archive.older', 'Daha eski')} accessibilityRole="button" disabled={!paging.hasOlder || loading} onPress={() => void load(page + 1)} pressScale={0.95} style={[styles.pageButton, !paging.hasOlder && styles.pageButtonOff]}>
        <Text style={[styles.pageButtonText, !paging.hasOlder && styles.pageButtonTextOff]}>{tx('profile:archive.older', 'Daha eski')}</Text>
        <ChevronRight color={paging.hasOlder ? colors.text : colors.textSecondary} size={18} />
      </AnimatedPressable>
    </View>
  ) : null;

  return (
    <View style={styles.screen} testID="signal-archive">
      <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
        <AnimatedPressable accessibilityLabel={tx('common:actions.back', 'Geri dön')} accessibilityRole="button" onPress={onBack} pressScale={0.95} style={styles.back}>
          <ArrowLeft color={colors.text} size={22} />
        </AnimatedPressable>
        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{tx('profile:archive.title', 'Sinyal arşivi')}</Text>
          {total !== null ? <Text style={styles.subtitle}>{tx('profile:archive.total', '{{count}} sinyal', { count: count(total) })}</Text> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} ref={scroll} showsVerticalScrollIndicator={false}>
        <SegmentedControl accessibilityLabel={tx('profile:grid.switch', 'Görünüm')} onChange={setView} options={[{ value: 'grid', label: tx('profile:grid.grid', 'Izgara') }, { value: 'list', label: tx('profile:grid.list', 'Liste') }]} value={view} />
        {pager}
        {error ? (
          <View style={styles.inline}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <BlinkrButton label={tx('common:actions.retry', 'Tekrar dene')} onPress={() => void load(page)} variant="secondary" />
          </View>
        ) : null}
        {items === null ? (
          <ActivityIndicator accessibilityLabel={tx('profile:me.postsLoading', 'Sinyallerin yükleniyor')} color={colors.primary} style={styles.loading} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>{tx('profile:me.postsEmpty', 'Henüz sinyal paylaşmadın')}</Text>
        ) : (
          <View style={[view === 'grid' ? styles.grid : styles.list, loading && styles.dimmed]}>
            {items.map((post) => (view === 'grid'
              ? <SignalGridTile key={post.id} onPress={() => onOpenPost(post)} post={post} size={tileSize} />
              : <AnimatedPressable accessibilityRole="button" key={post.id} onPress={() => onOpenPost(post)} pressScale={0.99}><PostRow post={post} /></AnimatedPressable>))}
          </View>
        )}
        {items && items.length > 0 ? pager : null}
        {paging.capped && !paging.hasOlder ? <Text style={styles.empty}>{tx('profile:archive.capped', 'Arşiv en yeni {{count}} sinyali gösterir.', { count: count(paging.pages * ARCHIVE_PAGE_SIZE) })}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, zIndex: 20 },
  bar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  back: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', marginLeft: -spacing.sm, width: sizes.touch },
  titleBlock: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  content: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  pager: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pageButton: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flexDirection: 'row', gap: 2, minHeight: sizes.touch, paddingHorizontal: spacing.md },
  pageButtonOff: { opacity: 0.5 },
  pageButtonText: { ...typography.callout, color: colors.text, fontWeight: '600' },
  pageButtonTextOff: { color: colors.textSecondary },
  pageLabel: { ...typography.callout, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  list: { gap: spacing.xs },
  dimmed: { opacity: 0.5 },
  inline: { gap: spacing.md },
  error: { ...typography.body, color: colors.danger },
  loading: { paddingVertical: spacing.xl },
  empty: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.lg, textAlign: 'center' },
});
