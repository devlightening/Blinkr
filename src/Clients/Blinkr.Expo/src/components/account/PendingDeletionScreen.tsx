import { RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cancelAccountDeletion } from '../../api';
import { friendlyError } from '../../productPresentation';
import { colors, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { BlinkrButton } from '../ui/BlinkrButton';

/**
 * Signing in while the account waits to be deleted (plan-devam F3): nothing else opens until the person decides -
 * keep the account ("Silmeyi geri al") or sign out and let the deletion run on the shown date.
 */
export function PendingDeletionScreen({ auth, onCancelled, onLogout, refresh }: {
  auth: AuthResponse;
  onCancelled: (auth: AuthResponse) => void;
  onLogout: () => void;
  refresh: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
}) {
  const { t, i18n } = useTranslation('settings');
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const when = auth.deletionScheduledForUtc ? new Date(auth.deletionScheduledForUtc) : null;
  const date = when && !Number.isNaN(when.getTime()) ? when.toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await cancelAccountDeletion(auth, refresh);
      onCancelled({ ...auth, deletionScheduledForUtc: null });
    } catch (err) {
      setError(friendlyError(err, t('pending.failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + spacing.xl, paddingTop: insets.top + spacing.xxl }]} testID="pending-deletion">
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>{t('pending.title')}</Text>
        <Text style={styles.body}>{t('pending.body', { date })}</Text>
        <Text style={styles.body}>{t('pending.hint')}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.actions}>
        <BlinkrButton icon={<RotateCcw color={colors.ink} size={18} />} label={t('pending.cancel')} loading={busy} onPress={() => { void cancel(); }} size="lg" />
        <BlinkrButton label={t('pending.logout')} onPress={onLogout} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  copy: { gap: spacing.md },
  title: { ...typography.display, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.danger },
  actions: { gap: spacing.sm },
});
