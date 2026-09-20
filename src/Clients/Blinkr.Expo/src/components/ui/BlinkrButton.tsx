import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

export type BlinkrButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: BlinkrButtonVariant;
  /** `lg` is the big lime call to action; `md` fits rows of secondary actions. */
  size?: 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  /** Second, quieter line under the label (e.g. "Burada neler oluyor?"). */
  subtitle?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const palette = (variant: BlinkrButtonVariant, pressed: boolean) => {
  switch (variant) {
    case 'primary': return { bg: pressed ? colors.primaryPressed : colors.primary, fg: colors.ink, border: 'transparent' };
    case 'secondary': return { bg: colors.surfaceElevated, fg: colors.text, border: colors.border };
    case 'danger': return { bg: 'transparent', fg: colors.danger, border: colors.coralLine };
    default: return { bg: 'transparent', fg: colors.mint, border: 'transparent' };
  }
};

export function BlinkrButton({
  label, onPress, variant = 'primary', size = 'md', loading = false, disabled = false, icon, subtitle, accessibilityLabel, style,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  const { bg, fg, border } = palette(variant, pressed);
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressScale={variant === 'primary' && size === 'lg' ? 0.96 : 0.95}
      style={[styles.base, size === 'lg' && styles.large, { backgroundColor: bg, borderColor: border }, disabled && styles.inactive, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <View style={subtitle ? styles.copy : undefined}>
        <Text numberOfLines={1} style={[size === 'lg' ? styles.labelLarge : styles.label, { color: fg }]}>{label}</Text>
        {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: fg }]}>{subtitle}</Text> : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 52, paddingHorizontal: 18 },
  large: { borderRadius: radii.lg, minHeight: 64, paddingHorizontal: 20 },
  inactive: { opacity: 0.48 },
  copy: { alignItems: 'flex-start' },
  label: { ...typography.bodyStrong, fontWeight: '800' },
  labelLarge: { ...typography.heading, fontWeight: '800' },
  subtitle: { ...typography.caption, opacity: 0.78 },
});
