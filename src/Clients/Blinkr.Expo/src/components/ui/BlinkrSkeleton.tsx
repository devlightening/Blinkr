import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { colors, radii, spacing } from '../../theme';

type Props = {
  /** `person`: avatar + two lines (chat, friends). `card`: icon tile + three lines (nearby, places). */
  variant?: 'person' | 'card';
  rows?: number;
  /** Read out by screen readers while content loads. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * What a list looks like while it loads: the shape of the rows to come, gently pulsing. It calms the screen down compared
 * with a lone spinner and shows that something specific is on its way. Purely visual; nothing here is data.
 */
export function SkeletonList({ variant = 'person', rows = 5, accessibilityLabel = 'Yükleniyor', style }: Props) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) })), -1);
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }), []);

  return (
    <Animated.View accessibilityLabel={accessibilityLabel} accessibilityRole="progressbar" style={[styles.list, animated, style]}>
      {Array.from({ length: rows }, (_, index) => (
        variant === 'person' ? (
          <View key={index} style={styles.person}>
            <View style={styles.avatar} />
            <View style={styles.lines}>
              <View style={[styles.line, { width: `${48 + ((index * 13) % 30)}%` }]} />
              <View style={[styles.lineSmall, { width: `${30 + ((index * 17) % 35)}%` }]} />
            </View>
          </View>
        ) : (
          <View key={index} style={styles.card}>
            <View style={styles.tile} />
            <View style={styles.lines}>
              <View style={[styles.line, { width: `${45 + ((index * 11) % 30)}%` }]} />
              <View style={[styles.lineSmall, { width: `${35 + ((index * 19) % 35)}%` }]} />
              <View style={[styles.lineSmall, { width: '55%' }]} />
            </View>
          </View>
        )
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  person: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 60 },
  avatar: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 48, width: 48 },
  card: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  tile: { backgroundColor: colors.surfaceElevated, borderRadius: radii.md, height: 44, width: 44 },
  lines: { flex: 1, gap: spacing.sm },
  line: { backgroundColor: colors.surfaceElevated, borderRadius: 6, height: 12 },
  lineSmall: { backgroundColor: colors.surfaceElevated, borderRadius: 6, height: 10, opacity: 0.8 },
});
