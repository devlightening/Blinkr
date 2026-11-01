import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { springs } from '../../theme';

/**
 * The moment a reaction lands on a post (double tap = ❤️, or an emoji from the picker): the emoji pops over the
 * post with its own little motion and a ring of small copies flies out, then everything fades. Purely decorative
 * (pointerEvents none); `trigger` replays it. With "reduce motion" it only fades in and out.
 */
type Props = { emoji: string; trigger: number; size?: number };

const PARTICLES = 6;

// Each emote moves in its own way, so a 🔥 does not feel like a 😢.
const motionOf = (emoji: string) => {
  switch (emoji) {
    case '🔥': return { rise: -70, spin: 0, wobble: 6 };
    case '😂': return { rise: -40, spin: 18, wobble: 0 };
    case '😢': return { rise: 40, spin: 0, wobble: 0 };
    case '👏': return { rise: -30, spin: 0, wobble: 10 };
    case '😮': return { rise: -20, spin: 0, wobble: 0 };
    default: return { rise: -50, spin: 0, wobble: 0 };
  }
};

function Particle({ emoji, index, trigger, reduce }: { emoji: string; index: number; trigger: number; reduce: boolean }) {
  const p = useSharedValue(0);
  const angle = (index / PARTICLES) * Math.PI * 2 - Math.PI / 2;
  useEffect(() => {
    if (trigger === 0 || reduce) return;
    p.value = 0;
    p.value = withDelay(60, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 1 - p.value,
    transform: [
      { translateX: Math.cos(angle) * 70 * p.value },
      { translateY: Math.sin(angle) * 70 * p.value },
      { scale: 0.4 + 0.3 * (1 - p.value) },
    ],
  }), [angle]);
  return <Animated.Text allowFontScaling={false} style={[styles.particle, style]}>{emoji}</Animated.Text>;
}

export function ReactionBurst({ emoji, trigger, size = 92 }: Props) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(0);
  const lift = useSharedValue(0);
  const turn = useSharedValue(0);
  const fade = useSharedValue(0);
  const motion = motionOf(emoji);

  useEffect(() => {
    if (trigger === 0) return;
    if (reduce) {
      fade.value = withSequence(withTiming(1, { duration: 120 }), withDelay(400, withTiming(0, { duration: 200 })));
      scale.value = 1;
      return;
    }
    fade.value = withSequence(withTiming(1, { duration: 80 }), withDelay(520, withTiming(0, { duration: 260 })));
    scale.value = withSequence(withSpring(1.25, { ...springs.bouncy, reduceMotion: ReduceMotion.System }), withSpring(1, springs.bouncy));
    lift.value = 0;
    lift.value = withDelay(260, withTiming(motion.rise, { duration: 560, easing: Easing.out(Easing.quad) }));
    turn.value = 0;
    if (motion.spin) turn.value = withSequence(withTiming(motion.spin, { duration: 120 }), withTiming(-motion.spin, { duration: 160 }), withTiming(0, { duration: 140 }));
    else if (motion.wobble) turn.value = withSequence(withTiming(motion.wobble, { duration: 70 }), withTiming(-motion.wobble, { duration: 70 }), withTiming(motion.wobble, { duration: 70 }), withTiming(0, { duration: 70 }));
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const main = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: lift.value }, { scale: scale.value }, { rotate: `${turn.value}deg` }],
  }), []);

  if (trigger === 0) return null;
  return (
    <View pointerEvents="none" style={styles.host} testID="reaction-burst">
      {Array.from({ length: PARTICLES }, (_, i) => <Particle emoji={emoji} index={i} key={`${trigger}-${i}`} reduce={reduce} trigger={trigger} />)}
      <Animated.Text allowFontScaling={false} style={[{ fontSize: size, lineHeight: size * 1.2 }, main]}>{emoji}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  particle: { fontSize: 26, position: 'absolute' },
});
