import { signalColors } from './theme';
import type { SignalType } from './types';

export type SignalCatalogEntry = {
  label: string;
  tone: string;
  /** The value choices offered for this type; absent when the type itself carries no separate value (e.g. Gözlem). */
  options?: Array<{ value: string; label: string }>;
};

/**
 * Single source for what the client knows about a signal type's label, colour and value options
 * (sinyal-mvp-plan P1.6). This replaces what used to be two separate objects living in two files
 * (`signalLabels` in presentation.ts, `signalOptions` in productPresentation.ts) - those now just
 * re-export what is here, so nothing that already imported them had to change.
 *
 * Deliberately pure data, no icon components: this file is compiled into the plain-Node pure-logic test
 * bundles (`test:nearby`, `test:product`), which run with plain `tsc` + `node` and no bundler - importing
 * anything from `lucide-react-native` here would drag in `react-native` itself, which plain Node cannot
 * parse (it ships Flow syntax `.js` files meant only for Metro/a bundler). The icon mapping stays local
 * to `SignalSymbol.tsx`, a component file that pure-logic tests never touch.
 *
 * TTL (`docs/sinyal-mvp-plan/docs/plan/10_SIGNAL_ENGINE.md` §1) is deliberately not included here either:
 * it is a backend rule that does not exist yet - BlogService's `ExpiresAt` is caller-supplied today,
 * there is no server-enforced per-type lifetime. Adding invented TTL minutes would claim a guarantee the
 * server does not make; it belongs here once Faz 2 (P2.7) builds the real signal engine.
 */
export const SIGNAL_CATALOG: Record<SignalType, SignalCatalogEntry> = {
  GeneralObservation: { label: 'Gözlem', tone: signalColors.GeneralObservation },
  Crowd: {
    label: 'Doluluk', tone: signalColors.Crowd,
    options: [{ value: 'Calm', label: 'Sakin' }, { value: 'Moderate', label: 'Hareketli' }, { value: 'Busy', label: 'Kalabalık' }],
  },
  Queue: {
    label: 'Bekleme', tone: signalColors.Queue,
    options: [{ value: 'None', label: 'Sıra yok' }, { value: '5To15', label: '5–15 dk' }, { value: 'Over15', label: '15 dk üzeri' }],
  },
  TemporaryStatus: {
    label: 'Geçici durum', tone: signalColors.TemporaryStatus,
    options: [{ value: 'Closed', label: 'Kapalı' }, { value: 'Open', label: 'Açık' }],
  },
  Event: {
    label: 'Etkinlik', tone: signalColors.Event,
    options: [{ value: 'Started', label: 'Başladı' }, { value: 'Ended', label: 'Bitti' }],
  },
  Offer: {
    label: 'Fırsat', tone: signalColors.Offer,
    options: [{ value: 'Available', label: 'Devam ediyor' }, { value: 'Ended', label: 'Sona erdi' }],
  },
  NewOpening: { label: 'Yeni açılış', tone: signalColors.NewOpening },
};
