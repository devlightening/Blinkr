import { LocateFixed, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors, motion, radii, shadowSoft, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrButton } from '../ui/BlinkrButton';

/**
 * Plan Faz 1.2 (Waze/Snap Map pattern): before the system location prompt, say what the permission is for, so the
 * first answer is an informed one. Shown on the map only while location is not granted; "Şimdi değil" hides it for
 * this session. When the system will not ask again, the button opens the device settings instead.
 */
export function LocationPrimer({ bottom, canAskAgain, onAllow, onOpenSettings, onDismiss }: {
  bottom: number;
  canAskAgain: boolean;
  onAllow: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation('map');
  return (
    <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} style={[styles.card, { bottom }]} testID="location-primer">
      <View style={styles.head}>
        <View style={styles.icon}><LocateFixed color={colors.mint} size={20} /></View>
        <Text accessibilityRole="header" style={styles.title}>{t('primer.title')}</Text>
        <AnimatedPressable accessibilityLabel={t('primer.later')} accessibilityRole="button" hitSlop={10} onPress={onDismiss} style={styles.close}>
          <X color={colors.textSecondary} size={18} />
        </AnimatedPressable>
      </View>
      <Text style={styles.body}>{t('primer.body')}</Text>
      <Text style={styles.privacy}>{t('primer.privacy')}</Text>
      <BlinkrButton
        label={canAskAgain ? t('primer.allow') : t('primer.settings')}
        onPress={canAskAgain ? onAllow : onOpenSettings}
        style={styles.action}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.xs, left: spacing.lg, padding: spacing.lg, position: 'absolute', right: spacing.lg, ...shadowSoft },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  icon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 36, justifyContent: 'center', width: 36 },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  close: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  body: { ...typography.body, color: colors.text },
  privacy: { ...typography.caption, color: colors.textSecondary },
  action: { marginTop: spacing.sm },
});
