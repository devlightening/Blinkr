import { displayLocale } from './i18n/locale';
import { tx } from './i18n/tx';
import type { Meetup, MeetupAnswer } from './types';

/** Same window the server enforces (MeetupPayload): now (5 min tolerance) to 14 days ahead. */
export const MEETUP_MAX_AHEAD_MS = 14 * 24 * 60 * 60_000;
const PAST_TOLERANCE_MS = 5 * 60_000;
const STEP_MS = 15 * 60_000;

export const isMeetupTimeValid = (at: Date, now: Date) =>
  at.getTime() >= now.getTime() - PAST_TOLERANCE_MS && at.getTime() <= now.getTime() + MEETUP_MAX_AHEAD_MS;

/** The next quarter hour at least `minutes` from now ("30 dk sonra" at 14:07 is 14:45). */
const roundedFromNow = (now: Date, minutes: number) => {
  const t = now.getTime() + minutes * 60_000;
  return new Date(Math.ceil(t / STEP_MS) * STEP_MS);
};

const atLocal = (now: Date, dayOffset: number, hour: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
};

export type MeetupTimeOption = { key: string; label: string; at: Date };

/**
 * Doc B2: quick times instead of a date wheel - soon, in an hour, this evening (only while it is still ahead), tomorrow
 * noon and tomorrow evening. Every option is inside the server's window.
 */
export const meetupTimeOptions = (now: Date): MeetupTimeOption[] => {
  const options: MeetupTimeOption[] = [
    { key: 'soon', label: tx('chat:meetup.in30', '30 dk sonra'), at: roundedFromNow(now, 30) },
    { key: 'hour', label: tx('chat:meetup.in60', '1 saat sonra'), at: roundedFromNow(now, 60) },
  ];
  const evening = atLocal(now, 0, 19);
  if (evening.getTime() - now.getTime() >= 90 * 60_000) options.push({ key: 'evening', label: tx('chat:meetup.tonight', 'Bu akşam 19:00'), at: evening });
  options.push({ key: 'tomorrowNoon', label: tx('chat:meetup.tomorrowNoon', 'Yarın 12:00'), at: atLocal(now, 1, 12) });
  options.push({ key: 'tomorrowEvening', label: tx('chat:meetup.tomorrowEvening', 'Yarın 19:00'), at: atLocal(now, 1, 19) });
  return options.filter((option) => isMeetupTimeValid(option.at, now));
};

/** Moves a chosen time by a quarter hour, staying inside the window. */
export const nudgeMeetupTime = (at: Date, steps: number, now: Date): Date => {
  const next = new Date(at.getTime() + steps * STEP_MS);
  return isMeetupTimeValid(next, now) ? next : at;
};

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Bugün 19:00", "Yarın 12:00", "12 Eki 19:00" in the app language. */
export const formatMeetupTime = (atUtc: string | Date, now: Date = new Date()) => {
  const at = typeof atUtc === 'string' ? new Date(atUtc) : atUtc;
  if (Number.isNaN(at.getTime())) return '';
  const locale = displayLocale();
  const clock = at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(at, now)) return tx('chat:meetup.todayAt', 'Bugün {{time}}', { time: clock });
  if (sameDay(at, tomorrow)) return tx('chat:meetup.tomorrowAt', 'Yarın {{time}}', { time: clock });
  return `${at.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${clock}`;
};

export type MeetupView = {
  /** I proposed it (I wait for an answer) or it was proposed to me (I answer). */
  mine: boolean;
  /** The other person's answer when I proposed it; my own answer when they did. */
  answer: MeetupAnswer | null;
  /** Answers are closed (two hours past the time); the card reads "geçti". */
  closed: boolean;
  /** I can answer now (proposed to me and not closed). */
  canAnswer: boolean;
};

export const meetupView = (meetup: Meetup, senderId: string, myId: string): MeetupView => {
  const mine = senderId === myId;
  const answer = mine
    ? meetup.responses.find((response) => response.userId !== myId)?.answer ?? null
    : meetup.responses.find((response) => response.userId === myId)?.answer ?? null;
  return { mine, answer, closed: meetup.closed, canAnswer: !mine && !meetup.closed };
};

/** The status line under the card. */
export const meetupStatusLabel = (view: MeetupView, otherName: string) => {
  if (view.closed) return tx('chat:meetup.closed', 'Zamanı geçti');
  if (view.mine) {
    if (view.answer === 'going') return tx('chat:meetup.theyGoing', '{{name}} geliyor', { name: otherName });
    if (view.answer === 'declined') return tx('chat:meetup.theyDeclined', '{{name}} gelemiyor', { name: otherName });
    return tx('chat:meetup.waiting', 'Yanıt bekleniyor');
  }
  if (view.answer === 'going') return tx('chat:meetup.youGoing', 'Geliyorsun');
  if (view.answer === 'declined') return tx('chat:meetup.youDeclined', 'Gelemiyorsun');
  return tx('chat:meetup.askYou', 'Geliyor musun?');
};

/** Applies my answer locally (optimistic); the same answer again takes it back, like the server's null. */
export const withMyAnswer = (meetup: Meetup, myId: string, answer: MeetupAnswer | null, nowIso: string): Meetup => ({
  ...meetup,
  responses: [
    ...meetup.responses.filter((response) => response.userId !== myId),
    ...(answer ? [{ userId: myId, answer, atUtc: nowIso }] : []),
  ],
});
