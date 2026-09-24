import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, shadowSoft, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { BlinkrMark } from '../BlinkrMark';
import { tx } from '../../i18n/tx';

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
      <View style={styles.logoTile}><BlinkrMark size={24} /></View>
      <View style={styles.copy}>
        <Text style={styles.brand}>blinkr</Text>
        {subtitle}
      </View>
      {right}
    </View>
  );
}

/** Round initial button on the header's right edge. Uses the real user name, never a placeholder image. */
export function HeaderAvatar({ userId, userName, avatarKey, onPress, accessibilityLabel = tx('common:actions.openProfile', 'Profili aç') }: { userId: string; userName: string; avatarKey?: string | null; onPress?: () => void; accessibilityLabel?: string }) {
  return (
    <AnimatedPressable accessibilityLabel={`${accessibilityLabel}: ${userName}`} accessibilityRole="button" disabled={!onPress} onPress={onPress} pressScale={0.9} style={styles.avatar}>
      <Avatar avatarKey={avatarKey} ringColor={colors.border} seed={userId} size={40} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadowSoft },
  logoTile: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radii.md, height: 36, justifyContent: 'center', width: 36 },
  copy: { flex: 1 },
  brand: { ...typography.heading, color: colors.text, fontSize: 18, lineHeight: 22 },
  avatar: { alignItems: 'center', borderRadius: radii.pill, height: 40, justifyContent: 'center', width: 40 },
});
