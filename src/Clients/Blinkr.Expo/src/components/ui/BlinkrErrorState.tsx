import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme';
import { BlinkrButton } from './BlinkrButton';

type Props = {
  /** What went wrong, in plain words - never a raw exception or stack trace (anayasa §16). */
  description: string;
  onRetry: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * "Ne oldu + nasıl düzelir + Tekrar dene" (03_DESIGN_SYSTEM.md §7, §9: "Özür dilemez, net söyler").
 * Several screens already write this by hand (a `friendlyError()` message next to a "Tekrar dene"
 * button); this is the shared shape for new screens, not a forced migration of the working ones.
 */
export function BlinkrErrorState({ description, onRetry, retryLabel = 'Tekrar dene', style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.iconTile}><TriangleAlert color={colors.danger} size={24} /></View>
      <Text accessibilityRole="alert" style={styles.description}>{description}</Text>
      <BlinkrButton label={retryLabel} onPress={onRetry} style={styles.action} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  iconTile: { alignItems: 'center', backgroundColor: colors.errorSoft, borderColor: colors.errorLine, borderRadius: radii.lg, borderWidth: 1, height: 56, justifyContent: 'center', marginBottom: spacing.xs, width: 56 },
  description: { ...typography.body, color: colors.text, textAlign: 'center' },
  action: { marginTop: spacing.md, paddingHorizontal: 20 },
});
