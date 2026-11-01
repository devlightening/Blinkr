import { AlertTriangle, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { requestAccountDeletion } from '../../api';
import { friendlyError } from '../../productPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { BlinkrButton } from '../ui/BlinkrButton';

/**
 * "Hesabı sil" (plan-devam F3), in two steps: first what happens (30 days, what is erased, how to change your mind),
 * then the password. After it the session ends; signing in within 30 days offers to cancel.
 */
export function DeleteAccountView({ auth, refresh, onDeleted }: {
  auth: AuthResponse;
  refresh: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
  onDeleted: () => void;
}) {
  const { t } = useTranslation('settings');
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await requestAccountDeletion(auth, password, refresh);
      onDeleted();
    } catch (err) {
      setError(friendlyError(err, t('deletion.failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} testID="delete-account">
      <View style={styles.warning}>
        <AlertTriangle color={colors.danger} size={20} />
        <Text style={styles.warningTitle}>{t('deletion.title')}</Text>
      </View>
      {step === 1 ? (
        <>
          {(['what', 'grace', 'chats', 'keep'] as const).map((key) => (
            <Text key={key} style={styles.point}>• {t(`deletion.points.${key}`)}</Text>
          ))}
          <BlinkrButton label={t('deletion.continue')} onPress={() => setStep(2)} style={styles.action} variant="danger" />
        </>
      ) : (
        <>
          <Text style={styles.point}>{t('deletion.passwordHint')}</Text>
          <TextInput
            accessibilityLabel={t('deletion.password')}
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder={t('deletion.password')}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <BlinkrButton
            disabled={!password}
            icon={<Trash2 color={colors.danger} size={18} />}
            label={t('deletion.confirm')}
            loading={busy}
            onPress={() => { void confirm(); }}
            style={styles.action}
            variant="danger"
          />
          <BlinkrButton label={t('deletion.back')} onPress={() => { setStep(1); setError(null); }} variant="ghost" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  warning: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  warningTitle: { ...typography.heading, color: colors.text, flex: 1 },
  point: { ...typography.body, color: colors.textSecondary },
  input: { ...typography.body, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, minHeight: 48, paddingHorizontal: spacing.md },
  error: { ...typography.caption, color: colors.danger },
  action: { marginTop: spacing.sm },
});
