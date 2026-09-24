import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { colors, motion, radii, shadowSoft, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

/** `accessibilityLabel` names a short label (such as "#") for screen readers. */
type Option<T extends string> = { value: T; label: string; accessibilityLabel?: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/** 2-4 equal segments with a sliding highlight behind the selected one (03_DESIGN_SYSTEM.md §7). */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segmentWidth = width / Math.max(1, options.length);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(index * segmentWidth, { duration: motion.fast }) }],
  }), [index, segmentWidth]);

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="tablist" onLayout={onLayout} style={styles.track}>
      {width > 0 ? <Animated.View style={[styles.indicator, { width: segmentWidth }, indicatorStyle]} /> : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <AnimatedPressable
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="tab"
            aria-selected={selected}
            key={option.value}
            onPress={() => onChange(option.value)}
            pressScale={0.98}
            style={styles.segment}
          >
            <Text numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flexDirection: 'row', padding: 3 },
  indicator: { backgroundColor: colors.surface, borderRadius: radii.pill, bottom: 3, left: 3, position: 'absolute', top: 3, ...shadowSoft },
  segment: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 36, paddingHorizontal: spacing.sm },
  label: { ...typography.label, color: colors.textSecondary },
  labelSelected: { color: colors.text },
});
