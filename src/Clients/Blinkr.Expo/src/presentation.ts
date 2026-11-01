import { SIGNAL_CATALOG, type SignalCatalogEntry } from './signalCatalog';
import type { SignalType } from './types';
import { tx } from './i18n/tx';

/**
 * A title only earns its own line when it says something the type badge doesn't already say. The
 * composer falls back to the type's own label when the person leaves the title blank (`selectedType?.label`
 * in SignalComposer), which used to print the type name twice - once as a badge, once as a "title"
 * directly under it (sinyal-mvp-plan AUDIT #4: "Gözlem" title next to a "Gözlem" badge).
 */
/**
 * Titles the server writes itself when the person left the title empty (CreatePostCommandHandler): 'Crowd: Calm' for a
 * quick signal, 'Taze içerik' otherwise. They repeat the type and value in raw English, so they are never shown.
 */
const SERVER_PLACEHOLDER_TITLE = /^(GeneralObservation|Crowd|Queue|TemporaryStatus|Offer|Event|NewOpening): [A-Za-z0-9]*$|^Taze içerik$/;

export const meaningfulTitle = (title: string | null | undefined, typeLabel: string | null | undefined) => {
  const trimmed = title?.trim();
  if (!trimmed || SERVER_PLACEHOLDER_TITLE.test(trimmed)) return null;
  return trimmed.toLocaleLowerCase('tr-TR') === (typeLabel ?? '').trim().toLocaleLowerCase('tr-TR') ? null : trimmed;
};

// Source of truth moved to signalCatalog.ts (sinyal-mvp-plan P1.6); re-exported here as before so the
// many existing `import { signalLabels } from './presentation'` call sites never had to change.
export const signalLabels: Record<SignalType, string> = Object.fromEntries(
  (Object.entries(SIGNAL_CATALOG) as Array<[SignalType, SignalCatalogEntry]>).map(([type, entry]) => [type, entry.label]),
) as Record<SignalType, string>;

export const categoryLabels: Record<string, string> = {
  BAR: tx('common:category.BAR', 'Bar'),
  BAKERY: tx('common:category.BAKERY', 'Fırın'),
  CAFE: tx('common:category.CAFE', 'Kafe'),
  EDUCATION: tx('common:category.EDUCATION', 'Okul'),
  ENTERTAINMENT: tx('common:category.ENTERTAINMENT', 'Eğlence'),
  FAST_FOOD: tx('common:category.FAST_FOOD', 'Fast Food'),
  FUEL: tx('common:category.FUEL', 'Akaryakıt'),
  HEALTH: tx('common:category.HEALTH', 'Sağlık'),
  OTHER: tx('common:category.OTHER', 'Diğer'),
  PARK: tx('common:category.PARK', 'Park'),
  PHARMACY: tx('common:category.PHARMACY', 'Eczane'),
  PLAYGROUND: tx('common:category.PLAYGROUND', 'Oyun alanı'),
  PUBLIC: tx('common:category.PUBLIC', 'Kamusal yer'),
  PLACE_OF_WORSHIP: tx('common:category.PLACE_OF_WORSHIP', 'İbadethane'),
  MOSQUE: tx('common:category.MOSQUE', 'Cami'),
  RESTAURANT: tx('common:category.RESTAURANT', 'Restoran'),
  SHOP: tx('common:category.SHOP', 'Mağaza'),
  SPORT: tx('common:category.SPORT', 'Spor'),
  SUPERMARKET: tx('common:category.SUPERMARKET', 'Market'),
  TOURISM: tx('common:category.TOURISM', 'Gezilecek yer'),
  TRANSPORT: tx('common:category.TRANSPORT', 'Ulaşım'),
};

export const formatCategory = (category?: string | null) =>
  categoryLabels[(category ?? '').toUpperCase()] ?? tx('common:category.place', 'Yer');

export const formatDistance = (meters?: number | null) => {
  if (meters == null || !Number.isFinite(meters)) return '';
  if (meters < 1000) return `~${Math.round(meters)} m`;
  if (meters >= 10_000) return `${Math.round(meters / 1000)} km`;
  return `~${(meters / 1000).toFixed(1)} km`;
};

export const formatAge = (createdAt?: string | null) => {
  if (!createdAt) return tx('common:age.now', 'Az önce');
  const minutes = Math.max(1, Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 60) return tx('common:age.minutes', '{{n}} dk önce', { n: minutes });
  if (minutes < 1440) return tx('common:age.hours', '{{n}} sa önce', { n: Math.round(minutes / 60) });
  return tx('common:age.days', '{{n}} gün önce', { n: Math.round(minutes / 1440) });
};
