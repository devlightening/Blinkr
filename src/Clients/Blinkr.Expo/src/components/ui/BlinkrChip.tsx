import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, sizes, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Receives the colour that matches the chip state so glyphs stay legible when selected. */
  icon?: (color: string) => ReactNode;
  /** Accent used for the icon and outline while not selected (signal / category tone). */
  tone?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function BlinkrChip({ label, selected, onPress, icon, tone, disabled = false, accessibilityLabel, style }: Props) {
  const foreground = selected ? colors.ink : colors.text;
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      aria-selected={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      pressScale={0.97}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.glass, borderColor: colors.border },
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon?.(selected ? colors.ink : tone ?? colors.textSecondary)}
      <Text numberOfLines={1} style={[styles.label, { color: foreground }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 36, minWidth: 48, paddingHorizontal: 14 },
  label: { ...typography.caption, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
