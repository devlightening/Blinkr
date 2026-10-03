import { formatAge } from './presentation';
import { signalValueLabel } from './productPresentation';
import { tx } from './i18n/tx';
import type { SignalType } from './types';

/** D-039 "Yere sor": structured questions only; each maps to the signal type that answers it. */
export type QuestionKind = 'crowd' | 'queue' | 'open';

export type PlaceQuestion = {
  id: string;
  placeId: string;
  placeName: string;
  placeCategory?: string | null;
  latitude: number;
  longitude: number;
  kind: QuestionKind;
  /** How many people wait for the answer (never who). */
  waiting: number;
  askedByMe: boolean;
  status: 'open' | 'answered';
  createdAtUtc: string;
  expiresAtUtc: string;
  answerValue?: string | null;
  answeredAtUtc?: string | null;
  answerPostId?: string | null;
};

export const QUESTION_KINDS: QuestionKind[] = ['crowd', 'queue', 'open'];
export const MAX_OPEN_QUESTIONS = 3;

export const signalTypeFor = (kind: QuestionKind): SignalType => (kind === 'crowd' ? 'Crowd' : kind === 'queue' ? 'Queue' : 'TemporaryStatus');

export const questionText = (kind: QuestionKind) => ({
  crowd: tx('map:ask.crowd', 'Şu an kalabalık mı?'),
  queue: tx('map:ask.queue', 'Sıra var mı?'),
  open: tx('map:ask.open', 'Şu an açık mı?'),
}[kind]);

export const waitingLabel = (waiting: number) =>
  waiting <= 1 ? tx('map:ask.oneWaiting', '1 kişi merak ediyor') : tx('map:ask.manyWaiting', '{{n}} kişi merak ediyor', { n: waiting });

/** "Yanıt: Sakin · 3 dk önce" - the answer in the app's own words for that signal type. */
export const answerLine = (q: PlaceQuestion) => {
  const value = signalValueLabel(signalTypeFor(q.kind), q.answerValue ?? null) || tx('map:ask.answered', 'Yanıtlandı');
  return tx('map:ask.answerLine', 'Yanıt: {{value}} · {{age}}', { value, age: formatAge(q.answeredAtUtc) });
};

/** Kinds I can still ask about at this place: ones not already open and asked by me. */
export const askableKinds = (questions: PlaceQuestion[]) =>
  QUESTION_KINDS.filter((kind) => !questions.some((q) => q.kind === kind && q.status === 'open' && q.askedByMe));

/** Open questions first (newest first), then answered ones I asked; answered questions of others are noise here. */
export const visibleQuestions = (questions: PlaceQuestion[]) => [
  ...questions.filter((q) => q.status === 'open'),
  ...questions.filter((q) => q.status === 'answered' && q.askedByMe),
];
