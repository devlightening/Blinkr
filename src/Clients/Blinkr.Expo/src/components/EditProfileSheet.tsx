import { Camera, Image as ImageIcon, Smile, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { removeProfilePhoto, setMyProfile, setProfilePhoto } from '../api';
import { BIO_MAX, bioState } from '../friends';
import { success } from '../haptics';
import { rememberPerson } from '../people';
import { friendlyError } from '../productPresentation';
import { DISPLAY_NAME_MAX, displayNameState, pickProfilePhoto } from '../profilePhoto';
import { colors, radii, spacing, typography } from '../theme';
import type { AuthResponse } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { Avatar } from './Avatar';
import { Sheet } from './Sheet';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrSheetPanel } from './ui/BlinkrSheetPanel';
import { PersonalDataNotice } from './ui/PersonalDataNotice';
import { tx } from '../i18n/tx';

type Props = {
  auth: AuthResponse;
  bio: string;
  displayName: string;
  /** The current profile photo version (null = the drawn avatar). */
  photoVersion: string | null;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  /** The avatar picker is a separate sheet; this just asks the profile to open it. */
  onChangeAvatar: () => void;
  onSaved: (profile: { bio: string | null; displayName: string | null }) => void;
  onPhotoChange: (photoVersion: string | null) => void;
  onClose: () => void;
};

/**
 * My public identity (D-032): an optional photo (the drawn avatar stays the default and the fallback), an optional
 * display name above @username, and the short line about me. A photo is never shown on map pins or anonymous signals.
 */
