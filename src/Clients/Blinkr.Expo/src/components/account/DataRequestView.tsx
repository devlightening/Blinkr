import { Download } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getLatestDataRequest, requestDataCopy, type DataRequestInfo } from '../../api';
import { SUPPORT_EMAIL } from '../../legalContent';
import { friendlyError } from '../../productPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { BlinkrButton } from '../ui/BlinkrButton';

const formatDate = (iso: string, language: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(language === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * "Verilerimi iste" (plan-devam F4): records a request for a copy of my data. The MVP has no automatic export; the
 * copy is prepared and sent from the support address. One request per 30 days.
 */
export function DataRequestView({ auth, refresh }: { auth: AuthResponse; refresh: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void } }) {
  const { t, i18n } = useTranslation('settings');
  const [latest, setLatest] = useState<DataRequestInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getLatestDataRequest(auth, refresh).then((r) => { if (alive) setLatest(r.latest); }).catch(() => { if (alive) setLatest(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId]);

  const ask = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await requestDataCopy(auth, refresh);
      setLatest(created);
    } catch (err) {
      setError(friendlyError(err, t('data.failed')));
    } finally {
      setBusy(false);
    }
  };

  const recent = latest && Date.now() - Date.parse(latest.createdAtUtc) < 30 * 86_400_000;
  return (
    <View style={styles.wrap} testID="data-request">
      <Text style={styles.body}>{t('data.body')}</Text>
      {latest === undefined ? <ActivityIndicator color={colors.primary} /> : null}
      {recent && latest ? (
        <View style={styles.done} testID="data-request-done">
          <Text style={styles.doneTitle}>{t('data.received', { date: formatDate(latest.createdAtUtc, i18n.language) })}</Text>
          <Text style={styles.body}>{t('data.next')} {SUPPORT_EMAIL}</Text>
        </View>
      ) : latest !== undefined ? (
        <BlinkrButton icon={<Download color={colors.ink} size={18} />} label={t('data.ask')} loading={busy} onPress={() => { void ask(); }} />
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  body: { ...typography.body, color: colors.textSecondary },
  done: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.xs, padding: spacing.lg },
  doneTitle: { ...typography.bodyStrong, color: colors.text },
  error: { ...typography.caption, color: colors.danger },
});
