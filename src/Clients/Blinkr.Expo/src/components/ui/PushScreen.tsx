import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, springs } from '../../theme';

export type PushScreenHandle = {
  /** Slides the page out to the right, then calls onBack. Use it for the back arrow. */
  back: () => void;
};

type Props = {
  /** Called once the page has left the screen; the owner unmounts it then. */
  onBack: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Off while something inside needs horizontal drags (a dialog asking for confirmation, a carousel being dragged). */
  gestureEnabled?: boolean;
  /**
   * Handle Android's back button here (default). Pass false when the screen walks back through its own inner pages
   * first and calls `back()` itself.
   */
  handleHardwareBack?: boolean;
};

const OPEN_MS = 280;
const CLOSE_MS = 220;
/** Dragged further than this share of the width, or flicked, the page goes back. */
const BACK_SHARE = 0.32;
const BACK_VELOCITY = 650;

/**
 * Instagram-style pushed page: it slides in from the right over the screen the person came from, which stays mounted
 * underneath - same scroll position, same open card - so going back lands exactly where they were. A rightward drag
 * anywhere on the page pulls it with the finger and shows that screen beneath (dimmed a little, lighter as the page
 * leaves); letting go past a third of the width or with a flick goes back, otherwise it springs home. The back arrow
 * (via the ref) and Android's back button use the same slide out. Vertical scrolling inside is not affected: the drag
 * only starts on a clearly sideways move to the right. With "Reduce Motion" the page appears and leaves without sliding.
 */
export const PushScreen = forwardRef<PushScreenHandle, Props>(function PushScreen(
  { onBack, children, style, testID, gestureEnabled = true, handleHardwareBack = true },
  ref,
) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(reduceMotion ? 0 : width);
  const leaving = useRef(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const finish = useCallback(() => { onBackRef.current(); }, []);

  useEffect(() => {
    x.value = reduceMotion ? 0 : withTiming(0, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (reduceMotion) { finish(); return; }
    x.value = withTiming(width, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }, (done) => { if (done) runOnJS(finish)(); });
  }, [finish, reduceMotion, width, x]);

  useImperativeHandle(ref, () => ({ back }), [back]);

  useEffect(() => {
    if (!handleHardwareBack) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
  }, [back, handleHardwareBack]);

  const markLeaving = () => { leaving.current = true; };
  const pan = Gesture.Pan()
    .enabled(gestureEnabled)
    .activeOffsetX(16)
    .failOffsetX(-12)
    .failOffsetY([-14, 14])
    .onUpdate((e) => { x.value = Math.max(0, e.translationX); })
    .onEnd((e) => {
      if (e.translationX > width * BACK_SHARE || e.velocityX > BACK_VELOCITY) {
        runOnJS(markLeaving)();
        x.value = withTiming(width, { duration: CLOSE_MS, easing: Easing.out(Easing.cubic) }, (done) => { if (done) runOnJS(finish)(); });
      } else {
        x.value = withSpring(0, springs.sheet);
      }
    });

  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }), [x]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, width], [1, 0]) }), [x, width]);

  return (
    <View pointerEvents="box-none" style={[styles.host, style]} testID={testID}>
      <Animated.View pointerEvents="none" style={[styles.scrim, scrimStyle]} />
      <GestureDetector gesture={pan}>
        <Animated.View collapsable={false} style={[styles.page, pageStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, zIndex: 20 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrimSoft },
  // The left edge casts a soft shadow on the screen underneath while it is dragged, as on iOS.
  page: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, elevation: 12, shadowColor: colors.shadow, shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.18, shadowRadius: 12 },
});
