import { Check, Shuffle } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { setMyAvatar } from '../api';
import {
  AVATAR_ACCESSORY_COUNT, AVATAR_ACCESSORY_NAMES, AVATAR_COLORS, AVATAR_COLOR_NAMES, AVATAR_FACE_COUNT, AVATAR_FACE_NAMES,
  avatarKeyOf, randomAvatarConfig, resolveAvatar, type AvatarConfig,
} from '../avatars';
import { friendlyError } from '../productPresentation';
import { colors, radii, spacing, typography } from '../theme';
import type { AuthResponse } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { Avatar } from './Avatar';
import { Sheet } from './Sheet';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrSheetPanel } from './ui/BlinkrSheetPanel';
import { tx } from '../i18n/tx';

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  onClose: () => void;
};

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

/** Choose colour, face and accessory with a live preview. Saving stores the three-digit key on the account. */
export function AvatarPickerSheet({ auth, onAuthChange, onSessionExpired, onClose }: Props) {
  const [config, setConfig] = useState<AvatarConfig>(() => resolveAvatar(auth.avatarKey, auth.userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = avatarKeyOf(config);
  const unchanged = key === avatarKeyOf(resolveAvatar(auth.avatarKey, auth.userId)) && Boolean(auth.avatarKey);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await setMyAvatar(auth, key, onAuthChange, onSessionExpired);
      onAuthChange({ ...auth, avatarKey: saved.avatarKey ?? key });
      onClose();
    } catch (err) {
      setError(friendlyError(err, tx('profile:avatar.saveFailed', 'Avatar kaydedilemedi. Tekrar dene.')));
      setSaving(false);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <BlinkrSheetPanel maxHeightRatio={0.92}>
        <Text accessibilityRole="header" style={styles.heading}>{tx('profile:avatar.title', 'Avatarını seç')}</Text>
        <Text style={styles.hint}>{tx('profile:avatar.hint', 'Sohbetlerde ve profilinde bu karakter görünür. Fotoğrafın hiçbir yerde saklanmaz.')}</Text>
        <View style={styles.preview}>
          <Avatar avatarKey={key} ringColor={colors.primary} seed={auth.userId} size={96} />
          <AnimatedPressable accessibilityLabel={tx('profile:avatar.shuffle', 'Rastgele avatar')} accessibilityRole="button" onPress={() => setConfig(randomAvatarConfig())} pressScale={0.92} style={styles.shuffle}>
            <Shuffle color={colors.text} size={20} />
            <Text style={styles.shuffleText}>{tx('profile:avatar.random', 'Rastgele')}</Text>
          </AnimatedPressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} style={styles.scrollView}>
          <Text style={styles.section}>{tx('profile:avatar.colour', 'Renk')}</Text>
          <View style={styles.row}>
            {range(AVATAR_COLORS.length).map((color) => (
              <AnimatedPressable accessibilityLabel={`${AVATAR_COLOR_NAMES[color]} renk`} accessibilityRole="button" aria-selected={config.color === color} key={color} onPress={() => setConfig({ ...config, color })} pressScale={0.9} style={[styles.swatchRing, config.color === color && styles.selectedRing]}>
                <View style={[styles.swatch, { backgroundColor: AVATAR_COLORS[color] }]}>{config.color === color ? <Check color={colors.ink} size={18} strokeWidth={3} /> : null}</View>
              </AnimatedPressable>
            ))}
          </View>

          <Text style={styles.section}>{tx('profile:avatar.face', 'Yüz')}</Text>
          <View style={styles.row}>
            {range(AVATAR_FACE_COUNT).map((face) => (
              <AnimatedPressable accessibilityLabel={tx('profile:avatar.faceA11y', '{{name}} yüz', { name: AVATAR_FACE_NAMES[face] })} accessibilityRole="button" aria-selected={config.face === face} key={face} onPress={() => setConfig({ ...config, face })} pressScale={0.9} style={[styles.tile, config.face === face && styles.selectedRing]}>
                <Avatar avatarKey={avatarKeyOf({ ...config, face })} seed={auth.userId} size={52} />
              </AnimatedPressable>
            ))}
          </View>

          <Text style={styles.section}>{tx('profile:avatar.accessory', 'Aksesuar')}</Text>
          <View style={styles.row}>
            {range(AVATAR_ACCESSORY_COUNT).map((accessory) => (
              <AnimatedPressable accessibilityLabel={`${AVATAR_ACCESSORY_NAMES[accessory]} aksesuar`} accessibilityRole="button" aria-selected={config.accessory === accessory} key={accessory} onPress={() => setConfig({ ...config, accessory })} pressScale={0.9} style={[styles.tile, config.accessory === accessory && styles.selectedRing]}>
                <Avatar avatarKey={avatarKeyOf({ ...config, accessory })} seed={auth.userId} size={52} />
              </AnimatedPressable>
            ))}
          </View>
        </ScrollView>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <BlinkrButton disabled={unchanged} icon={<Check color={colors.ink} size={22} />} label={tx('common:actions.save', 'Kaydet')} loading={saving} onPress={save} size="lg" style={styles.save} />
      </BlinkrSheetPanel>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.title, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  scrollView: { flexShrink: 1 },
  scroll: { gap: spacing.sm, paddingBottom: spacing.md, paddingTop: spacing.md },
  preview: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, justifyContent: 'center', marginTop: spacing.md },
  shuffle: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  shuffleText: { ...typography.bodyStrong, color: colors.text },
  section: { ...typography.label, color: colors.textSecondary, marginTop: spacing.md, textTransform: 'none' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatchRing: { alignItems: 'center', borderColor: 'transparent', borderRadius: radii.pill, borderWidth: 3, height: 52, justifyContent: 'center', width: 52 },
  swatch: { alignItems: 'center', borderRadius: radii.pill, height: 40, justifyContent: 'center', width: 40 },
  tile: { alignItems: 'center', borderColor: 'transparent', borderRadius: radii.pill, borderWidth: 3, height: 58, justifyContent: 'center', width: 58 },
  selectedRing: { borderColor: colors.primary },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  save: { marginTop: spacing.xs },
});
