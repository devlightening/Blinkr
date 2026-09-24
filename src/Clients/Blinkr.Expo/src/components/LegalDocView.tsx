import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { draftNote, legalDoc, type LegalDocId } from '../legalContent';
import { colors, radii, spacing, typography } from '../theme';

/** One legal text (plan-devam F2), with the "draft" note on top until a lawyer has reviewed it. */
export function LegalDocView({ id }: { id: LegalDocId }) {
  const { i18n, t } = useTranslation('settings');
  const doc = legalDoc(id, i18n.language);
  return (
    <View style={styles.wrap} testID={`legal-${id}`}>
      <View accessibilityRole="alert" style={styles.draft} testID="legal-draft">
        <AlertTriangle color={colors.warning} size={18} />
        <Text style={styles.draftText}>{draftNote(i18n.language)}</Text>
      </View>
      <Text style={styles.updated}>{t('legal.updated', { date: doc.updated })}</Text>
      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  draft: { alignItems: 'flex-start', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  draftText: { ...typography.caption, color: colors.text, flex: 1 },
  updated: { ...typography.caption, color: colors.textSecondary },
  section: { gap: spacing.xs },
  heading: { ...typography.bodyStrong, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
});
