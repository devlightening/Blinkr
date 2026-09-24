import { List, Navigation2, RefreshCw, Search } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { MapLayer } from '../../mapSelection';
import { colors, motion, radii, shadowFloat, shadowSoft, sizes, spacing, typography } from '../../theme';
import type { SignalType } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { HeaderAvatar } from '../ui/BlinkrHeader';
import { MapFilterRow } from './MapLayerBar';
import { tx } from '../../i18n/tx';

type Props = {
  userId: string;
  userName: string;
  avatarKey?: string | null;
  layer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  /** Multi-select type filter (04 §1.2); empty means no filter. Hidden on the `places` (Yerler)
   * layer since that layer lists the whole catalogue regardless of activity type. */
  activeTypeFilter: ReadonlySet<SignalType>;
  onToggleTypeFilter: (type: SignalType) => void;
  onOpenProfile: () => void;
  /** Opens the full-screen tx('map:search.placeholder', 'Nereye gidiyorsun?') search. */
  onOpenSearch: () => void;
  /**
   * tx('map:top.scan', 'Bu alanı tara') is a manual fallback only — the viewport auto-loads once it settles
   * (sinyal-mvp-plan 04 §1.2). This shows only when that auto-load actually failed, so there is
   * still a way to retry; it is not offered on every pan any more.
   */
  scanAvailable: boolean;
  isLoading: boolean;
  onScan: () => void;
  onLocate: () => void;
  /** plan-devam G6: the same places and signals as a list (Keşfet > Yakınımda), for people who don't use the map. */
  onShowList?: () => void;
  /** Status bar / notch height (`useSafeAreaInsets().top`). Without it the search bar sits under the
   * status bar on a real device - invisible in the browser harness, which has no notch to reproduce it
   * (sinyal-mvp-plan AUDIT #11). */
  topInset: number;
};

/** Header, layer filter and the scan / locate row that float over the map. */
export function MapTopChrome({ userId, userName, avatarKey, layer, onLayerChange, activeTypeFilter, onToggleTypeFilter, onOpenProfile, onOpenSearch, scanAvailable, isLoading, onScan, onLocate, onShowList, topInset }: Props) {
  return (
    <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: Math.max(topInset, spacing.sm) }]}>
      <View style={styles.searchBar}>
        <AnimatedPressable accessibilityLabel={tx('map:top.searchA11y', 'Yer ara: nereye gidiyorsun?')} accessibilityRole="search" onPress={onOpenSearch} pressScale={0.99} style={styles.searchField}>
          <Search color={colors.textSecondary} size={18} />
          <Text numberOfLines={1} style={styles.searchPlaceholder}>{tx('map:search.placeholder', 'Nereye gidiyorsun?')}</Text>
        </AnimatedPressable>
        <HeaderAvatar avatarKey={avatarKey} onPress={onOpenProfile} userId={userId} userName={userName} />
      </View>
      <MapFilterRow activeTypes={activeTypeFilter} layer={layer} onLayerChange={onLayerChange} onToggleType={onToggleTypeFilter} />

      <View pointerEvents="box-none" style={styles.scanRow}>
        {scanAvailable ? (
          <Animated.View entering={FadeIn.duration(motion.base)}>
            <AnimatedPressable accessibilityLabel={tx('map:top.scan', 'Bu alanı tara')} accessibilityRole="button" disabled={isLoading} onPress={onScan} pressScale={0.97} style={styles.scanButton}>
              {isLoading ? <ActivityIndicator color={colors.background} size="small" /> : <RefreshCw color={colors.background} size={16} strokeWidth={2.4} />}
              <Text style={styles.scanText}>{isLoading ? tx('map:top.scanning', 'Taranıyor') : tx('map:top.scan', 'Bu alanı tara')}</Text>
            </AnimatedPressable>
          </Animated.View>
        ) : isLoading ? (
          <View style={styles.loadingBadge}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingText}>{tx('map:top.updating', 'Çevre güncelleniyor')}</Text>
          </View>
        ) : null}
        <View pointerEvents="box-none" style={styles.sideButtons}>
        {onShowList ? (
          <AnimatedPressable accessibilityLabel={tx('map:a11y.showList', 'Liste olarak göster')} accessibilityRole="button" onPress={onShowList} pressScale={0.95} style={styles.locateButton} testID="map-show-list">
            <List color={colors.text} size={19} />
          </AnimatedPressable>
        ) : null}
        <AnimatedPressable accessibilityLabel={tx('map:top.locate', 'Konumuma git')} accessibilityRole="button" onPress={onLocate} pressScale={0.95} style={styles.locateButton}>
          <Navigation2 color={colors.text} fill={colors.text} size={19} strokeWidth={2} />
        </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { left: 0, paddingHorizontal: 12, position: 'absolute', right: 0, top: 0 },
  // A single soft pill: no stroke, a wide low shadow - it floats over the map instead of sitting on it.
  searchBar: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, flexDirection: 'row', gap: spacing.sm, minHeight: 52, paddingLeft: spacing.lg, paddingRight: 6, paddingVertical: 6, ...shadowFloat },
  searchField: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: sizes.touch },
  searchPlaceholder: { ...typography.body, color: colors.textSecondary, flex: 1, fontWeight: '600' },
  scanRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'center', minHeight: 44 },
  scanButton: { alignItems: 'center', backgroundColor: colors.text, borderRadius: radii.pill, flexDirection: 'row', gap: 8, minHeight: 40, paddingHorizontal: 16, ...shadowSoft },
  scanText: { ...typography.callout, color: colors.background, fontWeight: '700' },
  locateButton: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, height: 46, justifyContent: 'center', width: 46, ...shadowSoft },
  sideButtons: { gap: spacing.sm, position: 'absolute', right: 0, top: 0 },
  loadingBadge: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, flexDirection: 'row', gap: 8, minHeight: 36, paddingHorizontal: 14, ...shadowSoft },
  loadingText: { ...typography.caption, color: colors.text, fontWeight: '700' },
});
