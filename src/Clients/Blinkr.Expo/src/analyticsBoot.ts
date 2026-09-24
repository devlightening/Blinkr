import * as SecureStore from 'expo-secure-store';

import { setAnalyticsConsent } from './analytics';

/** "Kullanım verilerini paylaş" (plan-devam G11): off unless the person turned it on. Read synchronously at boot. */
export const ANALYTICS_CONSENT_KEY = 'blinkr.analytics.consent.v1';

export const readAnalyticsConsent = () => {
  try { return SecureStore.getItem(ANALYTICS_CONSENT_KEY) === 'true'; } catch { return false; }
};

export const saveAnalyticsConsent = (value: boolean) => {
  setAnalyticsConsent(value);
  SecureStore.setItemAsync(ANALYTICS_CONSENT_KEY, value ? 'true' : 'false').catch(() => {});
};

setAnalyticsConsent(readAnalyticsConsent());
