import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme';

export type StatItem = {
  key: string;
  icon: ReactNode;
  /** The number or state word itself, e.g. "Taze", "283 m", "12". */
  value: string;
  /** The axis name, shown once beneath the value - never repeated inside `value` (sinyal-mvp-plan AUDIT #1: "Taze tazelik", "Orta güven güven"). */
  label: string;
};

/**
 * A row of 2-4 small stats (icon + value + one label), separated by hairline dividers. Replaces the
 * repeated one-off `Stat` markup that used to duplicate the axis word inside the value ("Orta güven güven").
 */
export function StatRow({ items, style }: { items: StatItem[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.stat}>
            {item.icon}
            <Text numberOfLines={1} style={styles.value}>{item.value}</Text>
            <Text numberOfLines={1} style={styles.label}>{item.label}</Text>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'stretch', backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', paddingVertical: spacing.md },
  stat: { alignItems: 'center', flex: 1, gap: 2, paddingHorizontal: 4 },
  value: { ...typography.bodyStrong, color: colors.text, fontSize: 15 },
  label: { ...typography.caption, color: colors.textSecondary },
  divider: { backgroundColor: colors.border, width: 1 },
});
