import { forwardRef } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { springs } from '../theme';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  /** How much to shrink on press. Defaults to a subtle 0.96 - use 0.9 for chunky primary buttons. */
  pressScale?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Drop-in replacement for react-native's Pressable that adds a spring-based
 * press-down/release scale, matching the energetic, tactile feel of
 * BeReal/Snapchat-style interfaces. Every primary tap target in the app
 * should use this instead of the plain Pressable.
 */
export const AnimatedPressable = forwardRef<React.ElementRef<typeof Pressable>, Props>(
  ({ pressScale = 0.96, style, onPressIn, onPressOut, ...rest }, ref) => {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }), []);

    return (
      <AnimatedPressableBase
        ref={ref}
        onPressIn={(e) => {
          scale.value = withSpring(pressScale, springs.snappy);
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
