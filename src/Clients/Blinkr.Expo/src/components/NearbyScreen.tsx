import * as Location from 'expo-location';
import { Compass, MapPin, Radio, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUnifiedMapBounds } from '../api';
import { ACTIVITY_RADIUS_METERS, boundsAround, buildNearbyActivity, filterActivity, type ActivityFilter, type ActivityItem } from '../nearbyActivity';
import { formatAge, formatCategory, formatDistance, signalLabels } from '../presentation';
import { friendlyError, signalValueLabel } from '../productPresentation';
import { colors, motion, radii, signalColors, spacing, typography } from '../theme';
import type { BlinkrPlace, CoordinateSignal } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { SignalSymbol } from './SignalSymbol';
import { bottomBarClearance } from './ui/BlinkrBottomBar';
import { BlinkrChip } from './ui/BlinkrChip';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';
import { SkeletonList } from './ui/BlinkrSkeleton';

type Props = {
  /** Opens a Place with live state on the map, with its detail sheet. */
  onOpenPlace: (place: BlinkrPlace) => void;
  /** Opens a coordinate signal on the map, with its detail sheet. */
  onOpenSignal: (signal: CoordinateSignal) => void;
  /** Empty-state call to action; opens the camera/composer. */
  onCreateSignal?: () => void;
};

type Phase = 'checking' | 'needsPermission' | 'blocked' | 'locating' | 'loading' | 'ready' | 'error';
type Origin = { latitude: number; longitude: number };

const LOCATION_TIMEOUT_MS = 12_000;
const LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;

const FILTERS: Array<{ id: ActivityFilter; label: string }> = [
  { id: 'all', label: 'Tümü' },
  { id: 'live', label: 'Canlı' },
  { id: 'crowd', label: 'Doluluk' },
  { id: 'queue', label: 'Bekleme' },
  { id: 'other', label: 'Diğer' },
];

const withTimeout = <T,>(promise: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('location-timeout')), ms);
  promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
});

const describe = (item: ActivityItem) => {
  const type = item.signalType ? signalLabels[item.signalType] : 'Gözlem';
  const value = signalValueLabel(item.signalType, item.signalValue);
  return value ? `${type} · ${value}` : type;
};

