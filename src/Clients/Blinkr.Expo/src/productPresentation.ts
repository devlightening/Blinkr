import { freshnessTier } from './freshness';
import { SIGNAL_CATALOG } from './signalCatalog';
import type { ComposerArea, SignalType } from './types';
import i18n from 'i18next';
import { tx } from './i18n/tx';

export const trustLabel = (trust?: string | null) => trust === 'VERIFIED_LIVE'
  ? tx('signal:trust.verified', 'Konum doğrulandı') : trust === 'NEARBY_PLACE_POST' ? tx('signal:trust.nearby', 'Yakındaki yer paylaşımı') : tx('signal:trust.unverified', 'Konum doğrulanamadı');
export const canPublishAt = (area: ComposerArea | null) => Boolean(area && (!area.place || area.proximity?.allowed));
// Source of truth moved to signalCatalog.ts (sinyal-mvp-plan P1.6); re-exported here as before.
export const signalOptions: Partial<Record<SignalType, Array<{ value: string; label: string }>>> = Object.fromEntries(
  Object.entries(SIGNAL_CATALOG).filter(([, entry]) => entry.options).map(([type, entry]) => [type, entry.options]),
);
export const signalValueLabel = (type?: SignalType | null, value?: string | null) =>
  signalOptions[type ?? 'GeneralObservation']?.find(item => item.value.toUpperCase() === value?.toUpperCase())?.label
    ?? ({ EMPTY: tx('signal:catalog.Calm', 'Sakin'), LONG: tx('signal:catalog.QueueLong', 'Uzun sıra') } as Record<string, string>)[value?.toUpperCase() ?? ''] ?? value ?? '';
// One freshness rule for the whole app (plan-devam A8).
export { freshnessOpacity } from './freshness';
/**
 * How much of a signal's life is left, 1 (just posted) to 0 (expired) - what `FreshnessRing` draws
 * (03_DESIGN_SYSTEM.md §6). Unlike `freshnessOpacity` (a coarse dim-with-age step for lists), this is
 * the actual TTL window: without an `expiresAtUtc` there is nothing to draw a fraction of, so it
 * returns 1 rather than guessing a lifetime.
 */
export const freshnessProgress = (createdAtUtc: string | null | undefined, expiresAtUtc: string | null | undefined, now = Date.now()) => {
  const created = createdAtUtc ? Date.parse(createdAtUtc) : Number.NaN;
  const expires = expiresAtUtc ? Date.parse(expiresAtUtc) : Number.NaN;
  if (!Number.isFinite(created) || !Number.isFinite(expires) || expires <= created) return 1;
  return Math.min(1, Math.max(0, (expires - now) / (expires - created)));
};
/** The pulse (03_DESIGN_SYSTEM.md §6) is only for signals genuinely still young, not merely "not yet expired". */
export const isFreshnessPulseDue = (createdAtUtc: string | null | undefined, now = Date.now()) => freshnessTier(createdAtUtc, null, now) === 'live';
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
export const friendlyError = (error: unknown, fallback = tx('errors:http.server', 'Şu anda bağlantı kurulamıyor. Lütfen tekrar dene.')) => {
  const message = error instanceof Error ? error.message : '';
  // Server messages are written in Turkish; in English the (already translated) fallback is shown instead (plan-devam G1).
  const foreign = i18n.isInitialized && i18n.language === 'en' && /[çğıöşüÇĞİÖŞÜ]/.test(message);
  return !message || foreign || /HTTP|network|timeout|timed out|exception|fetch|backend|stack|grpc|sunucu/i.test(message) || message.length > 200 ? fallback : message;
};
