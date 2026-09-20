import { Navigation2, RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { MapLayer } from '../../mapSelection';
import { colors, radii, shadow, shadowSoft } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrHeader, HeaderAvatar } from '../ui/BlinkrHeader';
import { MapLayerBar } from './MapLayerBar';

type Props = {
  userName: string;
  /** Markers currently shown by the selected layer (places + coordinate signals). */
  visibleCount: number;
  layer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  onOpenProfile: () => void;
  /** "Bu alanı tara" appears only after the viewport moved away from the loaded data. */
  scanAvailable: boolean;
  isLoading: boolean;
  onScan: () => void;
  onLocate: () => void;
};

/** Header, layer filter and the scan / locate row that float over the map. */
export function MapTopChrome({ userName, visibleCount, layer, onLayerChange, onOpenProfile, scanAvailable, isLoading, onScan, onLocate }: Props) {
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <BlinkrHeader
        right={<HeaderAvatar onPress={onOpenProfile} userName={userName} />}
        subtitle={
          <View style={styles.liveStatus}>
            <View style={styles.liveDot} />
            <Text style={styles.liveStatusText}>CANLI ÇEVRE</Text>
            <Text style={styles.visibleCount}>· {visibleCount} görünür</Text>
          </View>
        }
      />
      <MapLayerBar onChange={onLayerChange} value={layer} />

      <View pointerEvents="box-none" style={styles.scanRow}>
        {scanAvailable ? (
          <Animated.View entering={FadeInDown.duration(220).springify().damping(16)}>
            <AnimatedPressable accessibilityLabel="Bu alanı tara" accessibilityRole="button" disabled={isLoading} onPress={onScan} pressScale={0.94} style={styles.scanButton}>
              {isLoading ? <ActivityIndicator color={colors.text} size="small" /> : <RefreshCw color={colors.text} size={19} />}
              <Text style={styles.scanText}>{isLoading ? 'Taranıyor' : 'Bu alanı tara'}</Text>
            </AnimatedPressable>
          </Animated.View>
        ) : isLoading ? (
          <View style={styles.loadingBadge}>
            <ActivityIndicator color={colors.mint} size="small" />
            <Text style={styles.loadingText}>Çevre güncelleniyor</Text>
          </View>
        ) : null}
        <AnimatedPressable accessibilityLabel="Konumuma git" accessibilityRole="button" onPress={onLocate} pressScale={0.88} style={styles.locateButton}>
          <Navigation2 color={colors.text} fill={colors.text} size={22} strokeWidth={2.2} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { left: 0, paddingHorizontal: 12, position: 'absolute', right: 0, top: 0 },
  liveStatus: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', marginTop: 1 },
  liveDot: { backgroundColor: colors.danger, borderRadius: 5, height: 8, marginRight: 6, width: 8 },
  liveStatusText: { color: colors.mint, fontSize: 13, fontWeight: '800' },
  visibleCount: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginLeft: 4 },
  scanRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'center', marginTop: 10, minHeight: 56 },
  scanButton: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 52, paddingHorizontal: 20, ...shadow },
  scanText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  locateButton: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: 52, justifyContent: 'center', position: 'absolute', right: 0, top: 0, width: 52, ...shadow },
  loadingBadge: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 16, ...shadowSoft },
  loadingText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
