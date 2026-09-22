import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

type Variant = 'glass' | 'surface' | 'plain';
type Size = 36 | 44;

type Props = {
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const VARIANT_BG: Record<Variant, string> = { glass: colors.glass, surface: colors.surfaceElevated, plain: 'transparent' };

/**
 * A round icon-only tap target (03_DESIGN_SYSTEM.md §7): `glass` for controls floating over the map or
 * camera, `surface` for chrome on an ordinary screen, `plain` where a border/background would be
 * redundant. This is the same circle that many screens already hand-roll (map/camera close buttons,
 * sheet back buttons); new screens can reach for this instead of rewriting it.
 */
export function IconButton({ icon, onPress, accessibilityLabel, variant = 'surface', size = 44, disabled = false, style }: Props) {
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      pressScale={0.92}
      style={[styles.base, { backgroundColor: VARIANT_BG[variant], height: size, width: size }, variant !== 'plain' && styles.bordered, disabled && styles.disabled, style]}
    >
      {icon}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', borderRadius: radii.pill, justifyContent: 'center' },
  bordered: { borderColor: colors.border, borderWidth: 1 },
  disabled: { opacity: 0.5 },
});
