import { CheckCircle2, KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiCodeError, changePassword } from '../../api';
import { tx } from '../../i18n/tx';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { BlinkrButton } from '../ui/BlinkrButton';

const MIN = 8;
const MAX = 128;

/** Ayarlar > Hesap > Şifreyi değiştir. The server checks the current password; other devices are signed out. */
export function ChangePasswordView({ auth, refresh, onDone }: {
  auth: AuthResponse;
  refresh: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
  onDone: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<number | null>(null);

  // What is wrong before asking the server (the server checks the same rules).
  const localProblem = !next ? null
    : next.length < MIN ? tx('settings:password.tooShort', 'Yeni şifre en az 8 karakter olmalı.')
    : next.length > MAX ? tx('settings:password.tooLong', 'Yeni şifre en fazla 128 karakter olabilir.')
    : again && again !== next ? tx('settings:password.mismatch', 'Yeni şifreler aynı değil.')
    : null;
  const ready = Boolean(current && next && again) && !localProblem && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const result = await changePassword(auth, current, next, refresh);
      setEnded(result?.sessionsEnded ?? 0);
    } catch (err) {
      const code = err instanceof ApiCodeError ? err.code : null;
      setError(code === 'WRONG_PASSWORD' ? tx('settings:password.wrong', 'Mevcut şifre doğru değil.')
        : code === 'PASSWORD_UNCHANGED' ? tx('settings:password.unchanged', 'Yeni şifre eskisiyle aynı olamaz.')
        : code === 'PASSWORD_TOO_SHORT' ? tx('settings:password.tooShort', 'Yeni şifre en az 8 karakter olmalı.')
        : code === 'PASSWORD_TOO_LONG' ? tx('settings:password.tooLong', 'Yeni şifre en fazla 128 karakter olabilir.')
        : code === 'TOO_MANY_ATTEMPTS' ? tx('settings:password.tooMany', 'Çok fazla deneme yaptın. Biraz sonra tekrar dene.')
        : tx('settings:password.failed', 'Şifre değiştirilemedi. Tekrar dene.'));
    } finally {
      setBusy(false);
    }
  };

  if (ended !== null) {
    return (
      <View style={styles.wrap} testID="password-changed">
        <View style={styles.head}><CheckCircle2 color={colors.mint} size={22} /><Text style={styles.title}>{tx('settings:password.done', 'Şifren değişti')}</Text></View>
        <Text style={styles.hint}>{ended > 0
          ? tx('settings:password.doneOthers', 'Diğer cihazlardaki {{count}} oturum kapatıldı; bu cihazda oturumun açık.', { count: ended })
          : tx('settings:password.doneAlone', 'Bu cihazda oturumun açık.')}</Text>
        <BlinkrButton label={tx('common:actions.done', 'Tamam')} onPress={onDone} variant="secondary" />
      </View>
    );
  }

  const field = (label: string, value: string, set: (v: string) => void, testID: string, autoComplete: 'password' | 'new-password') => (
    <TextInput
      accessibilityLabel={label}
      autoCapitalize="none"
      autoComplete={autoComplete}
      autoCorrect={false}
      maxLength={MAX + 1}
      onChangeText={(v) => { set(v); setError(null); }}
      placeholder={label}
      placeholderTextColor={colors.textSecondary}
      secureTextEntry
      style={styles.input}
      testID={testID}
      value={value}
    />
  );

  return (
    <View style={styles.wrap} testID="change-password">
      <View style={styles.head}><KeyRound color={colors.text} size={20} /><Text style={styles.title}>{tx('settings:password.title', 'Şifreyi değiştir')}</Text></View>
      <Text style={styles.hint}>{tx('settings:password.hint', 'En az 8 karakter. Değiştirince diğer cihazlardaki oturumların kapanır; bu cihazda açık kalır.')}</Text>
      {field(tx('settings:password.current', 'Mevcut şifre'), current, setCurrent, 'password-current', 'password')}
      {field(tx('settings:password.new', 'Yeni şifre'), next, setNext, 'password-new', 'new-password')}
      {field(tx('settings:password.again', 'Yeni şifre (tekrar)'), again, setAgain, 'password-again', 'new-password')}
      {localProblem || error ? <Text accessibilityRole="alert" style={styles.error}>{localProblem ?? error}</Text> : null}
      <BlinkrButton disabled={!ready} label={tx('settings:password.save', 'Şifreyi değiştir')} loading={busy} onPress={() => { void submit(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  hint: { ...typography.body, color: colors.textSecondary },
  input: { ...typography.body, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, minHeight: 48, paddingHorizontal: spacing.md },
  error: { ...typography.caption, color: colors.danger },
});
