import { StyleSheet, Text, View } from 'react-native';
import { Camera, Check, ChevronRight, ImagePlus, PenLine } from 'lucide-react-native';

import type { CompletionStep, ProfileCompletion } from '../../profileCompletion';
import { colors, radii, shadowSoft, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { tx } from '../../i18n/tx';

const LABELS: Record<CompletionStep, () => string> = {
  photo: () => tx('profile:complete.photo', 'Fotoğraf ya da avatar seç'),
  bio: () => tx('profile:complete.bio', 'Kendini kısaca tanıt'),
  signal: () => tx('profile:complete.signal', 'İlk sinyalini bırak'),
};

const ICONS: Record<CompletionStep, (color: string) => React.ReactNode> = {
  photo: (c) => <ImagePlus color={c} size={18} />,
  bio: (c) => <PenLine color={c} size={18} />,
  signal: (c) => <Camera color={c} size={18} />,
};

/** Doc P8: the three-step "complete your profile" card; each open step is a shortcut to doing it. */
export function ProfileCompletionCard({ completion, onStep }: { completion: ProfileCompletion; onStep: (step: CompletionStep) => void }) {
  const share = completion.done / completion.total;
  return (
    <View style={styles.card} testID="profile-completion">
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>{tx('profile:complete.title', 'Profilini tamamla')}</Text>
        <Text style={styles.count}>{tx('profile:complete.count', '{{done}}/{{total}}', { done: completion.done, total: completion.total })}</Text>
      </View>
      <View accessibilityLabel={tx('profile:complete.progressA11y', '{{done}} / {{total}} adım tamam', { done: completion.done, total: completion.total })} style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
      </View>
      {completion.steps.map(({ step, done }) => (
        <AnimatedPressable
          accessibilityLabel={LABELS[step]()}
          accessibilityRole="button"
          accessibilityState={{ checked: done, disabled: done }}
          disabled={done}
          key={step}
          onPress={() => onStep(step)}
          pressScale={0.98}
          style={styles.row}
        >
          <View style={[styles.icon, done && styles.iconDone]}>{done ? <Check color={colors.ink} size={16} strokeWidth={2.6} /> : ICONS[step](colors.text)}</View>
          <Text style={[styles.label, done && styles.labelDone]}>{LABELS[step]()}</Text>
          {done ? null : <ChevronRight color={colors.textSecondary} size={18} />}
        </AnimatedPressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.xs, padding: spacing.md, ...shadowSoft },
  head: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...typography.heading, color: colors.text },
  count: { ...typography.label, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  track: { backgroundColor: colors.meterEmpty, borderRadius: radii.pill, height: 6, marginBottom: spacing.xs, overflow: 'hidden' },
  fill: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 6 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 44 },
  icon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 32, justifyContent: 'center', width: 32 },
  iconDone: { backgroundColor: colors.primary },
  label: { ...typography.body, color: colors.text, flex: 1 },
  labelDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
});
