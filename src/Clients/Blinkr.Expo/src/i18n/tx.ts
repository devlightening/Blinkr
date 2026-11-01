import i18n from 'i18next';

/**
 * Translates `key` ("namespace:path") in the current language (plan-devam G1). The Turkish source text is kept next
 * to the key in code: it is what pure-logic tests (no i18next) and a missing key fall back to, so the app never shows
 * a raw key. `{{name}}` placeholders are filled from `vars` in both cases.
 */
export function tx(key: string, fallback: string, vars?: Record<string, string | number | null | undefined>): string {
  if (i18n.isInitialized && i18n.exists(key)) return i18n.t(key, vars ?? {}) as string;
  return fallback.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => String(vars?.[name] ?? ''));
}
