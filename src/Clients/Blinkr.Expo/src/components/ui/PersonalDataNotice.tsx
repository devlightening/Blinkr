import { ShieldAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { personalDataNotice } from '../../textSafety';
import { colors, radii, spacing, typography } from '../../theme';

/**
 * "Kişisel bilgi paylaşmak üzeresin" (sinyal-mvp-plan Faz 10 P10.1): shown under a public text field while it holds
 * a phone number, national ID number, plate or street address. It never blocks sending; it says what the server
 * will hide (ID numbers, plates) and what everyone will see (phone, address).
 */
export function PersonalDataNotice({ texts }: { texts: (string | null | undefined)[] }) {
  const { t } = useTranslation('common');
  const notice = personalDataNotice(...texts);
  if (!notice) return null;
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.box} testID="personal-data-notice">
      <ShieldAlert color={colors.warning} size={18} />
      <View style={styles.copy}>
        <Text style={styles.title}>{t('personalData.title')}</Text>
        <Text style={styles.body}>{notice.allMasked ? t('personalData.masked') : t('personalData.visible')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.warning, borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.label, color: colors.text },
  body: { ...typography.caption, color: colors.textSecondary },
});
