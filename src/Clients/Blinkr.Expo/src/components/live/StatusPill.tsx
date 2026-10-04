import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { LiveKind } from '../../live/liveState';
import { liveColors, liveTones, typography, withAlpha } from '../../theme';

export type StatusPillProps = {
  kind: LiveKind;
  /** Already translated ("Açık · Sakin"). Colour never carries the meaning alone: the word is mandatory. */
  label: string;
  size?: 'sm' | 'lg';
  /** No live confirmation, estimated from opening hours: a dashed outline instead of a fill. */
  estimated?: boolean;
};

function StatusPillBase({ kind, label, size = 'sm', estimated = false }: StatusPillProps) {
  const color = liveColors[kind];
  const large = size === 'lg';
  return (
    <View
      accessible accessibilityRole="text" accessibilityLabel={label}
      style={[
        styles.base, large ? styles.large : styles.small,
        estimated
          ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: withAlpha(color, 0.55) }
          : { backgroundColor: withAlpha(color, liveTones.pillAlpha) },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text numberOfLines={2} style={[large ? typography.callout : typography.label, styles.text, { color }]}>{label}</Text>
    </View>
  );
}

export const StatusPill = memo(StatusPillBase);

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 999, gap: 6 },
  small: { minHeight: 24, paddingLeft: 8, paddingRight: 10, paddingVertical: 3 },
  large: { minHeight: 30, paddingLeft: 12, paddingRight: 14, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { flexShrink: 1, fontWeight: '700' },
});
