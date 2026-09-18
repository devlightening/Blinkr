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
export const friendlyError = (error: unknown, fallback = 'Şu anda bağlantı kurulamıyor. Lütfen tekrar dene.') => {
  const message = error instanceof Error ? error.message : '';
  return !message || /HTTP|network|timeout|timed out|exception|fetch|backend|stack|grpc|sunucu/i.test(message) || message.length > 200 ? fallback : message;
};
