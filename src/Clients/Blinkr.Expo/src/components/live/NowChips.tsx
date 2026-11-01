import { StyleSheet, Text, View } from 'react-native';

import { tx } from '../../i18n/tx';
import type { LiveKind, NowFilter } from '../../live/liveState';
import { colors, liveColors, liveTones, radii, shadowSoft, spacing, typography, withAlpha } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

const CHIPS: readonly { id: NowFilter; kind: LiveKind; label: () => string }[] = [
  { id: 'open', kind: 'info', label: () => tx('live:chipOpen', 'Açık şimdi') },
  { id: 'calm', kind: 'calm', label: () => tx('live:chipCalm', 'Sakin') },
  { id: 'event', kind: 'event', label: () => tx('live:chipEvent', 'Etkinlik') },
  { id: 'deal', kind: 'deal', label: () => tx('live:chipDeal', 'Fırsat') },
];

/**
 * "Şimdi" filters (v4 brief §3.1/§3.5), multi-select: a chosen chip fills with its state colour. Renders the chips
 * only, so the caller puts them in its own scrolling row (map chrome, search).
 */
export function NowChips({ active, onToggle }: { active: ReadonlySet<NowFilter>; onToggle: (id: NowFilter) => void }) {
  return (
    <>
      {CHIPS.map((chip) => {
        const on = active.has(chip.id);
        const color = liveColors[chip.kind];
        const label = chip.label();
        return (
            <AnimatedPressable key={chip.id}
              accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ selected: on }} hitSlop={4}
              onPress={() => onToggle(chip.id)} pressScale={0.95}
              style={[styles.chip, on && { backgroundColor: withAlpha(color, liveTones.chipAlpha), borderColor: color }]}
            >
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text numberOfLines={1} style={[styles.label, { color: on ? color : colors.text }]}>{label}</Text>
            </AnimatedPressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.surface, borderRadius: radii.pill, borderWidth: 1.5,
    flexDirection: 'row', gap: 7, height: 38, paddingHorizontal: spacing.md + 2, ...shadowSoft,
  },
  dot: { borderRadius: 4, height: 8, width: 8 },
  label: { ...typography.callout, fontWeight: '700' },
});
