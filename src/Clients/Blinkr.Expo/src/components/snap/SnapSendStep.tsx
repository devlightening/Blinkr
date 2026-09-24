import { Check, ChevronLeft, Timer, UserPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_TIMER, MAX_CAPTION_LENGTH, cleanCaption, nextTimer, sendButtonLabel, timerLabel, toggleRecipient } from '../../snapPresentation';
// Drawn over live camera/photo/video: always the dark media palette, whatever the app theme (plan-devam B3).
import { media, mediaColors as colors, radii, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import type { CapturedMedia } from '../camera/PhotoEditor';
import { BlinkrButton } from '../ui/BlinkrButton';
import { tx } from '../../i18n/tx';

export type SnapRecipient = { id: string; name: string; userId: string; avatarKey?: string | null };

type Props = {
  /** Always a photo: Snap is sent as a photo only, the same as the camera it comes from. */
  asset: CapturedMedia;
  recipients: SnapRecipient[];
  /** Conversation ids that will receive the snap (owned by the parent so a retry keeps the caption). */
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  /** When set, the recipient list is hidden: this is a reply to exactly that conversation. */
  fixedRecipient?: SnapRecipient | null;
  sending: boolean;
  error: string | null;
  onBack: () => void;
  onAddPerson?: () => void;
  onSend: (conversationIds: string[], options: { durationSeconds: number; caption: string }) => void;
};

/**
 * The last step before a snap leaves: type a short caption, pick how long it can be looked at, choose who
 * gets it, send. The picture itself is already final (lens and stickers were baked in by the camera).
 */
export function SnapSendStep({ asset, recipients, selected, onSelectedChange, fixedRecipient = null, sending, error, onBack, onAddPerson, onSend }: Props) {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [timer, setTimer] = useState(DEFAULT_TIMER);
  const firstName = useMemo(() => recipients.find((item) => item.id === selected[0])?.name ?? fixedRecipient?.name, [recipients, selected, fixedRecipient]);
  const disabled = selected.length === 0 || sending;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <AnimatedPressable accessibilityLabel={tx('common:actions.backShort', 'Geri')} accessibilityRole="button" disabled={sending} onPress={onBack} pressScale={0.95} style={styles.round}>
          <ChevronLeft color={colors.text} size={24} />
        </AnimatedPressable>
        <Text accessibilityRole="header" style={styles.title}>{tx('chat:send.title', 'Snap gönder')}</Text>
        <AnimatedPressable accessibilityLabel={tx('chat:send.timerA11y', 'Süre {{timer}}, değiştir', { timer: timerLabel(timer) })} accessibilityRole="button" disabled={sending} onPress={() => setTimer(nextTimer(timer))} pressScale={0.95} style={styles.timerChip}>
          <Timer color={colors.flare} size={16} />
          <Text style={styles.timerText}>{timerLabel(timer)}</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.preview}>
        <Image accessibilityLabel={tx('chat:send.preview', 'Snap önizleme')} resizeMode="cover" source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} />
        <View pointerEvents="box-none" style={styles.captionWrap}>
          <TextInput
            accessibilityLabel={tx('chat:send.caption', 'Snap yazısı')}
            maxLength={MAX_CAPTION_LENGTH}
            onChangeText={(value) => setCaption(value.replace(/\n/g, ' '))}
            placeholder={tx('chat:send.captionPlaceholder', 'Yazı ekle')}
            placeholderTextColor={media.textSoft}
            style={styles.caption}
            value={caption}
          />
        </View>
      </View>

      {fixedRecipient ? null : (
        <View style={styles.recipients}>
          <View style={styles.recipientsHeader}>
            <Text style={styles.recipientsTitle}>{tx('chat:send.to', 'Kime?')}</Text>
            {onAddPerson ? (
              <AnimatedPressable accessibilityLabel={tx('chat:send.addPersonA11y', 'Yeni kişi ekle')} accessibilityRole="button" onPress={onAddPerson} pressScale={0.97} style={styles.addPerson}>
                <UserPlus color={colors.flare} size={16} />
                <Text style={styles.addPersonText}>{tx('chat:send.addPerson', 'Yeni kişi')}</Text>
              </AnimatedPressable>
            ) : null}
          </View>
          <ScrollView contentContainerStyle={styles.recipientList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {recipients.length === 0 ? <Text style={styles.empty}>{tx('chat:send.noOne', 'Henüz kimseyle sohbetin yok. “Yeni kişi” ile birini bul.')}</Text> : null}
            {recipients.map((item) => {
              const on = selected.includes(item.id);
              return (
                <AnimatedPressable
                  accessibilityLabel={(on ? tx('chat:send.selectedA11y', '{{name}}, seçili', { name: item.name }) : item.name)}
                  accessibilityRole="checkbox"
                  aria-checked={on}
                  disabled={sending}
                  key={item.id}
                  onPress={() => onSelectedChange(toggleRecipient(selected, item.id))}
                  pressScale={0.99}
                  style={styles.recipient}
                >
                  <Avatar avatarKey={item.avatarKey} seed={item.userId} size={36} />
                  <Text numberOfLines={1} style={styles.recipientName}>{item.name}</Text>
                  <View style={[styles.check, on && styles.checkOn]}>{on ? <Check color={colors.ink} size={14} strokeWidth={3} /> : null}</View>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <BlinkrButton
          disabled={disabled}
          label={sendButtonLabel(selected.length, firstName)}
          loading={sending}
          onPress={() => onSend(selected, { caption: cleanCaption(caption), durationSeconds: timer })}
          size="lg"
          style={!disabled && styles.flareButton}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: media.black, zIndex: 250 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  round: { alignItems: 'center', backgroundColor: media.chipStrong, borderRadius: radii.pill, height: 40, justifyContent: 'center', width: 40 },
  title: { ...typography.heading, color: colors.text },
  timerChip: { alignItems: 'center', backgroundColor: media.chipStrong, borderRadius: radii.pill, flexDirection: 'row', gap: 6, height: 40, paddingHorizontal: spacing.md },
  timerText: { ...typography.bodyStrong, color: colors.text, fontVariant: ['tabular-nums'] },
  preview: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, flex: 1, justifyContent: 'flex-end', marginHorizontal: spacing.md, marginVertical: spacing.md, overflow: 'hidden' },
  captionWrap: { bottom: spacing.xl, left: 0, position: 'absolute', right: 0 },
  caption: { ...typography.body, backgroundColor: media.scrimStrong, color: colors.text, minHeight: 44, paddingHorizontal: spacing.lg, textAlign: 'center', width: '100%' },
  recipients: { maxHeight: 210, paddingHorizontal: spacing.md },
  recipientsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  recipientsTitle: { ...typography.heading, color: colors.text, fontSize: 16, lineHeight: 21 },
  addPerson: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 36 },
  addPersonText: { ...typography.bodyStrong, color: colors.flare },
  recipientList: { paddingBottom: spacing.sm },
  empty: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.md },
  recipient: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 52 },
  recipientName: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  check: { alignItems: 'center', borderColor: colors.lineStrong, borderRadius: radii.pill, borderWidth: 2, height: 22, justifyContent: 'center', width: 22 },
  checkOn: { backgroundColor: colors.flare, borderColor: colors.flare },
  bottom: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  flareButton: { backgroundColor: colors.flare },
});
