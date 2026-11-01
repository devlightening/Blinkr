import { FLAG_DEFAULTS, parseFlagOverrides, type Flag } from './flagRules';

/**
 * Feature flags (plan Faz 0.5): new map and feed work ships behind a flag, so a change that does not feel right on the
 * phone is one line to switch off (`flagRules.ts`) rather than a revert. For one Metro run
 * `EXPO_PUBLIC_BLINKR_FLAGS="-heatLayer"` switches a flag off (and `heatLayer` on) without a code change; Expo only
 * inlines it when written exactly as `process.env.EXPO_PUBLIC_...`.
 */
const overrides = parseFlagOverrides(process.env.EXPO_PUBLIC_BLINKR_FLAGS);

export type { Flag };
export const isEnabled = (flag: Flag) => overrides[flag] ?? FLAG_DEFAULTS[flag];
