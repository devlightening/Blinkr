import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

type Props = {
  children: ReactNode;
  variant?: 'surface' | 'elevated';
  /** Only pass this when the whole card is genuinely one tap target. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function BlinkrCard({ children, variant = 'surface', onPress, accessibilityLabel, style }: Props) {
  const cardStyle = [styles.card, variant === 'elevated' && styles.elevated, style];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <AnimatedPressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} pressScale={0.98} style={cardStyle}>
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, padding: spacing.lg },
  elevated: { backgroundColor: colors.surfaceElevated },
});
