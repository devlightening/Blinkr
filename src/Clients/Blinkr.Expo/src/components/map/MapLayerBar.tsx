import { Coffee, Layers3, MessageCircle, Radio } from 'lucide-react-native';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { MapLayer } from '../../mapSelection';
import { colors, radii, shadowSoft, sizes, spacing } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

const layers = [
  { key: 'all', label: 'Tümü', Icon: Layers3 },
  { key: 'live', label: 'Canlı', Icon: Radio },
  { key: 'places', label: 'Yerler', Icon: Coffee },
  { key: 'signals', label: 'Sinyaller', Icon: MessageCircle },
] as const;

/** Tümü | Canlı | Yerler | Sinyaller - the selected layer is the lime pill, the rest are quiet. */
export function MapLayerBar({ value, onChange }: { value: MapLayer; onChange: (layer: MapLayer) => void }) {
  const { width } = useWindowDimensions();
  // Narrow phones: only the selected layer keeps its label so nothing is clipped.
  const compact = width < 360;
  return (
    <View accessibilityRole="tablist" style={styles.bar}>
      {layers.map(({ key, label, Icon }) => {
        const selected = value === key;
        const color = selected ? colors.ink : colors.textSecondary;
        return (
          <AnimatedPressable
            accessibilityLabel={label}
            accessibilityRole="tab"
            aria-selected={selected}
            key={key}
            onPress={() => onChange(key)}
            pressScale={0.94}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Icon color={color} size={19} strokeWidth={2.3} />
            {(selected || !compact) && <Text numberOfLines={1} style={[styles.label, { color }]}>{label}</Text>}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.xl, borderWidth: 1, flexDirection: 'row', gap: 2, marginTop: spacing.md - 2, padding: 5, ...shadowSoft },
  // Content-sized segments that share leftover space equally, so every label fits without the
  // selected pill stealing room from its neighbours.
  option: { alignItems: 'center', borderRadius: radii.xl, flexBasis: 'auto', flexDirection: 'row', flexGrow: 1, flexShrink: 1, gap: 6, justifyContent: 'center', minHeight: sizes.touch + 2, paddingHorizontal: 8 },
  optionSelected: { backgroundColor: colors.primary },
  label: { fontSize: 13.5, fontWeight: '700' },
});
