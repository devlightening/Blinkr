import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enChat from './locales/en/chat.json';
import enCommon from './locales/en/common.json';
import enCreate from './locales/en/create.json';
import enErrors from './locales/en/errors.json';
import enFeed from './locales/en/feed.json';
import enMap from './locales/en/map.json';
import enProfile from './locales/en/profile.json';
import enSettings from './locales/en/settings.json';
import enSignal from './locales/en/signal.json';
import trChat from './locales/tr/chat.json';
import trCommon from './locales/tr/common.json';
import trCreate from './locales/tr/create.json';
import trErrors from './locales/tr/errors.json';
import trFeed from './locales/tr/feed.json';
import trMap from './locales/tr/map.json';
import trProfile from './locales/tr/profile.json';
import trSettings from './locales/tr/settings.json';
import trSignal from './locales/tr/signal.json';

/**
 * i18n infrastructure (sinyal-mvp-plan P1.4, `12_I18N_A11Y_PERFORMANCE_ANALYTICS.md` §1). `tr` is the
 * source language the app was written in; `en` is the only other one shipped in the MVP. Namespaces
 * mirror the plan's own file layout (`common/map/signal/create/feed/profile/chat/settings/errors`) so
 * new keys land in the right file without renaming anything later.
 *
 * **Scope of this pass:** infrastructure and a representative seed of real keys per namespace, not a
 * migration of every screen's text - hundreds of files still hold plain Turkish strings today, exactly
 * as before. `AVAILABLE_LANGUAGES`/`supportedLanguage` below is what a future "Ayarlar > Dil" setting
 * (also not built yet) would offer; for now the only thing that reads a key today is the bottom tab bar
 * (`ui/BlinkrBottomBar.tsx`), wired end to end as the proof this pipeline actually works.
 */
export const AVAILABLE_LANGUAGES = ['tr', 'en'] as const;
export type AppLanguage = typeof AVAILABLE_LANGUAGES[number];
export const DEFAULT_LANGUAGE: AppLanguage = 'en';

/** Device language → a language this app ships. Unsupported (or undetectable) devices land on `en`, not `tr` - the plan's own rule ("Cihaz dili → desteklenmiyorsa en"), even though `tr` is the source language. */
export const supportedLanguage = (deviceLanguageCode: string | null | undefined): AppLanguage =>
  (AVAILABLE_LANGUAGES as readonly string[]).includes(deviceLanguageCode ?? '') ? (deviceLanguageCode as AppLanguage) : DEFAULT_LANGUAGE;

const resources = {
  tr: { common: trCommon, map: trMap, signal: trSignal, create: trCreate, feed: trFeed, profile: trProfile, chat: trChat, settings: trSettings, errors: trErrors },
  en: { common: enCommon, map: enMap, signal: enSignal, create: enCreate, feed: enFeed, profile: enProfile, chat: enChat, settings: enSettings, errors: enErrors },
};

/** The person's choice in Ayarlar > Dil (plan-devam G3): 'system' follows the device. Read synchronously at boot. */
export const LANGUAGE_PREFERENCE_KEY = 'blinkr.language.preference.v1';
export type LanguagePreference = 'system' | AppLanguage;
export const isLanguagePreference = (value: unknown): value is LanguagePreference => value === 'system' || value === 'tr' || value === 'en';
export const readLanguagePreference = (): LanguagePreference => {
  try {
    const stored = SecureStore.getItem(LANGUAGE_PREFERENCE_KEY);
    return isLanguagePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
};

let initialized = false;

/** Idempotent: safe to call more than once (e.g. from a test or a fast refresh) without re-initialising i18next. */
export const initI18n = () => {
  if (initialized) return i18n;
  initialized = true;
  const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? null;
  const preference = readLanguagePreference();
  void i18n.use(initReactI18next).init({
    resources,
    // Resources are bundled, so init finishes synchronously: labels built at module load already see the language.
    initAsync: false,
    lng: preference === 'system' ? supportedLanguage(deviceLanguage) : preference,
    fallbackLng: DEFAULT_LANGUAGE,
    ns: ['common', 'map', 'signal', 'create', 'feed', 'profile', 'chat', 'settings', 'errors'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return i18n;
};

export { i18n };
