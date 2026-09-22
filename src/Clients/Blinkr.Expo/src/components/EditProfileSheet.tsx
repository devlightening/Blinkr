import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { setMyBio } from '../api';
import { BIO_MAX, bioState } from '../friends';
import { success } from '../haptics';
import { friendlyError } from '../productPresentation';
import { colors, radii, spacing, typography } from '../theme';
import type { AuthResponse } from '../types';
import { Avatar } from './Avatar';
import { Sheet } from './Sheet';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrSheetPanel } from './ui/BlinkrSheetPanel';

type Props = {
  auth: AuthResponse;
  bio: string;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  /** The avatar picker is a separate sheet; this just asks the profile to open it. */
  onChangeAvatar: () => void;
  onSaved: (bio: string | null) => void;
  onClose: () => void;
};

/** The short public line about me. Everything else on a public profile comes from what I really did in the app. */
export function EditProfileSheet({ auth, bio, onAuthChange, onSessionExpired, onChangeAvatar, onSaved, onClose }: Props) {
  const [text, setText] = useState(bio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = bioState(text);
  const unchanged = state.value === bioState(bio).value;

  const save = async () => {
    if (saving || state.tooLong || unchanged) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await setMyBio(auth, state.empty ? null : state.value, { onAuthRefresh: onAuthChange, onSessionExpired });
      onSaved(saved.bio ?? null);
      success();
      onClose();
    } catch (err) {
      setError(friendlyError(err, 'Profil kaydedilemedi. Tekrar dene.'));
      setSaving(false);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <BlinkrSheetPanel maxHeightRatio={0.92}>
        <Text accessibilityRole="header" style={styles.heading}>Profili düzenle</Text>
        <View style={styles.avatarRow}>
          <Avatar avatarKey={auth.avatarKey} seed={auth.userId} size={56} />
          <View style={styles.avatarCopy}>
            <Text style={styles.name}>{auth.userName}</Text>
            <BlinkrButton label="Avatarı değiştir" onPress={onChangeAvatar} style={styles.avatarButton} variant="ghost" />
          </View>
        </View>
        <Text style={styles.label}>Hakkında</Text>
        <TextInput
          accessibilityLabel="Hakkında"
          multiline
          onChangeText={setText}
          placeholder="Kendini kısaca tanıt. Kahve, yürüyüş, hangi semt…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, state.tooLong && styles.inputError]}
          value={text}
        />
        <View style={styles.meta}>
          <Text style={styles.help}>Herkes görebilir. Konumun ve e-postan paylaşılmaz.</Text>
          <Text accessibilityLabel={`${state.length} / ${BIO_MAX} karakter`} style={[styles.count, state.tooLong && styles.countError]}>{state.length}/{BIO_MAX}</Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <BlinkrButton disabled={state.tooLong || unchanged} label="Kaydet" loading={saving} onPress={() => void save()} size="lg" />
      </BlinkrSheetPanel>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.title, color: colors.text, marginBottom: spacing.md },
  avatarRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  avatarCopy: { alignItems: 'flex-start', flex: 1 },
  name: { ...typography.heading, color: colors.text },
  avatarButton: { minHeight: 32, paddingHorizontal: 0 },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  input: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, minHeight: 96, padding: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  meta: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', marginBottom: spacing.lg, marginTop: spacing.xs },
  help: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  count: { ...typography.caption, color: colors.textSecondary },
  countError: { color: colors.danger },
  error: { ...typography.body, color: colors.danger, marginBottom: spacing.md },
});
