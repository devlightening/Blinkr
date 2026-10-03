import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CircleCheck, HelpCircle, X } from 'lucide-react-native';

import { askPlace, getPlaceQuestions, withdrawQuestion } from '../../api';
import { success } from '../../haptics';
import { formatAge } from '../../presentation';
import { answerLine, askableKinds, questionText, signalTypeFor, visibleQuestions, waitingLabel, type PlaceQuestion, type QuestionKind } from '../../placeQuestions';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse, BlinkrPlace, SignalType } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { tx } from '../../i18n/tx';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

/**
 * "Yere sor" (D-039) on a place page. Open questions show what people wonder and how many wait - never who - with
 * "Yanıtla", which opens the normal composer for that signal type; the answer counts only when the server verifies the
 * person is on site. Signed in, I can ask too (three fixed questions, no free text) and see the answer here when it
 * comes; the notification also tells me.
 */
export function PlaceQuestionsCard({ auth, place, refresh = {}, onAnswer }: {
  auth: AuthResponse | null;
  place: BlinkrPlace;
  refresh?: Refresh;
  /** Opens the composer for this place with the signal type that answers the question. */
  onAnswer?: (type: SignalType) => void;
}) {
  const [questions, setQuestions] = useState<PlaceQuestion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    getPlaceQuestions(place.id, auth, signal, refresh)
      .then((list) => { if (!signal?.aborted) setQuestions(list); })
      .catch(() => { if (!signal?.aborted) setQuestions((current) => current ?? []); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, auth?.userId]);

  useEffect(() => {
    const controller = new AbortController();
    setQuestions(null);
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const ask = async (kind: QuestionKind) => {
    if (!auth || busy) return;
    setBusy(kind);
    setError(null);
    try {
      const asked = await askPlace(auth, place.id, kind, refresh);
      setQuestions((current) => [asked, ...(current ?? []).filter((q) => q.id !== asked.id)]);
      success();
    } catch (err) {
      setError((err as { status?: number })?.status === 409
        ? tx('map:ask.limit', 'Aynı anda en fazla 3 soru sorabilirsin.')
        : tx('map:ask.failed', 'Soru gönderilemedi. Tekrar dene.'));
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (q: PlaceQuestion) => {
    if (!auth || busy) return;
    setBusy(q.id);
    try {
      await withdrawQuestion(auth, place.id, q.kind, refresh);
      load();
    } catch {
      setError(tx('map:ask.failed', 'Soru gönderilemedi. Tekrar dene.'));
    } finally {
      setBusy(null);
    }
  };

  if (questions === null) return null;
  const shown = visibleQuestions(questions);
  const canAsk = auth ? askableKinds(questions) : [];
  if (shown.length === 0 && canAsk.length === 0) return null;

  return (
    <View style={styles.card} testID="place-questions">
      <View style={styles.head}>
        <HelpCircle color={colors.primary} size={16} />
        <Text accessibilityRole="header" style={styles.title}>{tx('map:ask.title', 'Yere sor')}</Text>
      </View>

      {shown.map((q) => (
        <View key={q.id} style={styles.question}>
          <View style={styles.copy}>
            <Text style={styles.qText}>{questionText(q.kind)}</Text>
            {q.status === 'answered'
              ? <View style={styles.answer}><CircleCheck color={colors.primary} size={13} /><Text style={styles.answerText}>{answerLine(q)}</Text></View>
              : <Text style={styles.meta}>{waitingLabel(q.waiting)} · {formatAge(q.createdAtUtc)}{q.askedByMe ? ` · ${tx('map:ask.mine', 'sen de soruyorsun')}` : ''}</Text>}
          </View>
          {q.status === 'open' && onAnswer ? (
            <AnimatedPressable accessibilityHint={tx('map:ask.answerHint', 'Yanıtın sayılması için yerde olman gerekir')} accessibilityRole="button" onPress={() => onAnswer(signalTypeFor(q.kind))} pressScale={0.95} style={styles.answerButton}>
              <Text style={styles.answerButtonText}>{tx('map:ask.answer', 'Yanıtla')}</Text>
            </AnimatedPressable>
          ) : null}
          {q.status === 'open' && q.askedByMe ? (
            <AnimatedPressable accessibilityLabel={tx('map:ask.withdraw', 'Sorumu geri al')} accessibilityRole="button" disabled={busy !== null} hitSlop={8} onPress={() => { void withdraw(q); }} pressScale={0.9} style={styles.withdraw}>
              {busy === q.id ? <ActivityIndicator color={colors.textSecondary} size="small" /> : <X color={colors.textSecondary} size={16} />}
            </AnimatedPressable>
          ) : null}
        </View>
      ))}

      {canAsk.length > 0 ? (
        <View style={styles.chips}>
          {canAsk.map((kind) => (
            <AnimatedPressable accessibilityRole="button" disabled={busy !== null} key={kind} onPress={() => { void ask(kind); }} pressScale={0.95} style={styles.chip}>
              {busy === kind ? <ActivityIndicator color={colors.text} size="small" /> : <Text style={styles.chipText}>{questionText(kind)}</Text>}
            </AnimatedPressable>
          ))}
        </View>
      ) : null}
      {canAsk.length > 0 ? <Text style={styles.note}>{tx('map:ask.note', 'Soran kişi gösterilmez. Yalnız konumda doğrulanan yanıtlar sayılır.')}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.sm, padding: spacing.md },
  head: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  title: { ...typography.heading, color: colors.text },
  question: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  copy: { flex: 1, gap: 2 },
  qText: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  answer: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  answerText: { ...typography.label, color: colors.primary },
  answerButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  answerButtonText: { ...typography.label, color: colors.ink },
  withdraw: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
  chipText: { ...typography.label, color: colors.text },
  note: { ...typography.micro, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.danger },
});
