import { Coffee, Layers3, MessageCircle, Radio } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { tx } from '../../i18n/tx';
import type { NowFilter } from '../../live/liveState';
import type { MapLayer } from '../../mapSelection';
import { colors, radii, shadowSoft, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { NowChips } from '../live/NowChips';

const layers = [
  { key: 'all', label: tx('map:layer.all', 'Tümü'), Icon: Layers3 },
  { key: 'live', label: tx('map:layer.live', 'Canlı'), Icon: Radio },
  { key: 'places', label: tx('map:layer.places', 'Yerler'), Icon: Coffee },
  { key: 'signals', label: tx('map:layer.signals', 'Sinyaller'), Icon: MessageCircle },
] as const;

/**
 * One floating row of chips over the map: the "Şimdi" chips first (Açık şimdi · Sakin · Etkinlik · Fırsat, v4 brief §3.1 -
 * what the map is for), then, after a hairline, the four layers - the chosen one is a solid dark pill. Each chip floats on its own with
 * a soft shadow; there is no bar behind them, so the map shows through.
 */
export function MapFilterRow({ layer, onLayerChange, nowFilters, onToggleNow }: {
  layer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  nowFilters: ReadonlySet<NowFilter>;
  onToggleNow: (id: NowFilter) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={styles.row}>
      <NowChips active={nowFilters} onToggle={onToggleNow} />
      <View style={styles.divider} />
      <View accessibilityRole="tablist" style={styles.group}>
        {layers.map(({ key, label, Icon }) => {
          const selected = layer === key;
          const color = selected ? colors.background : colors.text;
          return (
            <AnimatedPressable accessibilityLabel={label} accessibilityRole="tab" aria-selected={selected} key={key} onPress={() => onLayerChange(key)} pressScale={0.95} style={[styles.chip, selected && styles.chipOn]}>
              <Icon color={color} size={15} strokeWidth={2.2} />
              <Text numberOfLines={1} style={[styles.label, { color }]}>{label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: -12, marginTop: spacing.sm },
  content: { alignItems: 'center', gap: spacing.sm, paddingBottom: 10, paddingHorizontal: 12, paddingTop: 2 },
  group: { flexDirection: 'row', gap: spacing.sm },
  chip: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, flexDirection: 'row', gap: 6, height: 38, paddingHorizontal: 14, ...shadowSoft },
  chipOn: { backgroundColor: colors.text },
  label: { ...typography.callout, fontWeight: '700' },
  divider: { backgroundColor: colors.lineStrong, borderRadius: 1, height: 20, width: 1.5 },
});
