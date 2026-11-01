import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, Check, X } from 'lucide-react-native';

import { formatMeetupTime, meetupStatusLabel, meetupView } from '../../meetup';
import { colors, radii, spacing, typography } from '../../theme';
import type { BlinkrPlace, Meetup, MeetupAnswer, PlaceShare } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { PlaceShareCard } from './PlaceShareCard';
import { tx } from '../../i18n/tx';

type Props = {
  meetup: Meetup;
  share: PlaceShare;
  place?: BlinkrPlace | null;
  senderId: string;
  myId: string;
  otherName: string;
  /** Set while my answer is on its way; the buttons wait. */
  busy?: boolean;
  onAnswer: (answer: MeetupAnswer | null) => void;
};

/**
 * Doc B2, "Buluşalım": where and when, the place's live state underneath (B1), and the answer. The person it was
 * proposed to answers "Geliyorum" / "Olmaz" (pressing the chosen one again takes it back); the proposer sees the answer.
 * Only a place and a time travel - nobody's position. Two hours past the time it reads "Zamanı geçti" and closes.
 */
export function MeetupCard({ meetup, share, place, senderId, myId, otherName, busy = false, onAnswer }: Props) {
  const view = meetupView(meetup, senderId, myId);
  const status = meetupStatusLabel(view, otherName);
  const toggle = (answer: MeetupAnswer) => onAnswer(view.answer === answer ? null : answer);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <CalendarClock color={colors.primary} size={18} />
        <Text style={styles.title}>{tx('chat:meetup.title', 'Buluşalım')}</Text>
        <Text style={[styles.when, view.closed && styles.past]}>{formatMeetupTime(meetup.atUtc)}</Text>
      </View>
      <PlaceShareCard place={place} share={share} />
      <Text accessibilityLiveRegion="polite" style={[styles.status, view.answer === 'going' && styles.statusGoing]}>{status}</Text>
      {view.canAnswer ? (
        <View style={styles.answers}>
          <AnimatedPressable
            accessibilityLabel={tx('chat:meetup.going', 'Geliyorum')}
            accessibilityRole="button"
            accessibilityState={{ selected: view.answer === 'going', busy }}
            disabled={busy}
            onPress={() => toggle('going')}
            pressScale={0.95}
            style={[styles.answer, view.answer === 'going' && styles.answerGoing]}
            testID="meetup-going"
          >
            {busy ? <ActivityIndicator color={colors.text} size="small" /> : <Check color={view.answer === 'going' ? colors.ink : colors.text} size={16} />}
            <Text style={[styles.answerText, view.answer === 'going' && styles.answerTextOn]}>{tx('chat:meetup.going', 'Geliyorum')}</Text>
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityLabel={tx('chat:meetup.decline', 'Olmaz')}
            accessibilityRole="button"
            accessibilityState={{ selected: view.answer === 'declined', busy }}
            disabled={busy}
            onPress={() => toggle('declined')}
            pressScale={0.95}
            style={[styles.answer, view.answer === 'declined' && styles.answerDeclined]}
            testID="meetup-decline"
          >
            <X color={colors.text} size={16} />
            <Text style={styles.answerText}>{tx('chat:meetup.decline', 'Olmaz')}</Text>
          </AnimatedPressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, minWidth: 240 },
  head: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  title: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  when: { ...typography.label, color: colors.text },
  past: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  status: { ...typography.caption, color: colors.textSecondary },
  statusGoing: { color: colors.primary, fontWeight: '700' },
  answers: { flexDirection: 'row', gap: spacing.sm },
  answer: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, flex: 1, flexDirection: 'row', gap: 6, height: 38, justifyContent: 'center' },
  answerGoing: { backgroundColor: colors.primary },
  answerDeclined: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 },
  answerText: { ...typography.label, color: colors.text },
  answerTextOn: { color: colors.ink },
});
