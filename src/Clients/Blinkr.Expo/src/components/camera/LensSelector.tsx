import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CAMERA_LENSES } from '../../cameraEffects';
import { colors, radii, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

type Props = {
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
};

/** Horizontal strip of lens swatches; the selected one is ringed in lime and named underneath. */
export function LensSelector({ selectedId, onSelect, disabled = false }: Props) {
  return (
    <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false} style={[styles.scroll, disabled && styles.disabled]}>
      {CAMERA_LENSES.map((lens) => {
        const selected = lens.id === selectedId;
        return (
          <AnimatedPressable
            accessibilityLabel={`${lens.label} efekti`}
            accessibilityRole="button"
            aria-disabled={disabled}
            aria-selected={selected}
            disabled={disabled}
            key={lens.id}
            onPress={() => onSelect(lens.id)}
            pressScale={0.9}
            style={styles.item}
          >
            <View style={[styles.ring, selected && styles.ringSelected]}>
              <View style={[styles.swatch, { backgroundColor: lens.swatch }]} />
            </View>
            <Text numberOfLines={1} style={[styles.name, selected && styles.nameSelected]}>{lens.label}</Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  disabled: { opacity: 0.4 },
  row: { gap: spacing.md, paddingHorizontal: spacing.lg },
  item: { alignItems: 'center', gap: 4, minWidth: 60 },
  ring: { alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.35)', borderRadius: radii.pill, borderWidth: 2, height: 52, justifyContent: 'center', width: 52 },
  ringSelected: { borderColor: colors.flare, borderWidth: 3 },
  swatch: { borderRadius: radii.pill, height: 40, width: 40 },
  name: { ...typography.caption, color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' },
  nameSelected: { color: colors.flare, fontWeight: '800' },
});
