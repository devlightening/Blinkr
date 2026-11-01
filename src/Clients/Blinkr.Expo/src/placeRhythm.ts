import { tx } from './i18n/tx';
import { levelFromSignal } from './live/liveState';

/** GET /api/places/{id}/rhythm (D-037). Levels are 0 (sakin) .. 1 (kalabalık); null = too few different people. */
export type PlaceRhythm = {
  enough: boolean;
  observations: number;
  /** Turkey time, 0 = Sunday. */
  today: number;
  currentHour: number;
  days: Array<{ weekday: number; hours: Array<{ hour: number; level: number | null }> }>;
};

/** Monday first, as people in Turkey read a week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const weekdayShort = (weekday: number) => [
  tx('map:rhythm.sun', 'Paz'), tx('map:rhythm.mon', 'Pzt'), tx('map:rhythm.tue', 'Sal'), tx('map:rhythm.wed', 'Çar'),
  tx('map:rhythm.thu', 'Per'), tx('map:rhythm.fri', 'Cum'), tx('map:rhythm.sat', 'Cmt'),
][weekday] ?? '';

/** The same three words people answer with (Crowd: Sakin / Hareketli / Kalabalık). */
export const levelLabel = (level: number) =>
  level < 0.34 ? tx('map:rhythm.calm', 'Sakin') : level < 0.67 ? tx('map:rhythm.moderate', 'Hareketli') : tx('map:rhythm.busy', 'Kalabalık');

export const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export const dayOf = (rhythm: PlaceRhythm, weekday: number) => rhythm.days.find((day) => day.weekday === weekday) ?? null;

/** The quietest known hour of a day, from `fromHour` on (today: only what is still ahead). Ties go to the earlier hour. */
export const quietestHour = (hours: PlaceRhythm['days'][number]['hours'], fromHour = 0) =>
  hours
    .filter((h) => h.level !== null && h.hour >= fromHour)
    .reduce<{ hour: number; level: number } | null>((best, h) => (best === null || (h.level as number) < best.level ? { hour: h.hour, level: h.level as number } : best), null);

/**
 * The one sentence a person needs: what it is usually like now, and when it is quieter. Only from shown hours; never
 * a guess for an hour with too few people.
 */
export const rhythmSummary = (rhythm: PlaceRhythm, weekday: number): string | null => {
  const day = dayOf(rhythm, weekday);
  if (!day) return null;
  const isToday = weekday === rhythm.today;
  const now = isToday ? day.hours.find((h) => h.hour === rhythm.currentHour && h.level !== null) : undefined;
  const quiet = quietestHour(day.hours, isToday ? rhythm.currentHour + 1 : 0);
  const parts: string[] = [];
  if (now && now.level !== null) parts.push(tx('map:rhythm.usuallyNow', 'Genelde bu saatte {{level}}', { level: levelLabel(now.level).toLocaleLowerCase('tr') }));
  if (quiet && (!now || now.level === null || quiet.level < now.level)) parts.push(tx('map:rhythm.quietest', 'En sakin: {{hour}}', { hour: hourLabel(quiet.hour) }));
  return parts.length ? parts.join(' · ') : null;
};

export type UsualComparison = { usual: number; now: number; direction: 'busier' | 'quieter' | 'usual' };

/**
 * "Normalde vs şu an" (plan Faz 2.2, after Google's live bar over popular times): the verified live state against what
 * this hour is usually like. Only when both are real: today's current hour has a rhythm level, and the server's state
 * is a Crowd/Queue level that is still FRESH or RECENT (it already holds only verified signals). The live level uses the
 * rhythm's own scale (0 / 0.5 / 1), and a difference smaller than one step is "as usual".
 */
export const compareWithUsual = (
  rhythm: PlaceRhythm | null,
  current: { signalType?: string | null; signalValue?: string | null; freshness?: string | null } | null | undefined,
): UsualComparison | null => {
  if (!rhythm?.enough || !current || (current.freshness !== 'FRESH' && current.freshness !== 'RECENT')) return null;
  const level = levelFromSignal({ type: current.signalType ?? '', value: current.signalValue ?? '' });
  const usual = dayOf(rhythm, rhythm.today)?.hours.find((h) => h.hour === rhythm.currentHour)?.level;
  if (level === null || usual === null || usual === undefined) return null;
  const now = level / 2;
  const direction = now - usual >= 0.34 ? 'busier' : usual - now >= 0.34 ? 'quieter' : 'usual';
  return { usual, now, direction };
};

export const usualComparisonText = (comparison: UsualComparison) =>
  comparison.direction === 'busier' ? tx('map:rhythm.busierThanUsual', 'Şu an normalden kalabalık')
    : comparison.direction === 'quieter' ? tx('map:rhythm.quieterThanUsual', 'Şu an normalden sakin')
      : tx('map:rhythm.asUsual', 'Şu an her zamanki gibi');

/** Screen readers get the chart as text: every shown hour with its word. */
export const rhythmA11y = (rhythm: PlaceRhythm, weekday: number) => {
  const day = dayOf(rhythm, weekday);
  const shown = (day?.hours ?? []).filter((h) => h.level !== null);
  if (!shown.length) return tx('map:rhythm.noDayData', 'Bu gün için yeterli veri yok');
  return shown.map((h) => `${hourLabel(h.hour)} ${levelLabel(h.level as number)}`).join(', ');
};
