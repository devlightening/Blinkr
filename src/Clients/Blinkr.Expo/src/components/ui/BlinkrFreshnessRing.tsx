import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const STROKE_WIDTH = 2.5;

type Props = {
  size: number;
  /** 1 = just posted, 0 = expired - see `freshnessProgress` in `productPresentation.ts`. */
  progress: number;
  color: string;
  /** A gentle pulse for signals still genuinely young - see `isFreshnessPulseDue`. */
  live?: boolean;
  /** Honours the OS "Hareketi Azalt" setting; the ring still shows, it just stops pulsing. */
  reduceMotion?: boolean;
  children?: ReactNode;
};

/**
 * The one bold, signature element of the redesign (03_DESIGN_SYSTEM.md §6): a thin ring around an
 * avatar, pin or card header showing how much of a signal's life is left, decreasing clockwise. Nothing
 * else in the app is this expressive on purpose - everything around it stays calm.
 *
 * The arc itself is drawn straight from `progress` (no per-frame animation - freshness moves slowly,
 * a React re-render on change is plenty); only the live pulse is animated, the same
 * `useAnimatedStyle`+opacity approach already proven in `BlinkrSkeleton` for this web harness.
 */
export function FreshnessRing({ size, progress, color, live = false, reduceMotion = false, children }: Props) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 1));
  const radius = size / 2 - STROKE_WIDTH;
  const circumference = 2 * Math.PI * radius;
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!live || reduceMotion) { pulse.value = withTiming(1, { duration: 200 }); return; }
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1000 }), withTiming(0.55, { duration: 1000 })), -1, true);
  }, [live, reduceMotion, pulse]);

  const animatedRingStyle = useAnimatedStyle(() => ({ opacity: pulse.value }), []);

  return (
    <View style={[styles.host, { height: size, width: size }]}>
      <Animated.View style={[StyleSheet.absoluteFill, animatedRingStyle]}>
        <Svg height={size} width={size}>
          <Circle cx={size / 2} cy={size / 2} fill="none" opacity={0.18} r={radius} stroke={color} strokeWidth={STROKE_WIDTH} />
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            origin={`${size / 2}, ${size / 2}`}
            r={radius}
            rotation={-90}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            strokeLinecap="round"
            strokeWidth={STROKE_WIDTH}
          />
        </Svg>
      </Animated.View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', justifyContent: 'center' },
});
