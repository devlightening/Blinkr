import type { SignalType } from './types';

export const signalLabels: Record<SignalType, string> = {
  Crowd: 'Doluluk',
  Queue: 'Bekleme',
  Event: 'Etkinlik',
  Offer: 'Fırsat',
  NewOpening: 'Yeni açılış',
  TemporaryStatus: 'Geçici durum',
  GeneralObservation: 'Gözlem',
};

export const categoryLabels: Record<string, string> = {
  BAR: 'Bar',
  BAKERY: 'Fırın',
  CAFE: 'Kafe',
  EDUCATION: 'Okul',
  ENTERTAINMENT: 'Eğlence',
  FAST_FOOD: 'Fast Food',
  FUEL: 'Akaryakıt',
  HEALTH: 'Sağlık',
  OTHER: 'Diğer',
  PARK: 'Park',
  PHARMACY: 'Eczane',
  PLAYGROUND: 'Oyun alanı',
  PUBLIC: 'Kamusal yer',
  PLACE_OF_WORSHIP: 'İbadethane',
  MOSQUE: 'Cami',
  RESTAURANT: 'Restoran',
  SHOP: 'Mağaza',
  SPORT: 'Spor',
  SUPERMARKET: 'Market',
  TOURISM: 'Gezilecek yer',
  TRANSPORT: 'Ulaşım',
};

export const formatCategory = (category?: string | null) =>
  categoryLabels[(category ?? '').toUpperCase()] ?? 'Yer';

export const formatDistance = (meters?: number | null) => {
  if (meters == null || !Number.isFinite(meters)) return '';
  if (meters < 1000) return `~${Math.round(meters)} m`;
  return `~${(meters / 1000).toFixed(1)} km`;
};

export const formatAge = (createdAt?: string | null) => {
  if (!createdAt) return 'Az önce';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} dk önce`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} sa önce`;
  return `${Math.round(minutes / 1440)} gün önce`;
};
