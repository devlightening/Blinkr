import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, CalendarClock, Minus, Plus } from 'lucide-react-native';

import { formatMeetupTime, meetupTimeOptions, nudgeMeetupTime } from '../../meetup';
import { colors, radii, sizes, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { tx } from '../../i18n/tx';

/**
 * Doc B2: when to meet. Quick choices (30 dk, 1 saat, bu akşam, yarın) and a quarter-hour nudge, no date wheel; every
 * time stays inside the server's window (now to 14 days). The place was chosen before; only it and the time are sent.
 */
export function MeetupTimePicker({ placeName, onBack, onPropose }: { placeName: string; onBack: () => void; onPropose: (at: Date) => void }) {
  const now = useMemo(() => new Date(), []);
  const options = useMemo(() => meetupTimeOptions(now), [now]);
  const [at, setAt] = useState<Date>(() => options[0]?.at ?? now);

  return (
    <View style={styles.sheet}>
      <View style={styles.bar}>
        <AnimatedPressable accessibilityLabel={tx('common:actions.back', 'Geri dön')} accessibilityRole="button" hitSlop={10} onPress={onBack} pressScale={0.9} style={styles.back}>
          <ArrowLeft color={colors.text} size={22} />
        </AnimatedPressable>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.title}>{tx('chat:meetup.title', 'Buluşalım')}</Text>
          <Text numberOfLines={1} style={styles.place}>{placeName}</Text>
        </View>
      </View>

      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option.at.getTime() === at.getTime();
          return (
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.key}
              onPress={() => setAt(option.at)}
              pressScale={0.95}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <View style={styles.stepper}>
        <AnimatedPressable accessibilityLabel={tx('chat:meetup.earlier', '15 dk erken')} accessibilityRole="button" onPress={() => setAt((current) => nudgeMeetupTime(current, -1, new Date()))} pressScale={0.9} style={styles.step}>
          <Minus color={colors.text} size={18} />
        </AnimatedPressable>
        <View style={styles.time}>
          <CalendarClock color={colors.primary} size={18} />
          <Text accessibilityLiveRegion="polite" style={styles.timeText}>{formatMeetupTime(at, now)}</Text>
        </View>
        <AnimatedPressable accessibilityLabel={tx('chat:meetup.later', '15 dk geç')} accessibilityRole="button" onPress={() => setAt((current) => nudgeMeetupTime(current, 1, new Date()))} pressScale={0.9} style={styles.step}>
          <Plus color={colors.text} size={18} />
        </AnimatedPressable>
      </View>

      <Text style={styles.hint}>{tx('chat:meetup.privacy', 'Yalnız yer ve saat gider; kimsenin konumu paylaşılmaz.')}</Text>
      <AnimatedPressable accessibilityRole="button" onPress={() => onPropose(at)} pressScale={0.97} style={styles.propose} testID="meetup-propose">
        <Text style={styles.proposeText}>{tx('chat:meetup.propose', 'Buluşma öner')}</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.md, paddingBottom: spacing.md },
  flex: { flex: 1 },
  bar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  back: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', marginLeft: -spacing.xs, width: sizes.touch },
  title: { ...typography.title, color: colors.text },
  place: { ...typography.caption, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipOn: { backgroundColor: colors.primary },
  chipText: { ...typography.label, color: colors.text },
  chipTextOn: { color: colors.ink },
  stepper: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  step: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 40, justifyContent: 'center', width: 40 },
  time: { alignItems: 'center', flexDirection: 'row', gap: 6, minWidth: 160, justifyContent: 'center' },
  timeText: { ...typography.heading, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  propose: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: sizes.buttonMd, justifyContent: 'center' },
  proposeText: { ...typography.bodyStrong, color: colors.ink },
});
