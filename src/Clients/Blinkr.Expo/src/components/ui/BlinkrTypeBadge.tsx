import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '../../theme';
import type { SignalType } from '../../types';
import { SignalSymbol } from '../SignalSymbol';

type Props = {
  signalType?: SignalType | null;
  /** Accent for this signal type (see `signalColors` in `theme.ts`). */
  tone: string;
  typeLabel: string;
  /** The chosen value, already localised ("Kalabalık", "5-15 dk") - see `signalValueLabel`. */
  valueLabel?: string | null;
};

/**
 * "Bekleme · 5-15 dk" as one small pill: icon, tone-tinted background, tone-coloured text. The one place
 * a signal's type and level are read at a glance (03_DESIGN_SYSTEM.md §7). Extracted from the badge that
 * was inline in `BlinkrSignalCard`, so map pins and feed cards can show the same pill.
 */
export function TypeBadge({ signalType, tone, typeLabel, valueLabel }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: `${tone}29`, borderColor: `${tone}55` }]}>
      <SignalSymbol color={tone} size={14} type={signalType} />
      <Text numberOfLines={1} style={[styles.text, { color: tone }]}>{typeLabel}{valueLabel ? ` · ${valueLabel}` : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 3 },
  text: { ...typography.label, letterSpacing: 0 },
});
