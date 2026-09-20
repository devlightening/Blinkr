import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, shadow, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrMark } from '../BlinkrMark';

type Props = {
  /** Line under the wordmark - e.g. the live-area status on the map. */
  subtitle?: ReactNode;
  /** Right-hand slot; usually a `HeaderAvatar`. */
  right?: ReactNode;
  /** Adds the top safe-area inset as margin. Turn off when a parent already handles it. */
  safeArea?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BlinkrHeader({ subtitle, right, safeArea = true, style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { marginTop: (safeArea ? insets.top : 0) + spacing.xs }, style]}>
      <View style={styles.logoTile}><BlinkrMark size={30} /></View>
      <View style={styles.copy}>
        <Text style={styles.brand}>blinkr</Text>
        {subtitle}
      </View>
      {right}
    </View>
  );
}

/** Round initial button on the header's right edge. Uses the real user name, never a placeholder image. */
export function HeaderAvatar({ userName, onPress, accessibilityLabel = 'Profili aç' }: { userName: string; onPress?: () => void; accessibilityLabel?: string }) {
  const initial = userName.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  return (
    <AnimatedPressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" disabled={!onPress} onPress={onPress} pressScale={0.9} style={styles.avatar}>
      <Text style={styles.avatarText}>{initial}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 68, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadow },
  logoTile: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radii.md, height: 46, justifyContent: 'center', width: 46 },
  copy: { flex: 1 },
  brand: { ...typography.title, color: colors.text, fontSize: 22, lineHeight: 26 },
  avatar: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { ...typography.bodyStrong, color: colors.text, fontSize: 18, fontWeight: '800' },
});