function ActivityRow({ item, index, onPress }: { item: ActivityItem; index: number; onPress: () => void }) {
  const tone = (item.signalType && signalColors[item.signalType]) || colors.mint;
  const category = item.place ? formatCategory(item.place.category) : 'Yaklaşık alan';
  const summary = describe(item);
  return (
    <Animated.View entering={FadeIn.duration(motion.base)}>
      <AnimatedPressable
        accessibilityLabel={`${item.title}, ${summary}, ${formatDistance(item.distanceMeters)}, ${formatAge(item.observedAtUtc)}. Haritada aç`}
        accessibilityRole="button"
        onPress={onPress}
        pressScale={0.99}
        style={styles.card}
      >
        <View style={styles.symbol}>
          <SignalSymbol color={tone} size={20} type={item.signalType} />
        </View>
        <View style={styles.cardBody}>
          <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
          <Text numberOfLines={1} style={[styles.cardSummary, { color: tone }]}>{summary}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{category}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.meta}>{formatDistance(item.distanceMeters)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.meta}>{formatAge(item.observedAtUtc)}</Text>
          </View>
        </View>
        <View style={styles.cardEnd}>
          {item.verifiedLive
            ? <View style={styles.liveChip}><Radio color={colors.mint} size={13} /><Text style={styles.liveText}>Canlı</Text></View>
            : null}
          {item.activeSignalCount > 1 ? <Text style={styles.count}>{item.activeSignalCount} sinyal</Text> : null}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

/**
 * "Yakında": what is happening within 1.5 km of the device right now, as a ranked list - the list view of the map.
 * It is a decision aid, not a feed: only fresh, unexpired information, freshest and closest first, capped, no
 * infinite scroll. Location is only requested when the person asks for it here.
 */
export function NearbyScreen({ onOpenPlace, onOpenSignal, onCreateSignal }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('checking');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const hasResult = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  const load = useCallback(async (background = false) => {
    controller.current?.abort();
    const mine = new AbortController();
    controller.current = mine;
    const id = ++generation.current;
    const current = () => mounted.current && generation.current === id && !mine.signal.aborted;
    const startedAt = Date.now();
    try {
      if (!background && !hasResult.current) setPhase('locating');
      let origin: Origin | null = null;
      const known = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS, requiredAccuracy: 200 }).catch(() => null);
      if (known) origin = { latitude: known.coords.latitude, longitude: known.coords.longitude };
      if (!origin) {
        const fix = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), LOCATION_TIMEOUT_MS);
        origin = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
      }
      if (!current()) return;
      if (!hasResult.current) setPhase('loading');

      const response = await getUnifiedMapBounds(boundsAround(origin), mine.signal, false);
      if (!current()) return;
      const next = buildNearbyActivity(response, origin);
      setItems(next);
      setUpdatedAt(Date.now());
      setNotice(null);
      setError(null);
      hasResult.current = true;
      setPhase('ready');
      console.log('[Blinkr Nearby]', { status: 'ready', resultCount: next.length, totalMs: Date.now() - startedAt });
    } catch (err) {
      if (!current()) return;
      const timedOut = err instanceof Error && err.message === 'location-timeout';
      const message = timedOut ? 'Konumun şu an alınamadı. Açık bir alana geçip tekrar dene.' : friendlyError(err, 'Yakındakiler yüklenemedi. Tekrar dene.');
      console.log('[Blinkr Nearby]', { status: 'failed', reason: timedOut ? 'location-timeout' : 'request', totalMs: Date.now() - startedAt });
      // Stale-while-revalidate: a failed refresh keeps the last good list and says so.
      if (hasResult.current) { setNotice(message); setPhase('ready'); } else { setError(message); setPhase('error'); }
    } finally {
      if (mounted.current && generation.current === id) setRefreshing(false);
    }
  }, []);

  const start = useCallback(async (ask: boolean) => {
    try {
      const permission = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      if (!mounted.current) return;
      if (permission.granted) { void load(); return; }
      // The system dialog no longer appears once it was refused with "don't ask again": only Ayarlar can help.
      setPhase(permission.canAskAgain === false ? 'blocked' : 'needsPermission');
    } catch {
      if (mounted.current) { setError('Konum izni kontrol edilemedi. Tekrar dene.'); setPhase('error'); }
    }
  }, [load]);

  // Look at the permission without asking; the person opts in with the button.
  useEffect(() => { void start(false); }, [start]);

  // Coming back from Ayarlar/background after granting permission there.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && (phase === 'blocked' || phase === 'needsPermission')) void start(false);
    });
    return () => subscription.remove();
  }, [phase, start]);

  const visible = useMemo(() => filterActivity(items, filter), [items, filter]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(({ id }) => [id, filterActivity(items, id).length])) as Record<ActivityFilter, number>, [items]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <Text accessibilityRole="header" style={styles.title}>Yakında</Text>
      <Text style={styles.subtitle}>
        {phase === 'ready'
          ? `${items.length} taze sinyal · ${(ACTIVITY_RADIUS_METERS / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 1 })} km içinde${updatedAt ? ` · ${formatAge(new Date(updatedAt).toISOString())} güncellendi` : ''}`
          : 'Çevrendeki taze yer durumları'}
      </Text>
    </View>
  );

  if (phase === 'checking' || phase === 'locating' || phase === 'loading') {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.loadingBlock}>
          <Text accessibilityLiveRegion="polite" style={styles.status}>{phase === 'locating' ? 'Konumun alınıyor…' : phase === 'loading' ? 'Çevren taranıyor…' : ''}</Text>
          <SkeletonList rows={4} variant="card" />
        </View>
      </View>
    );
  }

  if (phase === 'needsPermission' || phase === 'blocked') {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <BlinkrEmptyState
            action={phase === 'blocked'
              ? { label: 'Ayarları aç', onPress: () => { void Linking.openSettings(); } }
              : { label: 'Konumu kullan', onPress: () => { void start(true); } }}
            description={phase === 'blocked'
              ? 'Konum izni kapalı. Ayarlar’dan açarsan çevrendeki taze sinyalleri burada görürsün.'
              : 'Konumun yalnızca yakındaki taze sinyalleri bulmak için kullanılır; kesin konumun kimseyle paylaşılmaz.'}
            icon={<MapPin color={colors.textSecondary} size={34} />}
            title="Yakındakileri görmek için konum gerekli"
          />
        </View>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <BlinkrEmptyState
            action={{ label: 'Tekrar dene', onPress: () => { void start(false); } }}
            description={error ?? undefined}
            icon={<WifiOff color={colors.textSecondary} size={32} />}
            title="Yakındakiler açılamadı"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      {items.length > 0 ? (
        <ScrollView horizontal contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {FILTERS.map(({ id, label }) => (
            <BlinkrChip accessibilityLabel={`${label}, ${counts[id]} sonuç`} key={id} label={`${label} ${counts[id]}`} onPress={() => setFilter(id)} selected={filter === id} />
          ))}
        </ScrollView>
      ) : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice} Son liste gösteriliyor.</Text> : null}
      {visible.length === 0 ? (
        <View style={styles.centerFill}>
          <BlinkrEmptyState
            action={items.length === 0 && onCreateSignal ? { label: 'Sinyal paylaş', onPress: onCreateSignal } : undefined}
            description={items.length === 0
              ? 'Son 3 saatte 1,5 km içinde paylaşılmış bir sinyal görünmüyor. İlk paylaşan sen olabilirsin.'
              : 'Bu filtreye uyan taze sinyal yok. Başka bir filtre dene.'}
            icon={<Compass color={colors.textSecondary} size={34} />}
            title={items.length === 0 ? 'Çevrende taze sinyal yok' : 'Bu filtrede sonuç yok'}
          />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.list, { paddingBottom: bottomBarClearance(insets.bottom) + spacing.lg }]}
          data={visible}
          keyExtractor={(item) => item.key}
          refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); void load(true); }} refreshing={refreshing} tintColor={colors.primary} />}
          renderItem={({ item, index }) => (
            <ActivityRow
              index={index}
              item={item}
              onPress={() => { if (item.place) onOpenPlace(item.place); else if (item.signal) onOpenSignal(item.signal); }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: { gap: 2, paddingBottom: spacing.md, paddingHorizontal: spacing.lg },
  title: { ...typography.headline, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  centerFill: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
  loadingBlock: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  status: { ...typography.caption, color: colors.textSecondary },
  filterScroll: { flexGrow: 0 },
  filters: { gap: spacing.sm, paddingBottom: spacing.md, paddingHorizontal: spacing.lg },
  notice: { ...typography.caption, color: colors.textSecondary, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  list: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  card: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 68, padding: spacing.md },
  symbol: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.md, height: 44, justifyContent: 'center', width: 44 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { ...typography.heading, color: colors.text, fontSize: 16, lineHeight: 21 },
  cardSummary: { ...typography.bodyStrong, fontSize: 14, lineHeight: 19 },
  metaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  meta: { ...typography.caption, color: colors.textSecondary },
  metaDot: { ...typography.caption, color: colors.textSecondary },
  cardEnd: { alignItems: 'flex-end', gap: spacing.xs },
  liveChip: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  liveText: { ...typography.label, color: colors.primary },
  count: { ...typography.caption, color: colors.textSecondary },
});
