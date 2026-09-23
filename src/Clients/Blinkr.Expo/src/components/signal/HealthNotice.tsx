import * as Localization from 'expo-localization';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { emergencyNumber } from '../../placeSafety';
import { colors, radii, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

/**
 * Health places: a calm, permanent pointer to real help (sinyal-mvp-plan 11_SAFETY §3 HealthNotice). Shown on the place
 * page and on every Sinyal Kartı of a health place (plan-devam C3/C10); the number follows the device's country.
 */
export function HealthNotice() {
  const { t } = useTranslation('signal');
  const number = emergencyNumber(Localization.getLocales()[0]?.regionCode);
  return (
    <View accessibilityRole="summary" style={styles.notice} testID="health-notice">
      <View style={styles.copy}>
        <Text style={styles.title}>{t('health.title')}</Text>
        <Text style={styles.body}>{t('health.body', { number })}</Text>
      </View>
      <AnimatedPressable accessibilityRole="button" onPress={() => { Linking.openURL(`tel:${number}`).catch(() => {}); }} style={styles.call}>
        <Text style={styles.callText}>{t('health.call', { number })}</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { alignItems: 'center', backgroundColor: colors.errorSoft, borderColor: colors.errorLine, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, color: colors.text },
  body: { ...typography.caption, color: colors.textSecondary },
  call: { alignItems: 'center', backgroundColor: colors.danger, borderRadius: radii.pill, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  callText: { ...typography.label, color: colors.ink },
});
