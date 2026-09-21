import type { ComposerArea, SignalType } from './types';

export const trustLabel = (trust?: string | null) => trust === 'VERIFIED_LIVE'
  ? 'Konum doğrulandı' : trust === 'NEARBY_PLACE_POST' ? 'Yakındaki yer paylaşımı' : 'Konum doğrulanamadı';
export const canPublishAt = (area: ComposerArea | null) => Boolean(area && (!area.place || area.proximity?.allowed));
export const signalOptions: Partial<Record<SignalType, Array<{ value: string; label: string }>>> = {
  Crowd: [{ value: 'Calm', label: 'Sakin' }, { value: 'Moderate', label: 'Hareketli' }, { value: 'Busy', label: 'Kalabalık' }],
  Queue: [{ value: 'None', label: 'Sıra yok' }, { value: '5To15', label: '5–15 dk' }, { value: 'Over15', label: '15 dk üzeri' }],
  TemporaryStatus: [{ value: 'Closed', label: 'Kapalı' }, { value: 'Open', label: 'Açık' }],
  Event: [{ value: 'Started', label: 'Başladı' }, { value: 'Ended', label: 'Bitti' }],
  Offer: [{ value: 'Available', label: 'Devam ediyor' }, { value: 'Ended', label: 'Sona erdi' }],
};
export const signalValueLabel = (type?: SignalType | null, value?: string | null) =>
  signalOptions[type ?? 'GeneralObservation']?.find(item => item.value.toUpperCase() === value?.toUpperCase())?.label
    ?? ({ EMPTY: 'Sakin', LONG: 'Uzun sıra' } as Record<string, string>)[value?.toUpperCase() ?? ''] ?? value ?? '';
export const freshnessOpacity = (created?: string | null, now = Date.now()) => {
  const age = created ? now - Date.parse(created) : 0;
  return age < 15 * 60_000 ? 1 : age < 60 * 60_000 ? 0.9 : 0.65;
};
export const isFresh = (created?: string | null, expires?: string | null, now = Date.now()) =>
  Boolean(created && Number.isFinite(Date.parse(created)) && now - Date.parse(created) < 180 * 60_000
    && (!expires || Date.parse(expires) > now));
/**
 * "Hâlâ böyle mi?" is only offered while a Place has a fresh, structured live state (Doluluk, Bekleme, Durum,
 * Etkinlik, Fırsat with a known value). The answer is an ordinary signal published through the normal write path,
 * so the server still decides from the person's real position whether it counts as live (anayasa: trust is
 * server-owned). Returns the type and canonical value to pre-fill, or null when nothing should be offered.
 */
export const recheckSignal = (
  state: { signalType?: SignalType | null; signalValue?: string | null; freshness?: string | null; expiresAtUtc?: string | null } | null | undefined,
  now = Date.now(),
): { type: SignalType; value: string } | null => {
  if (!state?.signalType || !state.signalValue) return null;
  if (state.freshness !== 'FRESH' && state.freshness !== 'RECENT') return null;
  if (state.expiresAtUtc && Date.parse(state.expiresAtUtc) <= now) return null;
  const option = signalOptions[state.signalType]?.find((item) => item.value.toUpperCase() === state.signalValue!.toUpperCase());
  return option ? { type: state.signalType, value: option.value } : null;
};
export const friendlyError = (error: unknown, fallback = 'Şu anda bağlantı kurulamıyor. Lütfen tekrar dene.') => {
  const message = error instanceof Error ? error.message : '';
  return !message || /HTTP|network|timeout|timed out|exception|fetch|backend|stack|grpc|sunucu/i.test(message) || message.length > 200 ? fallback : message;
};
