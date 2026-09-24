import { Coffee, Layers3, MessageCircle, Radio } from 'lucide-react-native';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { MapLayer } from '../../mapSelection';
import { colors, radii, shadowSoft, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { tx } from '../../i18n/tx';

const layers = [
  { key: 'all', label: tx('map:layer.all', 'Tümü'), Icon: Layers3 },
  { key: 'live', label: tx('map:layer.live', 'Canlı'), Icon: Radio },
  { key: 'places', label: tx('map:layer.places', 'Yerler'), Icon: Coffee },
  { key: 'signals', label: tx('map:layer.signals', 'Sinyaller'), Icon: MessageCircle },
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
        const color = selected ? colors.primary : colors.textSecondary;
        return (
          <AnimatedPressable
            accessibilityLabel={label}
            accessibilityRole="tab"
            aria-selected={selected}
            key={key}
            onPress={() => onChange(key)}
            pressScale={0.97}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Icon color={color} size={17} strokeWidth={2.1} />
            {(selected || !compact) && <Text numberOfLines={1} style={[styles.label, { color }]}>{label}</Text>}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: 2, marginTop: spacing.sm, padding: 4, ...shadowSoft },
  // Content-sized segments that share leftover space equally, so every label fits without the
  // selected pill stealing room from its neighbours.
  option: { alignItems: 'center', borderRadius: radii.md, flexBasis: 'auto', flexDirection: 'row', flexGrow: 1, flexShrink: 1, gap: 6, justifyContent: 'center', minHeight: 40, paddingHorizontal: 8 },
  optionSelected: { backgroundColor: colors.primaryTint },
  label: { ...typography.caption, fontWeight: '600' },
});
