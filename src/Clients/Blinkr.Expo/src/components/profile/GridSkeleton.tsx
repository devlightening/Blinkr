import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { GRID_GAP, gridTileHeight } from '../../profileGrid';
import { colors } from '../../theme';
import { tx } from '../../i18n/tx';

/** Doc P8: while the signals load, tile-shaped placeholders (3:4) breathe softly instead of a spinner. */
export function GridSkeleton({ tileWidth, count = 6 }: { tileWidth: number; count?: number }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    if (!reduceMotion) pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [pulse, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }), [pulse]);
  return (
    <View accessibilityLabel={tx('profile:me.postsLoading', 'Sinyallerin yükleniyor')} accessible style={styles.grid}>
      {Array.from({ length: count }, (_, index) => (
        <Animated.View key={index} style={[styles.tile, { height: gridTileHeight(tileWidth), width: tileWidth }, style]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: { backgroundColor: colors.surfaceElevated },
});
