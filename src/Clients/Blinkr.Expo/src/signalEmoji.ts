/**
 * Blinkr's map "emotes": one emoji per signal that says what is going on at a glance (a calm cafe, a packed square,
 * a long queue, a closed door). It sits inside the signal bubble and on a live place pin's badge; the colours, outline
 * and freshness ring stay the theme's. Pure, so it is tested (scripts/signal-emoji.test.ts).
 *
 * The emoji is decoration of data the server already verified; it never adds information of its own.
 */
const BY_VALUE: Record<string, Record<string, string>> = {
  Crowd: { Calm: '😌', Moderate: '🙂', Busy: '🔥' },
  Queue: { None: '🚶', '5To15': '⏳', Over15: '🐢' },
  TemporaryStatus: { Open: '✅', Closed: '🚧' },
};

const BY_TYPE: Record<string, string> = {
  Crowd: '👥',
  Queue: '⏳',
  TemporaryStatus: '⚠️',
  Offer: '🏷️',
  Event: '🎉',
  NewOpening: '✨',
  GeneralObservation: '👀',
};

export const DEFAULT_SIGNAL_EMOJI = '📍';

export const signalEmoji = (type: string | null | undefined, value?: string | null): string => {
  if (!type) return DEFAULT_SIGNAL_EMOJI;
  return (value ? BY_VALUE[type]?.[value] : undefined) ?? BY_TYPE[type] ?? DEFAULT_SIGNAL_EMOJI;
};
