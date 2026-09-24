import { MonitorSmartphone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getSessions, revokeOtherSessions, type SessionInfo } from '../../api';
import { success } from '../../haptics';
import { displayLocale } from '../../i18n/locale';
import { friendlyError } from '../../productPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { BlinkrButton } from '../ui/BlinkrButton';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

/**
 * Signed-in sessions (SECURITY S6): how many devices are signed in, since when, and "sign out of every other device".
 * This device stays signed in. Two steps, so a stray tap never signs anyone out.
 */
export function SessionsView({ auth, refresh }: { auth: AuthResponse; refresh: Refresh }) {
  const { t } = useTranslation('settings');
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    getSessions(auth, refresh).then((r) => setSessions(r.items)).catch((err) => setError(friendlyError(err)));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [auth.userId]);

  const signOutOthers = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { revoked } = await revokeOtherSessions(auth, refresh);
      setNotice(t('sessions.revoked', { count: revoked }));
      setConfirming(false);
      success();
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="sessions-view">
      <View style={styles.hero}>
        <MonitorSmartphone color={colors.primary} size={28} />
        <Text style={styles.count}>{sessions === null ? '' : t('sessions.count', { count: sessions.length })}</Text>
        <Text style={styles.hint}>{t('sessions.hint')}</Text>
      </View>
      {sessions === null && !error ? <ActivityIndicator color={colors.primary} /> : null}
      {(sessions ?? []).map((session, index) => (
        <View key={session.id} style={styles.row}>
          <Text style={styles.rowTitle}>{t('sessions.item', { index: index + 1 })}</Text>
          <Text style={styles.rowValue}>{t('sessions.since', { date: new Date(session.createdAtUtc).toLocaleString(displayLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}</Text>
        </View>
      ))}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {sessions && sessions.length > 1 ? (
        confirming ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>{t('sessions.confirm')}</Text>
            <BlinkrButton disabled={busy} label={t('sessions.confirmYes')} onPress={() => { void signOutOthers(); }} />
            <BlinkrButton label={t('sessions.cancel')} onPress={() => setConfirming(false)} variant="secondary" />
          </View>
        ) : (
          <BlinkrButton label={t('sessions.signOutOthers')} onPress={() => setConfirming(true)} variant="secondary" />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  count: { ...typography.headline, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  row: { backgroundColor: colors.surface, borderRadius: radii.md, gap: 2, padding: spacing.md },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowValue: { ...typography.caption, color: colors.textSecondary },
  notice: { ...typography.caption, color: colors.primary, textAlign: 'center' },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  confirm: { gap: spacing.sm },
  confirmText: { ...typography.body, color: colors.text, textAlign: 'center' },
});
