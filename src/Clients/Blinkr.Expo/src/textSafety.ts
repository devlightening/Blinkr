/**
 * Personal-data warning before posting (sinyal-mvp-plan Faz 10 P10.1, 11 §4): phone numbers, Turkish national ID
 * numbers, number plates and street addresses in public text. The app only warns; the server is what protects:
 * it masks national ID numbers and plates (`Shared.Moderation.ContentTextFilter`) and refuses threats and hate
 * (422 `CONTENT_BLOCKED`). Private chat is not checked here.
 */
export type PersonalDataKind = 'phone' | 'nationalId' | 'plate' | 'address';

/** Same rule as the server's `IsValidNationalId`: 11 digits, first not 0, two check digits. */
export const isValidNationalId = (value: string) => {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = [...value].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
};

const NATIONAL_ID = /(?<!\d)[1-9]\d{10}(?!\d)/g;
// Same shape as the server: province 01-81 + 1 letter/4-5 digits, 2 letters/3-4 digits or 3 letters/2-3 digits.
const PLATE = /(?<![\p{L}\d])(0[1-9]|[1-7]\d|8[01])\s?([A-Z]\s?\d{4,5}|[A-Z]{2}\s?\d{3,4}|[A-Z]{3}\s?\d{2,3})(?![\p{L}\d])/u;
// Turkish mobile/landline (0532 123 45 67, +90 532 123 4567, (0312) 123 45 67) or any +country number.
const PHONE = /(?<![\d+])(?:(?:\+|00)90[\s-]?)?\(?0?[2-5]\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)|\+\d{1,3}[\s-]?\d(?:[\s-]?\d){7,12}/;
const STREET = /(mahalle(si)?|mah\.|sokak|sokağı|sok\.|sk\.|cadde(si)?|cad\.|bulvar(ı)?|apartman(ı)?|apt\.|street|st\.|avenue|ave\.|road|rd\.)/iu;
const HOUSE_NUMBER = /(no\s*[:.]?\s*\d+|daire\s*[:.]?\s*\d+|kat\s*[:.]?\s*\d+|d\s*[:.]\s*\d+|\d+\s*\/\s*\d+|\d+\s+(?:\p{L}+\s+){0,3}(street|st\.|avenue|ave\.|road|rd\.))/iu;

export const personalDataKinds = (text: string | null | undefined): PersonalDataKind[] => {
  if (!text) return [];
  const kinds: PersonalDataKind[] = [];
  const ids = text.match(NATIONAL_ID) ?? [];
  const hasId = ids.some(isValidNationalId);
  if (hasId) kinds.push('nationalId');
  // An 11-digit national ID also looks like a phone number; only count a phone when something else matched.
  const withoutIds = hasId ? text.replace(NATIONAL_ID, (m) => (isValidNationalId(m) ? ' ' : m)) : text;
  if (PHONE.test(withoutIds)) kinds.push('phone');
  if (PLATE.test(text)) kinds.push('plate');
  if (STREET.test(text) && HOUSE_NUMBER.test(text)) kinds.push('address');
  return kinds;
};

/** The server hides these by itself; the others stay as written, so the warning says so. */
export const isMaskedByServer = (kind: PersonalDataKind) => kind === 'nationalId' || kind === 'plate';

/** Which warning to show for a set of texts (title + body …), or null. */
export const personalDataNotice = (...texts: (string | null | undefined)[]) => {
  const kinds = [...new Set(texts.flatMap((t) => personalDataKinds(t)))];
  if (kinds.length === 0) return null;
  return { kinds, allMasked: kinds.every(isMaskedByServer) };
};
