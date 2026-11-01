/** Pure rules for the in-app video player (V2-2, FEATURES/08). */

/** Playback speeds, in the order a tap on the speed pill cycles through them. */
export const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.5] as const;

export const nextRate = (rate: number): number => {
  const i = PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]);
  return PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length];
};

export const rateLabel = (rate: number): string => `${Number.isInteger(rate) ? rate : rate.toString()}x`;

/** 0:07, 1:05, 1:02:09 - never negative, never NaN. */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Where a touch at `x` on a track of `width` seeks to, clamped inside the video. */
export function seekTarget(x: number, width: number, duration: number): number {
  if (!(width > 0) || !(duration > 0)) return 0;
  return Math.min(duration, Math.max(0, (x / width) * duration));
}

/** 0..1 progress for the bar; 0 while the duration is unknown. */
export const progressOf = (current: number, duration: number): number =>
  duration > 0 && Number.isFinite(current) ? Math.min(1, Math.max(0, current / duration)) : 0;
