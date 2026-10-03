import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Activity, Info } from 'lucide-react-native';

import { getPlaceRhythm } from '../../api';
import { WEEK_ORDER, dayOf, hourLabel, levelLabel, rhythmA11y, rhythmSummary, weekdayShort, type PlaceRhythm } from '../../placeRhythm';
import { colors, radii, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { tx } from '../../i18n/tx';

const CHART_HEIGHT = 72;
/** Shortest bar for a known hour, so "sakin" is still visibly a bar and not mistaken for missing data. */
const MIN_BAR = 6;
const TICKS = [6, 9, 12, 15, 18, 21];

/**
 * "Yerin Ritmi" (D-037): how busy the place usually is, hour by hour, for a weekday. Built only from verified Blinkr
 * observations; hours with too few different people stay empty (dashed stub), never shown as quiet. One series, so one
 * hue: the bar height is the busyness, the current hour is the solid one. Tapping a bar names its hour and level.
 * Hidden on failure; says plainly when the place has no rhythm yet.
 */
export function PlaceRhythmCard({ placeId }: { placeId: string }) {
  const [rhythm, setRhythm] = useState<PlaceRhythm | null>(null);
  const [failed, setFailed] = useState(false);
  const [weekday, setWeekday] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setRhythm(null);
    setFailed(false);
    getPlaceRhythm(placeId, controller.signal)
      .then((value) => { if (!controller.signal.aborted) { setRhythm(value); setWeekday(value.today); } })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [placeId]);

  const day = useMemo(() => (rhythm && weekday !== null ? dayOf(rhythm, weekday) : null), [rhythm, weekday]);
  if (failed || !rhythm) return null;

  const header = (
    <View style={styles.head}>
      <Activity color={colors.primary} size={16} />
      <Text accessibilityRole="header" style={styles.title}>{tx('map:rhythm.title', 'Yerin ritmi')}</Text>
    </View>
  );

  if (!rhythm.enough || weekday === null) {
    return (
      <View style={styles.card} testID="place-rhythm-empty">
        {header}
        <Text style={styles.muted}>{tx('map:rhythm.notYet', 'Henüz yeterli doğrulanmış gözlem yok. Burada sinyal bıraktıkça yerin ritmi oluşur.')}</Text>
      </View>
    );
  }

  const isToday = weekday === rhythm.today;
  const summary = rhythmSummary(rhythm, weekday);
  const pickedHour = picked !== null ? day?.hours.find((h) => h.hour === picked) : undefined;

  return (
    <View style={styles.card} testID="place-rhythm">
      {header}
      <View style={styles.days}>
        {WEEK_ORDER.map((wd) => {
          const selected = wd === weekday;
          return (
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={wd}
              onPress={() => { setWeekday(wd); setPicked(null); }}
              pressScale={0.92}
              style={[styles.day, selected && styles.daySelected]}
            >
              <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{weekdayShort(wd)}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <Text accessibilityLiveRegion="polite" style={styles.summary}>
        {pickedHour
          ? (pickedHour.level === null
            ? tx('map:rhythm.hourNoData', '{{hour}} · yeterli veri yok', { hour: hourLabel(pickedHour.hour) })
            : tx('map:rhythm.hourLevel', '{{hour}} · genelde {{level}}', { hour: hourLabel(pickedHour.hour), level: levelLabel(pickedHour.level).toLocaleLowerCase('tr') }))
          : summary ?? tx('map:rhythm.dayNoSummary', 'Bu gün için az veri var')}
      </Text>

      <View accessibilityLabel={rhythmA11y(rhythm, weekday)} accessible style={styles.chart}>
        {(day?.hours ?? []).map((h) => {
          const now = isToday && h.hour === rhythm.currentHour;
          const known = h.level !== null;
          const height = known ? Math.max(MIN_BAR, Math.round((h.level as number) * CHART_HEIGHT)) : 0;
          return (
            <AnimatedPressable key={h.hour} hitSlop={{ top: 8, bottom: 8 }} onPress={() => setPicked(h.hour === picked ? null : h.hour)} pressScale={1} style={styles.slot}>
              {known
                ? <View style={[styles.bar, { height }, now ? styles.barNow : styles.barUsual, picked === h.hour && styles.barPicked]} />
                : <View style={styles.stub} />}
            </AnimatedPressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {TICKS.map((tick) => <Text key={tick} style={styles.tick}>{String(tick).padStart(2, '0')}</Text>)}
      </View>

      <View style={styles.note}>
        <Info color={colors.textSecondary} size={12} />
        <Text style={styles.noteText}>{tx('map:rhythm.basis', 'Son 8 haftadaki {{count}} doğrulanmış gözleme dayanır; en az 3 kişinin olduğu saatler gösterilir.', { count: rhythm.observations })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.sm, padding: spacing.md },
  head: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  title: { ...typography.heading, color: colors.text },
  muted: { ...typography.callout, color: colors.textSecondary },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', borderRadius: radii.pill, minWidth: 38, paddingVertical: 6 },
  daySelected: { backgroundColor: colors.primaryTint },
  dayText: { ...typography.label, color: colors.textSecondary },
  dayTextSelected: { color: colors.primary },
  summary: { ...typography.bodyStrong, color: colors.text },
  // Bars sit on the baseline with a 2 px gap between them (spacer), rounded only at the data end.
  chart: { alignItems: 'flex-end', flexDirection: 'row', gap: 2, height: CHART_HEIGHT },
  slot: { flex: 1, height: CHART_HEIGHT, justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4, width: '100%' },
  barUsual: { backgroundColor: colors.primaryTint },
  barNow: { backgroundColor: colors.primary },
  barPicked: { borderColor: colors.primary, borderWidth: 1 },
  stub: { borderColor: colors.border, borderStyle: 'dashed', borderTopWidth: 1, width: '100%' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: '8%' },
  tick: { ...typography.micro, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  note: { alignItems: 'flex-start', flexDirection: 'row', gap: 4 },
  noteText: { ...typography.micro, color: colors.textSecondary, flex: 1 },
});
