import { Heart } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { formatCount } from '../../engagement';
import * as haptics from '../../haptics';
import { HEART, REACTIONS, topReactions, totalReactions, type ReactionState } from '../../reactions';
import { colors, radii, shadowFloat, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';

type Props = {
  state: ReactionState;
  disabled?: boolean;
  /** Tap: the heart on, or my reaction off. */
  onTap: () => void;
  /** Long press, then an emoji: set it (the same one again takes it back). */
  onPick: (reaction: string) => void;
  size?: number;
  testID?: string;
};

/**
 * The like button with reactions (V2-4, D-027): a tap likes with the heart (or takes my reaction back); a long press
 * opens the six emojis above it. It shows my emoji instead of the heart, the total, and the most used emojis when
 * people reacted with more than the heart.
 */
export function ReactionButton({ state, disabled = false, onTap, onPick, size = 22, testID }: Props) {
  const { t, i18n } = useTranslation('signal');
  const lang = i18n.language === 'en' ? 'en' : 'tr';
  const [picking, setPicking] = useState(false);
  const total = totalReactions(state.counts);
  const summary = topReactions(state.counts);
  const showSummary = summary.length > 1 || (summary.length === 1 && summary[0] !== HEART);
  const mine = state.mine;

  return (
    <View style={styles.wrap}>
      {picking ? (
        <Animated.View
          entering={FadeIn.duration(120).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(100).reduceMotion(ReduceMotion.System)}
          style={styles.picker}
          testID={testID ? `${testID}-picker` : undefined}
        >
          {REACTIONS.map((reaction) => (
            <AnimatedPressable
              accessibilityLabel={t('reactions.pick', { emoji: reaction })}
              accessibilityRole="button"
              aria-selected={mine === reaction}
              key={reaction}
              onPress={() => { setPicking(false); haptics.tap(); onPick(reaction); }}
              pressScale={0.8}
              style={[styles.choice, mine === reaction && styles.choiceOn]}
            >
              <Text style={styles.choiceText}>{reaction}</Text>
            </AnimatedPressable>
          ))}
        </Animated.View>
      ) : null}
      <AnimatedPressable
        accessibilityHint={disabled ? undefined : t('reactions.hint')}
        accessibilityLabel={mine === HEART ? t('engagement.unlike') : mine ? t('reactions.remove', { emoji: mine }) : t('engagement.like')}
        accessibilityRole="button"
        aria-selected={Boolean(mine)}
        delayLongPress={300}
        disabled={disabled}
        onLongPress={() => { haptics.tap(); setPicking((v) => !v); }}
        onPress={() => { if (picking) { setPicking(false); return; } onTap(); }}
        pressScale={0.9}
        style={[styles.button, disabled && styles.dim]}
        testID={testID}
      >
        {mine && mine !== HEART
          ? <Text style={styles.mine}>{mine}</Text>
          : <Heart color={mine ? colors.danger : colors.text} fill={mine ? colors.danger : 'none'} size={size} />}
        <Text style={styles.count}>{formatCount(total, lang)}</Text>
        {showSummary ? <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.summary}>{summary.join('')}</Text> : null}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  button: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 44, minWidth: 44 },
  dim: { opacity: 0.45 },
  mine: { ...typography.title, textAlign: 'center' },
  count: { ...typography.number, color: colors.text },
  summary: { ...typography.caption, color: colors.textSecondary },
  picker: {
    ...shadowFloat,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    bottom: 48,
    flexDirection: 'row',
    gap: 2,
    left: -spacing.xs,
    padding: spacing.xs,
    position: 'absolute',
    zIndex: 20,
  },
  choice: { alignItems: 'center', borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  choiceOn: { backgroundColor: colors.surface },
  choiceText: { ...typography.headline },
});
