import { forwardRef } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { pressScale as DEFAULT_PRESS_SCALE, springs } from '../theme';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);
const MIN_PRESS_SCALE = 0.94;
/** The press spring follows the device's "Reduce motion" setting (plan-devam B7/G8). */
const PRESS_SPRING = { ...springs.snappy, reduceMotion: ReduceMotion.System };

type Props = PressableProps & {
  /** How much to shrink on press: 0.96 by default (B7); values below 0.94 are raised to 0.94 so nothing feels toy-like. */
  pressScale?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Drop-in replacement for react-native's Pressable that adds a tight, lively press-down scale. Every primary tap target in the app uses this instead of the plain Pressable.
 */
export const AnimatedPressable = forwardRef<React.ElementRef<typeof Pressable>, Props>(
  ({ pressScale = DEFAULT_PRESS_SCALE, style, onPressIn, onPressOut, ...rest }, ref) => {
    const target = Math.max(pressScale, MIN_PRESS_SCALE);
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }), []);

    return (
      <AnimatedPressableBase
        ref={ref}
        onPressIn={(e) => {
          scale.value = withSpring(target, PRESS_SPRING);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withSpring(1, PRESS_SPRING);
          onPressOut?.(e);
        }}
        style={[style, animatedStyle]}
        {...rest}
      />
    );
  },
);
AnimatedPressable.displayName = 'AnimatedPressable';
