import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, motion, radii, shadow, spacing, typography } from '../../theme';

export type ToastTone = 'success' | 'error' | 'info';

type Props = {
  /** `null` renders nothing. Owned by the caller, not internal state - so a second toast can replace the first. */
  message: string | null;
  tone?: ToastTone;
  onHide: () => void;
  /** ms before it clears itself; 0 disables the auto-dismiss (the caller decides when to clear `message`). */
  durationMs?: number;
};

const TONE: Record<ToastTone, { bg: string; border: string; text: string }> = {
  success: { bg: colors.greenSoft, border: colors.greenLine, text: colors.text },
  error: { bg: colors.errorSoft, border: colors.errorLine, text: colors.danger },
  info: { bg: colors.glass, border: colors.border, text: colors.text },
};

/**
 * A short, top-anchored confirmation ("Paylaşıldı", "Kaydedildi") that clears itself
 * (03_DESIGN_SYSTEM.md §7). Several screens already roll their own version of this (`MapScreen`'s
 * success/error banner, `ChatListScreen`'s `notice`); this is the shared one for new screens - the
 * working ones are not forced onto it just to remove the duplication.
 */
export function Toast({ message, tone = 'info', onHide, durationMs = 3000 }: Props) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message || durationMs <= 0) return undefined;
    const timer = setTimeout(onHide, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onHide]);

  if (!message) return null;
  const palette = TONE[tone];
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      entering={FadeIn.duration(motion.base)}
      exiting={FadeOut.duration(motion.fast)}
      style={[styles.toast, { top: insets.top + spacing.sm, backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text numberOfLines={2} style={[styles.text, { color: palette.text }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { alignSelf: 'center', borderRadius: radii.pill, borderWidth: 1, left: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, position: 'absolute', right: spacing.lg, zIndex: 300, ...shadow },
  text: { ...typography.bodyStrong, textAlign: 'center' },
});
