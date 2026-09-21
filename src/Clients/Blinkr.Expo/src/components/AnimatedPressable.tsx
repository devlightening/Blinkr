import { forwardRef } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springs } from '../theme';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);
const MIN_PRESS_SCALE = 0.95;

type Props = PressableProps & {
  /** How much to shrink on press. Subtle by default; values below 0.95 are raised to 0.95 so nothing feels toy-like. */
  pressScale?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Drop-in replacement for react-native's Pressable that adds a soft, critically damped press-down
 * scale. Every primary tap target in the app uses this instead of the plain Pressable.
 */
export const AnimatedPressable = forwardRef<React.ElementRef<typeof Pressable>, Props>(
  ({ pressScale = 0.97, style, onPressIn, onPressOut, ...rest }, ref) => {
    const target = Math.max(pressScale, MIN_PRESS_SCALE);
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }), []);

    return (
      <AnimatedPressableBase
        ref={ref}
        onPressIn={(e) => {
          scale.value = withSpring(target, springs.snappy);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withSpring(1, springs.snappy);
          onPressOut?.(e);
        }}
        style={[style, animatedStyle]}
        {...rest}
      />
    );
  },
);
AnimatedPressable.displayName = 'AnimatedPressable';
