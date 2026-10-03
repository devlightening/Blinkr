import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { CornerUpLeft } from 'lucide-react-native';

import { tap } from '../../haptics';
import { colors, radii, springs } from '../../theme';

/** How far the bubble follows the finger at most, and where letting go means "reply". */
const MAX_PULL = 84;
const REPLY_AT = 58;
/** The bubble moves a little slower than the finger, so it feels attached rather than dragged off. */
const RESISTANCE = 0.6;

/**
 * Doc S8: pull a message bubble to the right to reply to it, the most used chat gesture, no longer hidden in the
 * long-press menu. The reply arrow fades in behind the bubble and a light tap says "far enough"; letting go there
 * starts the quoted reply, anywhere short of it the bubble springs back and nothing happens.
 *
 * The conversation is a pushed page whose own rightward drag goes back (`ui/PushScreen`, activates at 16 px). This
 * drag activates earlier (10 px), so a drag that starts on a bubble replies and a drag anywhere else still goes back.
 * Vertical moves fail it at once, so scrolling the thread is unaffected.
 */
export function SwipeToReply({ enabled, onReply, children }: { enabled: boolean; onReply: () => void; children: React.ReactNode }) {
  const x = useSharedValue(0);
  const armed = useSharedValue(false);
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;
  const fire = () => onReplyRef.current();

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(10)
    .failOffsetX(-10)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const pulled = Math.min(MAX_PULL, Math.max(0, e.translationX * RESISTANCE));
      x.value = pulled;
      if (pulled >= REPLY_AT && !armed.value) { armed.value = true; runOnJS(tap)(); }
      else if (pulled < REPLY_AT && armed.value) armed.value = false;
    })
    .onFinalize(() => {
      if (armed.value) runOnJS(fire)();
      armed.value = false;
      x.value = withSpring(0, springs.sheet);
    });

  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }), [x]);
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [12, REPLY_AT], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(x.value, [12, REPLY_AT], [0.6, 1], 'clamp') }],
  }), [x]);

  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false}>
        <Animated.View pointerEvents="none" style={[styles.icon, iconStyle]}>
          <CornerUpLeft color={colors.primary} size={16} strokeWidth={2.2} />
        </Animated.View>
        <Animated.View style={bubbleStyle}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', backgroundColor: colors.primaryTint, borderRadius: radii.pill, height: 28, justifyContent: 'center', left: 0, marginTop: -14, position: 'absolute', top: '50%', width: 28 },
});
