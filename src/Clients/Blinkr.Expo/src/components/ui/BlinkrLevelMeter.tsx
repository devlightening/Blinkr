import { StyleSheet, View } from 'react-native';

import { colors, levelScale, radii, spacing } from '../../theme';

type Props = {
  /** 0-3, already resolved for the signal's own direction (parking reads the opposite way - invert
   * the value before passing it in here, never the colour scale itself). */
  level: number;
  accessibilityLabel: string;
};

/** Four bars, `level + 1` of them filled in the matching level colour (`theme.levelScale`). */
export function LevelMeter({ level, accessibilityLabel }: Props) {
  const clamped = Math.min(3, Math.max(0, Math.round(Number.isFinite(level) ? level : 0)));
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="progressbar" style={styles.row}>
      {levelScale.map((color, index) => (
        <View key={color} style={[styles.bar, index <= clamped ? { backgroundColor: color } : styles.barEmpty]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  bar: { borderRadius: radii.sm / 2, height: spacing.sm, width: spacing.sm },
  barEmpty: { backgroundColor: colors.meterEmpty },
});
