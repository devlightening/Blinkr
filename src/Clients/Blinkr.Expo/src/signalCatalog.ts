import { signalColors } from './theme';
import type { SignalType } from './types';
import { tx } from './i18n/tx';

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
 * TTL: the server owns each type's lifetime (BlogService `CreatePostCommandHandler.GetDefaultExpiry`, P2.7);
 * `SIGNAL_TTL_MINUTES` below only mirrors it so the composer can say "Haritada 1 sa kalır" before publishing.
 * If the server changes, this display must change with it - the server value always wins.
 */
export const SIGNAL_CATALOG: Record<SignalType, SignalCatalogEntry> = {
  GeneralObservation: { label: tx('signal:catalog.GeneralObservation', 'Gözlem'), tone: signalColors.GeneralObservation },
  Crowd: {
    label: tx('signal:catalog.Crowd', 'Doluluk'), tone: signalColors.Crowd,
    options: [{ value: 'Calm', label: tx('signal:catalog.Calm', 'Sakin') }, { value: 'Moderate', label: tx('signal:catalog.Moderate', 'Hareketli') }, { value: 'Busy', label: tx('signal:catalog.Busy', 'Kalabalık') }],
  },
  Queue: {
    label: tx('signal:catalog.Queue', 'Bekleme'), tone: signalColors.Queue,
    options: [{ value: 'None', label: tx('signal:catalog.QueueNone', 'Sıra yok') }, { value: '5To15', label: tx('signal:catalog.Queue5To15', '5–15 dk') }, { value: 'Over15', label: tx('signal:catalog.QueueOver15', '15 dk üzeri') }],
  },
  TemporaryStatus: {
    label: tx('signal:catalog.TemporaryStatus', 'Geçici durum'), tone: signalColors.TemporaryStatus,
    options: [{ value: 'Closed', label: tx('signal:catalog.Closed', 'Kapalı') }, { value: 'Open', label: tx('signal:catalog.Open', 'Açık') }],
  },
  Event: {
    label: tx('signal:catalog.Event', 'Etkinlik'), tone: signalColors.Event,
    options: [{ value: 'Started', label: tx('signal:catalog.Started', 'Başladı') }, { value: 'Ended', label: tx('signal:catalog.Ended', 'Bitti') }],
  },
  Offer: {
    label: tx('signal:catalog.Offer', 'Fırsat'), tone: signalColors.Offer,
    options: [{ value: 'Available', label: tx('signal:catalog.Available', 'Devam ediyor') }, { value: 'Ended', label: tx('signal:catalog.OfferEnded', 'Sona erdi') }],
  },
  NewOpening: { label: tx('signal:catalog.NewOpening', 'Yeni açılış'), tone: signalColors.NewOpening },
};

/** Mirror of the server's default lifetime per type (display only - see the note above). */
export const SIGNAL_TTL_MINUTES: Record<SignalType, number> = {
  Crowd: 60,
  Queue: 60,
  TemporaryStatus: 180,
  Event: 1440,
  Offer: 1440,
  NewOpening: 10080,
  GeneralObservation: 1440,
};

/** "1 sa" / "1 h", "7 gün" / "7 days". */
export const formatLifetime = (minutes: number, language: 'tr' | 'en' = 'tr') => {
  if (minutes < 60) return `${minutes} ${language === 'en' ? 'min' : 'dk'}`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} ${language === 'en' ? 'h' : 'sa'}`;
  const days = Math.round(minutes / 1440);
  return language === 'en' ? `${days} ${days === 1 ? 'day' : 'days'}` : `${days} gün`; // i18n-fallback: language-aware already
};
