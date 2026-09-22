import { Check, Flag } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { success } from '../haptics';
import { REPORT_NOTE_MAX, canSendReport, cleanBio, reportReasons, type ReportReasonId, type ReportTarget } from '../friends';
import { friendlyError } from '../productPresentation';
import { colors, radii, spacing, typography } from '../theme';
import { AnimatedPressable } from './AnimatedPressable';
import { BlinkrButton } from './ui/BlinkrButton';

type Props = {
  target: ReportTarget;
  /** What is being reported, in words the person recognises ("zeynep", "Kent Meydanı'ndaki sinyal"). */
  subject: string;
  /** Sends the report; rejects with the failure to show. Called at most once at a time. */
  onSubmit: (reason: ReportReasonId, note: string) => Promise<void>;
  onDone: () => void;
};

/**
 * The report form, shown inside whatever sheet the person was already in (a profile, a signal). One tap picks a reason, a
 * note is optional. The acknowledgement is honest: the report is stored, nothing more is promised.
 */
export function ReportPanel({ target, subject, onSubmit, onDone }: Props) {
  const [reason, setReason] = useState<ReportReasonId | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const send = async () => {
    if (busy.current || !reason || !canSendReport(reason, note)) return;
    busy.current = true;
    setSending(true);
    setError(null);
    try {
      await onSubmit(reason, cleanBio(note));
      success();
      setSent(true);
    } catch (err) {
      setError(friendlyError(err, 'Bildirim gönderilemedi. Tekrar dene.'));
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.done}>
        <View style={styles.doneIcon}><Check color={colors.primary} size={28} strokeWidth={2.6} /></View>
        <Text accessibilityRole="header" style={styles.doneTitle}>Bildirimin alındı</Text>
        <Text style={styles.doneText}>{target === 'user' ? 'Teşekkürler. Bildirimin kaydedildi. İstersen bu kişiyi engelleyerek onunla tüm teması kesebilirsin.' : 'Teşekkürler. Bildirimin kaydedildi.'}</Text>
        <BlinkrButton label="Tamam" onPress={onDone} size="lg" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Flag color={colors.textSecondary} size={18} />
        <Text accessibilityRole="header" style={styles.title}>Bildir</Text>
      </View>
      <Text numberOfLines={2} style={styles.subject}>{subject}</Text>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.label}>Neden bildiriyorsun?</Text>
        {reportReasons(target).map((item) => {
          const selected = reason === item.id;
          return (
            <AnimatedPressable accessibilityLabel={item.label} accessibilityRole="radio" aria-checked={selected} key={item.id} onPress={() => setReason(item.id)} pressScale={0.99} style={[styles.option, selected && styles.optionSelected]}>
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              <Text style={styles.optionText}>{item.label}</Text>
            </AnimatedPressable>
          );
        })}
        <Text style={[styles.label, styles.noteLabel]}>Eklemek istediğin bir şey var mı? (isteğe bağlı)</Text>
        <TextInput
          accessibilityLabel="Bildirim notu"
          maxLength={REPORT_NOTE_MAX + 40}
          multiline
          onChangeText={setNote}
          placeholder="Kısaca anlat"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={note}
        />
        <Text style={styles.count}>{cleanBio(note).length}/{REPORT_NOTE_MAX}</Text>
      </ScrollView>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <BlinkrButton disabled={!reason || !canSendReport(reason, note)} label="Bildirimi gönder" loading={sending} onPress={() => void send()} style={styles.flex} />
        <BlinkrButton label="Vazgeç" onPress={onDone} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { ...typography.title, color: colors.text },
  subject: { ...typography.caption, color: colors.textSecondary },
  scroll: { flexGrow: 0, maxHeight: 420 },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  noteLabel: { marginTop: spacing.lg },
  option: { alignItems: 'center', borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xs, minHeight: 48, paddingHorizontal: spacing.md },
  optionSelected: { backgroundColor: colors.surfaceElevated, borderColor: colors.primary },
  radio: { alignItems: 'center', borderColor: colors.textSecondary, borderRadius: radii.pill, borderWidth: 2, height: 20, justifyContent: 'center', width: 20 },
  radioSelected: { borderColor: colors.primary },
  radioDot: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 10, width: 10 },
  optionText: { ...typography.body, color: colors.text, flex: 1 },
  input: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, minHeight: 72, padding: spacing.md, textAlignVertical: 'top' },
  count: { ...typography.caption, color: colors.textSecondary, textAlign: 'right' },
  error: { ...typography.body, color: colors.danger },
  actions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flex: { flex: 1 },
  done: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  doneIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radii.pill, height: 56, justifyContent: 'center', width: 56 },
  doneTitle: { ...typography.title, color: colors.text },
  doneText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
