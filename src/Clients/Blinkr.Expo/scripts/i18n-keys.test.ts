import enChat from '../src/i18n/locales/en/chat.json';
import enCommon from '../src/i18n/locales/en/common.json';
import enCreate from '../src/i18n/locales/en/create.json';
import enErrors from '../src/i18n/locales/en/errors.json';
import enFeed from '../src/i18n/locales/en/feed.json';
import enMap from '../src/i18n/locales/en/map.json';
import enProfile from '../src/i18n/locales/en/profile.json';
import enSettings from '../src/i18n/locales/en/settings.json';
import enSignal from '../src/i18n/locales/en/signal.json';
import trChat from '../src/i18n/locales/tr/chat.json';
import trCommon from '../src/i18n/locales/tr/common.json';
import trCreate from '../src/i18n/locales/tr/create.json';
import trErrors from '../src/i18n/locales/tr/errors.json';
import trFeed from '../src/i18n/locales/tr/feed.json';
import trMap from '../src/i18n/locales/tr/map.json';
import trProfile from '../src/i18n/locales/tr/profile.json';
import trSettings from '../src/i18n/locales/tr/settings.json';
import trSignal from '../src/i18n/locales/tr/signal.json';

/**
 * The plan's own "kaynak kontrol" (12_I18N_A11Y_PERFORMANCE_ANALYTICS.md §1): tr and en must offer
 * exactly the same keys in every namespace, so a missing translation can never silently fall back to
 * showing a raw key (or the wrong language) to someone. Run whenever a locale file changes.
 */
function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const dottedKeys = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => dottedKeys(child, prefix ? `${prefix}.${key}` : key));
};
const leafValues = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(leafValues);
};

const namespaces: Array<[string, unknown, unknown]> = [
  ['common', trCommon, enCommon],
  ['map', trMap, enMap],
  ['signal', trSignal, enSignal],
  ['create', trCreate, enCreate],
  ['feed', trFeed, enFeed],
  ['profile', trProfile, enProfile],
  ['chat', trChat, enChat],
  ['settings', trSettings, enSettings],
  ['errors', trErrors, enErrors],
];

run('tr and en offer exactly the same keys in every namespace', () => {
  for (const [name, tr, en] of namespaces) {
    const trKeys = dottedKeys(tr).sort();
    const enKeys = dottedKeys(en).sort();
    check(JSON.stringify(trKeys) === JSON.stringify(enKeys), `${name}: tr=[${trKeys.join(',')}] en=[${enKeys.join(',')}]`);
  }
});
run('no namespace is empty and no value is a blank string', () => {
  for (const [name, tr, en] of namespaces) {
    check(dottedKeys(tr).length > 0, `${name} (tr) has keys`);
    check([...leafValues(tr), ...leafValues(en)].every((value) => value.trim().length > 0), `${name} has no blank translation`);
  }
});
