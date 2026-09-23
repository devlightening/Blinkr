import { useVideoPlayer, VideoView } from 'expo-video';
import { X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated as RNAnimated, BackHandler, FlatList, Image, PanResponder, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toAbsoluteUrl } from '../../api';
import type { CardMedia } from '../../signalCard';
// Drawn over photos and video: always the dark media palette (plan-devam B3).
import { media, mediaColors as colors, radii } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

function ViewerVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.play(); });
  return <VideoView contentFit="contain" nativeControls player={player} style={StyleSheet.absoluteFill} />;
}

/**
 * Full-screen media (plan-devam C6): swipe between items, pinch to zoom a photo (iOS; Android shows it whole), drag down
 * to close. Video plays with sound and controls here, unlike the muted loop in the card.
 */
export function MediaViewer({ items, startIndex, onClose }: { items: CardMedia[]; startIndex: number; onClose: () => void }) {
  const { t } = useTranslation('signal');
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dragY = useRef(new RNAnimated.Value(0)).current;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
    onPanResponderMove: RNAnimated.event([null, { dy: dragY }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 120) onClose();
      else RNAnimated.spring(dragY, { toValue: 0, useNativeDriver: false }).start();
    },
  })).current;

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => back.remove();
  }, [onClose]);

  return (
    <RNAnimated.View style={[styles.screen, { opacity: dragY.interpolate({ inputRange: [0, 300], outputRange: [1, 0.4], extrapolate: 'clamp' }), transform: [{ translateY: dragY }] }]} {...pan.panHandlers} testID="media-viewer">
      <FlatList
        data={items}
        getItemLayout={(_, i) => ({ index: i, length: width, offset: width * i })}
        horizontal
        initialScrollIndex={Math.min(startIndex, items.length - 1)}
        keyExtractor={(item, i) => `${item.url}-${i}`}
        pagingEnabled
        renderItem={({ item }) => {
          const video = item.type === 'Video' ? toAbsoluteUrl(item.url) : null;
          const still = toAbsoluteUrl(item.type === 'Video' ? item.thumbnailUrl : item.url);
          return (
            <View style={{ height, width }}>
              {video ? <ViewerVideo uri={video} /> : (
                <ScrollView centerContent contentContainerStyle={{ height, width }} maximumZoomScale={4} minimumZoomScale={1} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
                  {still ? <Image accessibilityIgnoresInvertColors resizeMode="contain" source={{ uri: still }} style={{ height, width }} /> : null}
                </ScrollView>
              )}
            </View>
          );
        }}
        showsHorizontalScrollIndicator={false}
      />
      <AnimatedPressable accessibilityLabel={t('card.closeViewer')} accessibilityRole="button" hitSlop={10} onPress={onClose} style={[styles.close, { top: insets.top + 12 }]}>
        <X color={colors.text} size={22} />
      </AnimatedPressable>
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: media.black, zIndex: 400 },
  close: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, height: 44, justifyContent: 'center', position: 'absolute', right: 16, width: 44 },
});
