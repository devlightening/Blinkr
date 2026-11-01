/**
 * @mentions and #hashtags in user text (V2-4, D-027). Pure logic, no React Native imports; the same rules as the server
 * (`Shared.Events.Text.TextTags`), so what is drawn as a link is exactly what the server resolved.
 * - mention: `@` + 3-30 letters, digits, `_ . -`, not glued to a word or another `@` (e-mail addresses are not
 *   mentions); a trailing `.` or `-` is punctuation. Only a name the server resolved becomes a link.
 * - hashtag: `#` + 2-40 letters, digits or `_`; stored folded (lower case, Turkish letters to ASCII, no diacritics).
 */
export type Mention = { userId: string; userName: string };
export type RichSegment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; text: string; userId: string; userName: string }
  | { kind: 'hashtag'; text: string; tag: string };

const WORD = /[\p{L}\p{N}_]/u;
const NAME_CHAR = /[\p{L}\p{N}_.-]/u;
const TAG_CHAR = /[\p{L}\p{N}_]/u;

/** Lower case, Turkish letters to their ASCII base, other diacritics dropped; letters, digits and _ kept. */
export const foldTag = (text: string) => {
  const turkish: Record<string, string> = { ı: 'i', İ: 'i', I: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };
  return Array.from(text.trim().replace(/^#/, ''))
    .map((c) => turkish[c] ?? c)
    .join('')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .split('')
    .filter((c) => TAG_CHAR.test(c))
    .join('');
};

/** Splits text into plain runs, resolved mentions and hashtags. Unresolved @names stay plain text. */
export const parseRichText = (text: string, mentions: Mention[] = []): RichSegment[] => {
  const byName = new Map(mentions.map((m) => [m.userName.toLowerCase(), m]));
  const chars = Array.from(text);
  const out: RichSegment[] = [];
  let plain = '';
  const flush = () => { if (plain) { out.push({ kind: 'text', text: plain }); plain = ''; } };
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    const prev = i > 0 ? chars[i - 1] : '';
    if (c === '@' && !(prev && (WORD.test(prev) || prev === '@' || prev === '.'))) {
      let j = i + 1;
      while (j < chars.length && j - i - 1 < 30 && NAME_CHAR.test(chars[j])) j += 1;
      let name = chars.slice(i + 1, j).join('');
      const trimmed = name.replace(/[.-]+$/, '');
      const mention = trimmed.length >= 3 ? byName.get(trimmed.toLowerCase()) : undefined;
      if (mention) {
        flush();
        out.push({ kind: 'mention', text: `@${trimmed}`, userId: mention.userId, userName: mention.userName });
        name = trimmed;
        i += 1 + Array.from(name).length;
        continue;
      }
    }
    if (c === '#' && !(prev && (WORD.test(prev) || prev === '#'))) {
      let j = i + 1;
      while (j < chars.length && TAG_CHAR.test(chars[j])) j += 1;
      const raw = chars.slice(i + 1, j).join('');
      if (raw.length >= 2 && raw.length <= 40) {
        flush();
        out.push({ kind: 'hashtag', text: `#${raw}`, tag: foldTag(raw) });
        i = j;
        continue;
      }
    }
    plain += c;
    i += 1;
  }
  flush();
  return out;
};

/** The @word being typed at the cursor (for suggestions), or null. `query` has no "@". */
export const activeMention = (text: string, cursor = text.length): { start: number; query: string } | null => {
  const before = text.slice(0, cursor);
  const match = /(^|[^\p{L}\p{N}_@.])@([\p{L}\p{N}_.-]{0,30})$/u.exec(before);
  if (!match) return null;
  return { start: before.length - match[2].length - 1, query: match[2] };
};

/** Replaces the @word being typed with the chosen name and a space; answers the new text and cursor. */
export const insertMention = (text: string, cursor: number, userName: string) => {
  const active = activeMention(text, cursor);
  if (!active) return { text, cursor };
  const inserted = `@${userName} `;
  const next = text.slice(0, active.start) + inserted + text.slice(cursor).replace(/^\s+/, '');
  return { text: next, cursor: active.start + inserted.length };
};

/** How many distinct names the text mentions (the server refuses more than 10). */
export const MENTION_LIMIT = 10;
export const mentionCount = (text: string) => {
  const names = new Set<string>();
  const re = /(^|[^\p{L}\p{N}_@.])@([\p{L}\p{N}_.-]{3,30})/gu;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const name = m[2].replace(/[.-]+$/, '');
    if (name.length >= 3) names.add(name.toLowerCase());
  }
  return names.size;
};
