import { AlertCircle, CloudOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { OutboxItem } from '../../shareQueue';
import { colors, motion, radii, shadowSoft, spacing, typography } from '../../theme';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';

/**
 * plan-devam D9: the small chip on the map while shares are going out in the background - "Paylaşılıyor…", waiting
 * for a connection, or refused by the server (with retry / discard). Nothing is shown when the outbox is empty.
 */
export function ShareProgressChip({ items, onRetry, onDiscard, bottom }: {
  items: OutboxItem[];
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  bottom: number;
}) {
  const { t } = useTranslation('create');
  if (items.length === 0) return null;
  const failed = items.find((item) => item.status === 'failed');
  const busy = items.some((item) => item.status === 'sending' || (item.status === 'pending' && item.attempts === 0));
  const waiting = items.filter((item) => item.status === 'pending').length;

  return (
    <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} style={[styles.chip, failed && styles.failed, { bottom }]} testID="share-progress">
      {failed ? (
        <>
          <AlertCircle color={colors.danger} size={18} />
          <View style={styles.flex}>
            <Text style={[styles.text, styles.failedText]}>{t('outbox.failed')}</Text>
            {failed.lastError ? <Text numberOfLines={2} style={styles.detail}>{friendlyError(new Error(failed.lastError))}</Text> : null}
          </View>
          <AnimatedPressable accessibilityRole="button" hitSlop={6} onPress={() => onRetry(failed.id)} style={styles.action}><Text style={styles.actionText}>{t('outbox.retry')}</Text></AnimatedPressable>
          <AnimatedPressable accessibilityRole="button" hitSlop={6} onPress={() => onDiscard(failed.id)} style={styles.action}><Text style={styles.discardText}>{t('outbox.discard')}</Text></AnimatedPressable>
        </>
      ) : busy ? (
        <>
          <ActivityIndicator color={colors.mint} size="small" />
          <Text accessibilityLiveRegion="polite" style={[styles.text, styles.flex]}>{t('outbox.sending')}</Text>
        </>
      ) : (
        <>
          <CloudOff color={colors.textSecondary} size={18} />
          <Text accessibilityLiveRegion="polite" style={[styles.text, styles.flex]}>{t('outbox.waiting', { count: waiting })}</Text>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.control, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, left: spacing.lg, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, position: 'absolute', right: spacing.lg, zIndex: 16, ...shadowSoft },
  failed: { backgroundColor: colors.errorSoft, borderColor: colors.errorLine },
  flex: { flex: 1 },
  text: { ...typography.callout, color: colors.text },
  failedText: { color: colors.danger, fontWeight: '700' },
  detail: { ...typography.caption, color: colors.danger },
  action: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 6 },
  actionText: { ...typography.button, color: colors.mint },
  discardText: { ...typography.button, color: colors.textSecondary },
});
