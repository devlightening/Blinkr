import { memo, useEffect, useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import type { LiveKind } from '../../live/liveState';
import { colors, gradients, liveColors, liveRingSize, liveRingStroke, liveTones, withAlpha } from '../../theme';

export type LiveRingProps = {
  kind: LiveKind;
  /** 0..1: the filled part of the ring (how fresh the information is). */
  freshness: number;
  size?: number;
  /** Fresh live information in a list. Never on a map marker (its bitmap does not animate). */
  pulse?: boolean;
  /** No live confirmation, estimated from opening hours: a dashed full ring instead of an arc. */
  estimated?: boolean;
  /** The disc behind the centre icon; defaults to the surface the ring sits on. */
  centerColor?: string;
  /** Without a label the ring is decorative: the parent row carries the label. */
  accessibilityLabel?: string;
  /** The place-type icon. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const HALO = 6;

/** Blinkr's signature: colour = state, arc = freshness, centre icon = place type. Only an event ring wears the brand gradient. */
function LiveRingBase({
  kind, freshness, size = liveRingSize.card, pulse = false, estimated = false, centerColor, accessibilityLabel, children, style, testID,
}: LiveRingProps) {
  const gradientId = `lr${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const color = liveColors[kind];
  const stroke = liveRingStroke;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = Math.max(0, Math.min(1, freshness));
  const isEvent = kind === 'event' && !estimated;
  const showArc = !estimated && fraction > 0;
  const showPulse = pulse && showArc;

  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true };

  return (
    <View style={[{ width: size, height: size }, style]} testID={testID} {...a11y}>
      {showPulse ? <PulseHalo color={color} size={size} /> : null}
      <Svg width={size} height={size} style={styles.startAtTop}>
        {isEvent ? (
          <Defs>
            <LinearGradient id={gradientId} x1={0} y1={0} x2={1} y2={1}>
              {gradients.brand.map((stop, i, all) => <Stop key={stop} offset={i / (all.length - 1)} stopColor={stop} />)}
            </LinearGradient>
          </Defs>
        ) : null}
        {estimated ? null : <Circle cx={size / 2} cy={size / 2} r={r} stroke={liveTones.track} strokeWidth={stroke} fill="none" />}
        {estimated ? (
          <Circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.6} strokeWidth={stroke}
            strokeDasharray={`${stroke * 1.6} ${stroke * 1.6}`}
          />
        ) : null}
        {showArc ? (
          <Circle
            cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
            stroke={isEvent ? `url(#${gradientId})` : color}
            strokeDasharray={`${circumference * fraction} ${circumference}`}
          />
        ) : null}
      </Svg>
      <View style={[styles.center, { margin: stroke + 1, backgroundColor: centerColor ?? colors.surface }]}>{children}</View>
    </View>
  );
}

export const LiveRing = memo(LiveRingBase);

/** Mounted only while a list ring pulses, so idle rings (and every map marker) carry no animation state at all. */
function PulseHalo({ color, size }: { color: string; size: number }) {
  const reduce = useReducedMotion();
  const k = useSharedValue(0);
  useEffect(() => {
    if (reduce) return undefined;
    k.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 700 })), -1, false);
    return () => { k.value = 0; };
  }, [reduce, k]);
  const haloStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.22 * k.value }], opacity: 0.55 - 0.4 * k.value }), [k]);
  if (reduce) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.halo, { top: -HALO, left: -HALO, width: size + HALO * 2, height: size + HALO * 2, borderColor: withAlpha(color, 0.45) }, haloStyle]}
    />
  );
}

const styles = StyleSheet.create({
  /** An arc starts at 3 o'clock; turning the whole drawing starts it at 12 (so the gradient above is drawn pre-rotated: it ends up bottom-left to top-right). */
  startAtTop: { transform: [{ rotate: '-90deg' }] },
  halo: { position: 'absolute', borderRadius: 999, borderWidth: HALO },
  center: { ...StyleSheet.absoluteFill, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
