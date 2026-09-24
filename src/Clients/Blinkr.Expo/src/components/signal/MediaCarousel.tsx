import { Heart, Play } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { toAbsoluteUrl } from '../../api';
import { mediaFrame, type CardMedia } from '../../signalCard';
import { VideoPlayer } from './VideoPlayer';
import { colors, media as overlay, radii, spacing, springs } from '../../theme';

type Props = {
  items: CardMedia[];
  width: number;
  /** Single tap: open the full-screen viewer at this index. */
  onOpen: (index: number) => void;
  /** Double tap: like (Instagram style). */
  onDoubleTap?: () => void;
  /** Drawn over the bottom-left corner (the TypeBadge). */
  overlayStart?: React.ReactNode;
  accessibilityLabel?: string;
};

const DOUBLE_TAP_MS = 260;

/** Muted, looping video in the card with a sound toggle (V2-2); the full page and viewer have full controls. */
function CardVideo({ uri, fit, active }: { uri: string; fit: 'cover' | 'contain'; active: boolean }) {
  return <VideoPlayer active={active} controls="minimal" fit={fit} testID="card-video" uri={uri} />;
}

/**
 * The card's media (plan-devam C4/C6): the frame follows the first item's own ratio between 9:16 and 4:5, and every
 * item is drawn whole - a wider or taller picture sits "contain" on a blurred copy of itself, never cropped. Swipe
 * between items (the carousel wins over the card pager), tap to open full screen, double-tap to like with a heart.
 */
export function MediaCarousel({ items, width, onOpen, onDoubleTap, overlayStart, accessibilityLabel }: Props) {
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);
  const singleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heart = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({ opacity: heart.value, transform: [{ scale: 0.6 + heart.value * 0.6 }] }), []);
  const frame = mediaFrame(items[0]?.width, items[0]?.height);
  const height = width / frame.aspectRatio;

  const onTap = (i: number) => {
    const now = Date.now();
    if (onDoubleTap && now - lastTap.current < DOUBLE_TAP_MS) {
      if (singleTimer.current) clearTimeout(singleTimer.current);
      lastTap.current = 0;
      heart.value = withSequence(
        withSpring(1, { ...springs.bouncy, reduceMotion: ReduceMotion.System }),
        withTiming(0, { duration: 420, reduceMotion: ReduceMotion.System }),
      );
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    singleTimer.current = setTimeout(() => onOpen(i), onDoubleTap ? DOUBLE_TAP_MS : 0);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)));

  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.frame, { height, width }]} testID="card-media">
      <FlatList
        data={items}
        getItemLayout={(_, i) => ({ index: i, length: width, offset: width * i })}
        horizontal
        keyExtractor={(item, i) => `${item.url}-${i}`}
        nestedScrollEnabled
        onMomentumScrollEnd={onScrollEnd}
        pagingEnabled
        renderItem={({ item, index: i }) => {
          const own = mediaFrame(item.width, item.height);
          // Same ratio as the frame: fill it exactly. Otherwise draw it whole on its own blurred copy.
          const fit = Math.abs(own.aspectRatio - frame.aspectRatio) < 0.01 && own.fit === 'cover' ? 'cover' : 'contain';
          const still = toAbsoluteUrl(item.type === 'Video' ? item.thumbnailUrl : item.thumbnailUrl ?? item.url);
          const video = item.type === 'Video' ? toAbsoluteUrl(item.url) : null;
          return (
            <Pressable accessibilityRole="imagebutton" onPress={() => onTap(i)} style={{ height, width }}>
              {still ? <Image blurRadius={24} resizeMode="cover" source={{ uri: still }} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, styles.empty]} />}
              {video ? <CardVideo active={i === index} fit={fit} uri={video} /> : still ? <Image accessibilityIgnoresInvertColors resizeMode={fit} source={{ uri: still }} style={StyleSheet.absoluteFill} /> : null}
              {video && !still ? <View style={styles.play}><Play color={overlay.textSoft} fill={overlay.textSoft} size={32} /></View> : null}
            </Pressable>
          );
        }}
        scrollEnabled={items.length > 1}
        showsHorizontalScrollIndicator={false}
      />
      <Animated.View pointerEvents="none" style={[styles.heart, heartStyle]}>
        <Heart color={colors.white} fill={colors.white} size={88} />
      </Animated.View>
      {overlayStart ? <View pointerEvents="none" style={styles.overlayStart}>{overlayStart}</View> : null}
      {items.length > 1 ? (
        <View pointerEvents="none" style={styles.dots}>
          {items.map((_, i) => <View key={i} style={[styles.dot, i === index && styles.dotOn]} />)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: overlay.black, borderRadius: radii.lg, overflow: 'hidden' },
  empty: { backgroundColor: colors.surfaceElevated },
  play: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  heart: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  overlayStart: { bottom: spacing.md, left: spacing.md, position: 'absolute' },
  dots: { bottom: spacing.md, flexDirection: 'row', gap: 5, position: 'absolute', right: spacing.md },
  dot: { backgroundColor: overlay.line, borderRadius: radii.pill, height: 7, width: 7 },
  dotOn: { backgroundColor: colors.white },
});
