import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { clampToFrame, isOverTrash, textOnColor, type PlacedSticker } from '../../cameraEffects';
import { colors, radii, spacing, typography } from '../../theme';

type Props = {
  sticker: PlacedSticker;
  glyph: string;
  text: string;
  frame: { width: number; height: number };
  /** Called when a drag, pinch or twist ends, with the new resting position. */
  onCommit: (key: string, x: number, y: number, scale: number, rotation: number) => void;
  /** True while a finger is moving the sticker - the editor shows the bin then. */
  onDragChange?: (dragging: boolean) => void;
  onRemove: (key: string) => void;
  /** The remove button is hidden while the picture is being rendered to a file. */
  showControls: boolean;
};

const MIN_SCALE = 0.7;
const MAX_SCALE = 2.4;

/** A sticker that can be dragged with one finger and resized with two. */
export function DraggableSticker({ sticker, glyph, text, frame, onCommit, onRemove, showControls, onDragChange }: Props) {
  const x = useSharedValue(sticker.x);
  const y = useSharedValue(sticker.y);
  const scale = useSharedValue(sticker.scale);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const rotation = useSharedValue(sticker.rotation ?? 0);
  const startRotation = useSharedValue(0);

  const commit = () => {
    // Dropped on the bin (bottom centre): gone. The anchor is the pill's top-left, so test its middle.
    if (isOverTrash({ x: x.value + 40, y: y.value + 18 }, frame)) { onRemove(sticker.key); return; }
    const nextX = clampToFrame(x.value, frame.width, 8);
    const nextY = clampToFrame(y.value, frame.height, 8);
    x.value = nextX;
    y.value = nextY;
    onCommit(sticker.key, nextX, nextY, scale.value, rotation.value);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => { startX.value = x.value; startY.value = y.value; onDragChange?.(true); })
    .onUpdate((event) => { x.value = startX.value + event.translationX; y.value = startY.value + event.translationY; })
    .onEnd(commit)
    .onFinalize(() => onDragChange?.(false));
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => { startScale.value = scale.value; })
    .onUpdate((event) => { scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, startScale.value * event.scale)); })
    .onEnd(commit);

  const rotate = Gesture.Rotation()
    .runOnJS(true)
    .onStart(() => { startRotation.value = rotation.value; })
    .onUpdate((event) => { rotation.value = startRotation.value + event.rotation; })
    .onEnd(commit);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }, { rotate: `${rotation.value}rad` }] }), []);

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch, rotate)}>
      <Animated.View accessibilityLabel={`${text || glyph} çıkartması`} aria-label={`${text || glyph} çıkartması`} style={[styles.host, animated]}>
        {sticker.text ? (
          <Text
            style={[
              styles.overlayText,
              sticker.textStyle === 'solid'
                ? { backgroundColor: sticker.textColor, color: textOnColor(sticker.textColor ?? '#FFFFFF') }
                : sticker.textStyle === 'highlight'
                  ? [styles.highlight, { borderColor: sticker.textColor, color: sticker.textColor }]
                  : [styles.plainText, { color: sticker.textColor }],
            ]}
          >
            {sticker.text}
          </Text>
        ) : (
          <View style={styles.pill}>
            <Text style={styles.glyph}>{glyph}</Text>
            {text ? <Text style={styles.text}>{text}</Text> : null}
          </View>
        )}
        {showControls ? (
          <Pressable accessibilityLabel={`${text || glyph} çıkartmasını kaldır`} accessibilityRole="button" hitSlop={10} onPress={() => onRemove(sticker.key)} style={styles.remove}>
            <X color={colors.ink} size={14} strokeWidth={3} />
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  host: { left: 0, position: 'absolute', top: 0 },
  pill: { alignItems: 'center', backgroundColor: 'rgba(16, 23, 20, 0.88)', borderColor: colors.primary, borderRadius: radii.pill, borderWidth: 1.5, flexDirection: 'row', gap: spacing.xs, paddingHorizontal: 12, paddingVertical: 7 },
  glyph: { fontSize: 20 },
  text: { ...typography.bodyStrong, color: colors.text, fontVariant: ['tabular-nums'] },
  overlayText: { ...typography.title, borderRadius: radii.md, maxWidth: 280, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, textAlign: 'center' },
  plainText: { textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  highlight: { backgroundColor: 'rgba(0, 0, 0, 0.45)', borderWidth: 2 },
  remove: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 22, justifyContent: 'center', position: 'absolute', right: -8, top: -10, width: 22 },
});
