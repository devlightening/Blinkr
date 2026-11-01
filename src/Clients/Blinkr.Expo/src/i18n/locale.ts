import i18n from 'i18next';

/** The locale for dates, times and numbers: follows the app language, not the device (plan-devam G3). */
export const displayLocale = () => (i18n.isInitialized && i18n.language === 'en' ? 'en-GB' : 'tr-TR');
