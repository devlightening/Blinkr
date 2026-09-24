import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { CAMERA_LENSES, lensAfterSwipe, lensById } from '../../cameraEffects';
// Drawn over live camera/photo/video: always the dark media palette, whatever the app theme (plan-devam B3).
import { media, mediaColors as colors, radii, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

/**
 * plan-devam D4: lenses change by swiping over the picture; the old row of circles is gone. What is left is this
 * small quiet pill - the lens name and a dot per lens - with arrows for people who cannot or do not swipe.
 */
export function LensIndicator({ selectedId, onSelect, disabled = false }: { selectedId: string; onSelect: (id: string) => void; disabled?: boolean }) {
  const lens = lensById(selectedId);
  const step = (dx: number) => {
    if (disabled) return;
    onSelect(lensAfterSwipe(lens.id, dx));
    void Haptics.selectionAsync().catch(() => {});
  };
  return (
    <View style={styles.row}>
      <AnimatedPressable accessibilityLabel="Önceki efekt" accessibilityRole="button" disabled={disabled} hitSlop={8} onPress={() => step(1_000)} pressScale={0.9} style={styles.arrow}>
        <ChevronLeft color={colors.text} size={18} />
      </AnimatedPressable>
      <View style={styles.pill}>
        <Text accessibilityLabel={`Efekt: ${lens.label}`} style={styles.name} testID="lens-current">{lens.label}</Text>
        <View style={styles.dots}>
          {CAMERA_LENSES.map((item) => <View key={item.id} style={[styles.dot, item.id === lens.id && styles.dotOn]} />)}
        </View>
      </View>
      <AnimatedPressable accessibilityLabel="Sonraki efekt" accessibilityRole="button" disabled={disabled} hitSlop={8} onPress={() => step(-1_000)} pressScale={0.9} style={styles.arrow}>
        <ChevronRight color={colors.text} size={18} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: spacing.xs },
  arrow: { alignItems: 'center', height: 44, justifyContent: 'center', width: 36 },
  pill: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, gap: 4, minWidth: 116, paddingHorizontal: spacing.md, paddingVertical: 6 },
  name: { ...typography.label, color: colors.text },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { backgroundColor: media.lineSoft, borderRadius: 3, height: 5, width: 5 },
  dotOn: { backgroundColor: colors.flare, width: 12 },
});
