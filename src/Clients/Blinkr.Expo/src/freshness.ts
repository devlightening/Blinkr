/**
 * The one freshness rule of the app (plan-devam A8). Every place that says how fresh something is - the
 * Keşfet/Yakında header and its filter chips, pin opacity, the place state, card badges and the stat row -
 * asks this module, so a header can never say "1 taze sinyal" while a chip says "Canlı 0".
 *
 *   live    younger than 15 min
 *   recent  younger than 45 min
 *   old     older, but not expired
 *   expired past its expiry time
 *   none    no observation time at all
 *
 * "Canlı" is only ever said about a live observation the server verified at the place (root CLAUDE.md §10.2:
 * trust is server-owned); an unverified live observation is "Taze".
 */
export const LIVE_MINUTES = 15;
export const RECENT_MINUTES = 45;

export type FreshnessTier = 'live' | 'recent' | 'old' | 'expired' | 'none';

const parse = (value?: string | null) => (value ? Date.parse(value) : Number.NaN);

export const freshnessTier = (observedAtUtc?: string | null, expiresAtUtc?: string | null, now = Date.now()): FreshnessTier => {
  const observed = parse(observedAtUtc);
  if (!Number.isFinite(observed)) return 'none';
  const expires = parse(expiresAtUtc);
  if (Number.isFinite(expires) && expires <= now) return 'expired';
  const minutes = Math.max(0, now - observed) / 60_000;
  if (minutes < LIVE_MINUTES) return 'live';
  if (minutes < RECENT_MINUTES) return 'recent';
  return 'old';
};

/** i18n key (common namespace) for a tier. */
export type FreshnessWord = 'live' | 'fresh' | 'recent' | 'old' | 'expired' | 'none';
export const freshnessWord = (tier: FreshnessTier, verified: boolean): FreshnessWord =>
  tier === 'live' ? (verified ? 'live' : 'fresh') : tier;
export const freshnessLabelKey = (tier: FreshnessTier, verified: boolean) => `common:freshness.${freshnessWord(tier, verified)}` as const;

/** Server-verified and younger than 15 minutes: the only thing called "Canlı". */
export const isLive = (observedAtUtc?: string | null, expiresAtUtc?: string | null, verified = false, now = Date.now()) =>
  verified && freshnessTier(observedAtUtc, expiresAtUtc, now) === 'live';

/** Server confidence label (HIGH/MEDIUM/LOW) → i18n key (common namespace): "Yüksek güven", "Orta güven", "Az doğrulama". */
export const confidenceKey = (label?: string | null) => {
  const value = label?.toUpperCase();
  return `common:confidence.${value === 'HIGH' ? 'high' : value === 'MEDIUM' ? 'medium' : 'low'}` as const;
};

/** Pins and list rows fade a little with age. */
export const freshnessOpacity = (observedAtUtc?: string | null, now = Date.now()) => {
  const tier = freshnessTier(observedAtUtc, null, now);
  return tier === 'live' || tier === 'none' ? 1 : tier === 'recent' ? 0.9 : 0.65;
};
