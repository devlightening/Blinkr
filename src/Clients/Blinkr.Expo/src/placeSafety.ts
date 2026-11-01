/**
 * Sensitive places (sinyal-mvp-plan 11_SAFETY §3). Pure logic, no React Native imports.
 * - education (school, kindergarten): no photo or video at all - the server refuses it too (422 MEDIA_NOT_ALLOWED_AT_PLACE).
 * - health / worship: a privacy reminder before sharing; health places also show where to get urgent help.
 * - `accuracyUncertain`: the device fix is too loose to say "you are here" (plan 05 §1.1: > 100 m).
 */
export type PlaceSensitivity = 'education' | 'health' | 'worship';

const BY_CATEGORY: Record<string, PlaceSensitivity> = {
  EDUCATION: 'education',
  HEALTH: 'health',
  PHARMACY: 'health',
  PLACE_OF_WORSHIP: 'worship',
  MOSQUE: 'worship',
};

export const placeSensitivity = (category?: string | null): PlaceSensitivity | null =>
  BY_CATEGORY[(category ?? '').toUpperCase()] ?? null;

/** Photos and videos are allowed everywhere except education places. */
export const mediaAllowedAt = (category?: string | null) => placeSensitivity(category) !== 'education';

export const UNCERTAIN_ACCURACY_METERS = 100;
export const accuracyUncertain = (accuracyMeters?: number | null) =>
  accuracyMeters != null && Number.isFinite(accuracyMeters) && accuracyMeters > UNCERTAIN_ACCURACY_METERS;

/** Emergency number by ISO country code (plan: TR 112, EU 112, US 911, UK 999). Unknown → 112 (EU/TR standard). */
export const emergencyNumber = (countryCode?: string | null) => {
  switch ((countryCode ?? '').toUpperCase()) {
    case 'US': case 'CA': return '911';
    case 'GB': return '999';
    default: return '112';
  }
};
