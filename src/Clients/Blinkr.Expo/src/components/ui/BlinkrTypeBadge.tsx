import { StyleSheet, Text, View } from 'react-native';

import { media, mediaColors, radii, spacing, typography } from '../../theme';
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
export function TypeBadge({ signalType, tone, typeLabel, valueLabel, onMedia = false }: Props & { onMedia?: boolean }) {
  // On a photo it is a dark glass chip with white text (always readable); elsewhere a soft tint, no stroke.
  const fg = onMedia ? mediaColors.text : tone;
  return (
    <View style={[styles.badge, onMedia ? styles.onMedia : { backgroundColor: `${tone}24` }]}>
      <SignalSymbol color={fg} size={14} type={signalType} />
      <Text numberOfLines={1} style={[styles.text, { color: fg }]}>{typeLabel}{valueLabel ? ` · ${valueLabel}` : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: radii.pill, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 5 },
  onMedia: { backgroundColor: media.chipStrong },
  text: { ...typography.label, letterSpacing: 0 },
});
