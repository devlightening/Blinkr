import { Coffee, Layers3, MessageCircle, Radio } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { tx } from '../../i18n/tx';
import type { MapLayer } from '../../mapSelection';
import { MAP_FILTER_TYPES } from '../../mapTypeFilter';
import { SIGNAL_CATALOG } from '../../signalCatalog';
import { colors, radii, shadowSoft, spacing, typography } from '../../theme';
import type { SignalType } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { SignalSymbol } from '../SignalSymbol';

const layers = [
  { key: 'all', label: tx('map:layer.all', 'Tümü'), Icon: Layers3 },
  { key: 'live', label: tx('map:layer.live', 'Canlı'), Icon: Radio },
  { key: 'places', label: tx('map:layer.places', 'Yerler'), Icon: Coffee },
  { key: 'signals', label: tx('map:layer.signals', 'Sinyaller'), Icon: MessageCircle },
] as const;

/**
 * One floating row of chips over the map (reworked for a calmer, Snap Map-like top): the four layers first - the
 * chosen one is a solid dark pill, the way Snapchat marks the active choice - then, after a hairline, the signal-type
 * filters (multi-select, tinted when on). Each chip floats on its own with a soft shadow; there is no bar behind them,
 * so the map shows through.
 */
export function MapFilterRow({ layer, onLayerChange, activeTypes, onToggleType }: {
  layer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  activeTypes: ReadonlySet<SignalType>;
  onToggleType: (type: SignalType) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content} horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={styles.row}>
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
      {layer !== 'places' ? (
        <>
          <View style={styles.divider} />
          {MAP_FILTER_TYPES.map((type) => {
            const entry = SIGNAL_CATALOG[type];
            const selected = activeTypes.has(type);
            return (
              <AnimatedPressable accessibilityLabel={entry.label} accessibilityRole="button" aria-selected={selected} key={type} onPress={() => onToggleType(type)} pressScale={0.95} style={[styles.chip, selected && { backgroundColor: entry.tone }]}>
                <SignalSymbol color={selected ? colors.ink : entry.tone} size={15} type={type} />
                <Text numberOfLines={1} style={[styles.label, { color: selected ? colors.ink : colors.text }]}>{entry.label}</Text>
              </AnimatedPressable>
            );
          })}
        </>
      ) : null}
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
