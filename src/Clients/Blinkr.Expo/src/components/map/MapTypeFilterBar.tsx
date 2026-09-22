import { ScrollView, StyleSheet } from 'react-native';

import { MAP_FILTER_TYPES } from '../../mapTypeFilter';
import { SIGNAL_CATALOG } from '../../signalCatalog';
import { spacing } from '../../theme';
import type { SignalType } from '../../types';
import { BlinkrChip } from '../ui/BlinkrChip';
import { SignalSymbol } from '../SignalSymbol';

type Props = {
  active: ReadonlySet<SignalType>;
  onToggle: (type: SignalType) => void;
};

/**
 * 04 §1.2's "tip çipleri" row: a multi-select filter, separate from the Tümü/Canlı/Yerler/Sinyaller
 * layer above it. An empty selection means "no filter" (every type shows) rather than "show nothing" -
 * the map should never look emptier just because nobody has touched a chip yet.
 *
 * The plan's own chip list also names "Trafik" and "Hava"; Blinkr's `SignalType` has no such values
 * (see 05_DOMAIN dili in the constitution) so they are not invented here - only real signal types are
 * offered, from `SIGNAL_CATALOG` so the label/colour/icon always match what the rest of the app shows.
 */
export function MapTypeFilterBar({ active, onToggle }: Props) {
  return (
    <ScrollView
      accessibilityRole="tablist"
      contentContainerStyle={styles.content}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
    >
      {MAP_FILTER_TYPES.map((type) => {
        const entry = SIGNAL_CATALOG[type];
        const selected = active.has(type);
        return (
          <BlinkrChip
            icon={(color) => <SignalSymbol color={color} size={14} type={type} />}
            key={type}
            label={entry.label}
            onPress={() => onToggle(type)}
            selected={selected}
            style={styles.chip}
            tone={entry.tone}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: spacing.sm },
  content: { gap: 8, paddingHorizontal: 2 },
  chip: { marginRight: 0 },
});
