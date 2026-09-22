import { Navigation2, RefreshCw, Search } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { MapLayer } from '../../mapSelection';
import { colors, motion, radii, shadowSoft, sizes, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { HeaderAvatar } from '../ui/BlinkrHeader';
import { MapLayerBar } from './MapLayerBar';

type Props = {
  userId: string;
  userName: string;
  avatarKey?: string | null;
  /** Markers currently shown by the selected layer (places + coordinate signals). */
  visibleCount: number;
  layer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  onOpenProfile: () => void;
  /** Opens the full-screen "Nereye gidiyorsun?" search. */
  onOpenSearch: () => void;
  /** "Bu alanı tara" appears only after the viewport moved away from the loaded data. */
  scanAvailable: boolean;
  isLoading: boolean;
  onScan: () => void;
  onLocate: () => void;
  /** Status bar / notch height (`useSafeAreaInsets().top`). Without it the search bar sits under the
   * status bar on a real device - invisible in the browser harness, which has no notch to reproduce it
   * (sinyal-mvp-plan AUDIT #11). */
  topInset: number;
};

/** Header, layer filter and the scan / locate row that float over the map. */
export function MapTopChrome({ userId, userName, avatarKey, visibleCount, layer, onLayerChange, onOpenProfile, onOpenSearch, scanAvailable, isLoading, onScan, onLocate, topInset }: Props) {
  return (
    <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: Math.max(topInset, spacing.sm) }]}>
      <View style={styles.searchBar}>
        <AnimatedPressable accessibilityLabel="Yer ara: nereye gidiyorsun?" accessibilityRole="search" onPress={onOpenSearch} pressScale={0.99} style={styles.searchField}>
          <Search color={colors.textSecondary} size={18} />
          <Text numberOfLines={1} style={styles.searchPlaceholder}>Nereye gidiyorsun?</Text>
        </AnimatedPressable>
        <HeaderAvatar avatarKey={avatarKey} onPress={onOpenProfile} userId={userId} userName={userName} />
      </View>
      <MapLayerBar onChange={onLayerChange} value={layer} />

      <View pointerEvents="box-none" style={styles.scanRow}>
        {scanAvailable ? (
          <Animated.View entering={FadeIn.duration(motion.base)}>
            <AnimatedPressable accessibilityLabel="Bu alanı tara" accessibilityRole="button" disabled={isLoading} onPress={onScan} pressScale={0.97} style={styles.scanButton}>
              {isLoading ? <ActivityIndicator color={colors.text} size="small" /> : <RefreshCw color={colors.text} size={17} />}
              <Text style={styles.scanText}>{isLoading ? 'Taranıyor' : 'Bu alanı tara'}</Text>
            </AnimatedPressable>
          </Animated.View>
        ) : isLoading ? (
          <View style={styles.loadingBadge}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingText}>Çevre güncelleniyor</Text>
          </View>
        ) : (
          <View style={styles.loadingBadge}>
            <Text style={styles.loadingText}>{visibleCount} görünür</Text>
          </View>
        )}
        <AnimatedPressable accessibilityLabel="Konumuma git" accessibilityRole="button" onPress={onLocate} pressScale={0.95} style={styles.locateButton}>
          <Navigation2 color={colors.text} fill={colors.text} size={19} strokeWidth={2} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { left: 0, paddingHorizontal: 12, position: 'absolute', right: 0, top: 0 },
  searchBar: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 56, paddingLeft: spacing.md, paddingRight: spacing.sm, paddingVertical: spacing.sm, ...shadowSoft },
  searchField: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: sizes.touch },
  searchPlaceholder: { ...typography.body, color: colors.textSecondary, flex: 1 },
  scanRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'center', marginTop: 10, minHeight: 44 },
  scanButton: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 16, ...shadowSoft },
  scanText: { ...typography.bodyStrong, color: colors.text, fontSize: 14 },
  locateButton: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: 44, justifyContent: 'center', position: 'absolute', right: 0, top: 0, width: 44, ...shadowSoft },
  loadingBadge: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 40, paddingHorizontal: 14, ...shadowSoft },
  loadingText: { ...typography.caption, color: colors.text, fontWeight: '600' },
});
