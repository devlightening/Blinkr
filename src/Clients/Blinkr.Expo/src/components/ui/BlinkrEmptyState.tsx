import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme';
import { BlinkrButton } from './BlinkrButton';

type Props = {
  icon: ReactNode;
  title: string;
  description?: string;
  /** Only pass an action that actually does something. */
  action?: { label: string; onPress: () => void; icon?: ReactNode };
  style?: StyleProp<ViewStyle>;
};

export function BlinkrEmptyState({ icon, title, description, action, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.iconTile}>{icon}</View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <BlinkrButton icon={action.icon} label={action.label} onPress={action.onPress} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  iconTile: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, height: 72, justifyContent: 'center', marginBottom: spacing.sm, width: 72 },
  title: { ...typography.heading, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  action: { marginTop: spacing.md, paddingHorizontal: 24 },
});
