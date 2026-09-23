import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme';

export type StatItem = {
  key: string;
  /** Each item has its own icon (count, freshness, trust and distance never share one - plan-devam A5). */
  icon: ReactNode;
  /**
   * One short phrase that already says what it is: "Canlı", "Orta güven", "283 m", "3 sinyal". There is no
   * separate axis label under it any more - "Taze / tazelik", "Orta / güven" read as the word twice (plan-devam A4).
   */
  text: string;
  accessibilityLabel?: string;
};

/**
 * A calm row of 2-4 facts, icon + phrase (`⚡ Canlı  🛡 Orta güven  📍 283 m`). Each icon marks where a fact starts, so no
 * separator is needed - a dot at the end of a wrapped line read as a stray character.
 */
export function StatRow({ items, style }: { items: StatItem[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="summary" style={[styles.row, style]}>
      {items.map((item) => (
        <View accessibilityLabel={item.accessibilityLabel ?? item.text} accessible key={item.key} style={styles.stat} testID={`stat-${item.key}`}>
          {item.icon}
          <Text numberOfLines={1} style={styles.text}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, columnGap: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, rowGap: spacing.xs },
  stat: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  text: { ...typography.bodyStrong, color: colors.text },
});
