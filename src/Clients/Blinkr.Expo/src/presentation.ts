import { SIGNAL_CATALOG, type SignalCatalogEntry } from './signalCatalog';
import type { SignalType } from './types';

/**
 * A title only earns its own line when it says something the type badge doesn't already say. The
 * composer falls back to the type's own label when the person leaves the title blank (`selectedType?.label`
 * in SignalComposer), which used to print the type name twice - once as a badge, once as a "title"
 * directly under it (sinyal-mvp-plan AUDIT #4: "Gözlem" title next to a "Gözlem" badge).
 */
export const meaningfulTitle = (title: string | null | undefined, typeLabel: string | null | undefined) => {
  const trimmed = title?.trim();
  if (!trimmed) return null;
  return trimmed.toLocaleLowerCase('tr-TR') === (typeLabel ?? '').trim().toLocaleLowerCase('tr-TR') ? null : trimmed;
};

// Source of truth moved to signalCatalog.ts (sinyal-mvp-plan P1.6); re-exported here as before so the
// many existing `import { signalLabels } from './presentation'` call sites never had to change.
export const signalLabels: Record<SignalType, string> = Object.fromEntries(
  (Object.entries(SIGNAL_CATALOG) as Array<[SignalType, SignalCatalogEntry]>).map(([type, entry]) => [type, entry.label]),
) as Record<SignalType, string>;

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
  if (meters >= 10_000) return `${Math.round(meters / 1000)} km`;
  return `~${(meters / 1000).toFixed(1)} km`;
};

export const formatAge = (createdAt?: string | null) => {
  if (!createdAt) return 'Az önce';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} dk önce`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} sa önce`;
  return `${Math.round(minutes / 1440)} gün önce`;
};