export function EditProfileSheet({ auth, bio, displayName, photoVersion, onAuthChange, onSessionExpired, onChangeAvatar, onSaved, onPhotoChange, onClose }: Props) {
  const [text, setText] = useState(bio);
  const [name, setName] = useState(displayName);
  const [photo, setPhoto] = useState(photoVersion);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = { onAuthRefresh: onAuthChange, onSessionExpired };
  const state = bioState(text);
  const nameState = displayNameState(name);
  const unchanged = state.value === bioState(bio).value && nameState.value === displayNameState(displayName).value;

  const applyPhoto = (version: string | null) => {
    setPhoto(version);
    onPhotoChange(version);
    // Every avatar of mine (bottom bar, comments, chat) switches at once.
    rememberPerson(auth.userId, { photoVersion: version });
  };

  const choosePhoto = async (source: 'camera' | 'library') => {
    if (photoBusy) return;
    setError(null);
    try {
      const files = await pickProfilePhoto(source);
      if (!files) return;
      setPhotoBusy(true);
      const saved = await setProfilePhoto(auth, files, refresh);
      applyPhoto(saved.photoVersion);
      success();
    } catch (err) {
      setError(friendlyError(err, tx('profile:photo.failed', 'Fotoğraf yüklenemedi. Tekrar dene.')));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    setError(null);
    try {
      await removeProfilePhoto(auth, refresh);
      applyPhoto(null);
    } catch (err) {
      setError(friendlyError(err, tx('profile:photo.removeFailed', 'Fotoğraf kaldırılamadı. Tekrar dene.')));
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    if (saving || state.tooLong || nameState.tooLong || unchanged) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await setMyProfile(auth, { bio: state.empty ? null : state.value, displayName: nameState.value }, refresh);
      rememberPerson(auth.userId, { displayName: saved.displayName ?? null });
      onSaved({ bio: saved.bio ?? null, displayName: saved.displayName ?? null });
      success();
      onClose();
    } catch (err) {
      setError(friendlyError(err, tx('profile:edit.failed', 'Profil kaydedilemedi. Tekrar dene.')));
      setSaving(false);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <BlinkrSheetPanel maxHeightRatio={0.92}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.heading}>{tx('profile:me.edit', 'Profili düzenle')}</Text>
          <View style={styles.photoBlock}>
            <View style={photoBusy && styles.busy}>
              <Avatar avatarKey={auth.avatarKey} photoVersion={photo} seed={auth.userId} size={96} userId={auth.userId} />
            </View>
            <View style={styles.photoActions}>
              <PhotoAction icon={<Camera color={colors.text} size={18} />} label={tx('profile:photo.take', 'Fotoğraf çek')} onPress={() => void choosePhoto('camera')} testID="photo-camera" />
              <PhotoAction icon={<ImageIcon color={colors.text} size={18} />} label={tx('profile:photo.pick', 'Galeriden seç')} onPress={() => void choosePhoto('library')} testID="photo-library" />
              <PhotoAction icon={<Smile color={colors.text} size={18} />} label={tx('profile:photo.avatar', 'Avatar seç')} onPress={onChangeAvatar} testID="photo-avatar" />
              {photo ? <PhotoAction icon={<Trash2 color={colors.danger} size={18} />} label={tx('profile:photo.remove', 'Fotoğrafı kaldır')} onPress={() => void removePhoto()} testID="photo-remove" tone="danger" /> : null}
            </View>
          </View>
          <Text style={styles.photoHelp}>{tx('profile:photo.help', 'Fotoğrafın profilinde, sohbette ve yorumlarda görünür. Haritada ve anonim paylaşımlarında asla görünmez.')}</Text>

          <Text style={styles.label}>{tx('profile:edit.name', 'Ad')}</Text>
          <TextInput
            accessibilityLabel={tx('profile:edit.name', 'Ad')}
            maxLength={DISPLAY_NAME_MAX + 10}
            onChangeText={setName}
            placeholder={tx('profile:edit.namePlaceholder', 'Adın (isteğe bağlı)')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.nameInput, nameState.tooLong && styles.inputError]}
            testID="display-name-input"
            value={name}
          />
          <View style={styles.meta}>
            <Text style={styles.help}>@{auth.userName}</Text>
            <Text style={[styles.count, nameState.tooLong && styles.countError]}>{nameState.length}/{DISPLAY_NAME_MAX}</Text>
          </View>

          <Text style={styles.label}>{tx('profile:edit.about', 'Hakkında')}</Text>
          <TextInput
            accessibilityLabel={tx('profile:edit.about', 'Hakkında')}
            multiline
            onChangeText={setText}
            placeholder={tx('profile:edit.placeholder', 'Kendini kısaca tanıt. Kahve, yürüyüş, hangi semt…')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, state.tooLong && styles.inputError]}
            value={text}
          />
          <View style={styles.meta}>
            <Text style={styles.help}>{tx('profile:edit.help', 'Herkes görebilir. Konumun ve e-postan paylaşılmaz.')}</Text>
            <Text accessibilityLabel={`${state.length} / ${BIO_MAX} karakter`} style={[styles.count, state.tooLong && styles.countError]}>{state.length}/{BIO_MAX}</Text>
          </View>
          <PersonalDataNotice texts={[text, name]} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <BlinkrButton disabled={state.tooLong || nameState.tooLong || unchanged} label={tx('common:actions.save', 'Kaydet')} loading={saving} onPress={() => void save()} size="lg" />
        </ScrollView>
      </BlinkrSheetPanel>
    </Sheet>
  );
}

function PhotoAction({ icon, label, onPress, testID, tone }: { icon: React.ReactNode; label: string; onPress: () => void; testID: string; tone?: 'danger' }) {
  return (
    <AnimatedPressable accessibilityRole="button" onPress={onPress} pressScale={0.96} style={styles.action} testID={testID}>
      {icon}
      <Text style={[styles.actionText, tone === 'danger' && styles.actionDanger]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.title, color: colors.text, marginBottom: spacing.md },
  photoBlock: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm },
  busy: { opacity: 0.5 },
  photoActions: { flex: 1, gap: spacing.xs },
  action: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 36 },
  actionText: { ...typography.callout, color: colors.text },
  actionDanger: { color: colors.danger },
  photoHelp: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  nameInput: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, minHeight: 48, paddingHorizontal: spacing.md },
  input: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, minHeight: 96, padding: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  meta: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', marginBottom: spacing.lg, marginTop: spacing.xs },
  help: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  count: { ...typography.caption, color: colors.textSecondary },
  countError: { color: colors.danger },
  error: { ...typography.body, color: colors.danger, marginBottom: spacing.md },
});
