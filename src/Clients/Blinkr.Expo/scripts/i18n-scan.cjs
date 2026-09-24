// plan-devam G1/G2: lists user-visible text still written in code instead of going through the i18n files.
// usage: node scripts/i18n-scan.cjs [--summary] [--max N]   (exit code 1 when more than --max findings)
// Flags: string literals with Turkish letters or common Turkish words, JSX text between tags (also on its own line),
// and literal values of label-like props. Text inside tx(...) / t(...) is translated; a line marked "i18n-fallback"
// holds source text on purpose (search terms, Turkish fallbacks).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'src');
// Kept in code on purpose (see their own comments): the legal drafts, the i18n setup, the dev-only component preview.
const SKIP = new Set(['legalContent.ts', 'i18n', 'DevComponentPreview.tsx']);
const TURKISH = /[çğıöşüÇĞİÖŞÜ]|\b(ve|bir|için|ile|yok|var|gönder|kapat|sinyal|yer|harita|paylaş|seç|tekrar dene)\b/i;
const LABEL_PROP = /\b(label|title|placeholder|description|subtitle|hint|message|accessibilityLabel|accessibilityHint)\s*[=:]\s*\{?\s*(['"`])([^'"`]{2,}?)\2/g;
const LITERAL = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
const JSX_TEXT = />([^<>{}]*[A-Za-zÇĞİÖŞÜçğıöşü][^<>{}]*)</g;
const TRANSLATED = /\b(tx|t|i18n\.t)\(\s*$/;
const CALLS_TRANSLATION = /\b(tx|t)\(/;
const WORDS_ONLY_LINE = /^[A-ZÇĞİÖŞÜ][^<>{}=;()[\]`'"]*$/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) yield full;
  }
}

const isCodeLike = (text) => /^[a-z0-9_.:/#%@-]+$/i.test(text.trim()) || /^(tr-TR|en-GB|tr|en)$/.test(text.trim());

const findings = [];
for (const file of walk(root)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (/^(\/\/|\*|\/\*|import |\{\/\*)/.test(trimmed) || line.includes('i18n-fallback')) return;
    if (/console\.(log|warn|error)|testID=|throw new Error\('[a-z-]+'\)/.test(line) && !TURKISH.test(line)) return;
    const found = new Set();
    for (const m of line.matchAll(LITERAL)) {
      const text = m[1] ?? m[2] ?? m[3] ?? '';
      // The fallback text passed to tx('key', 'fallback') is the source text, not a finding.
      const before = line.slice(0, m.index);
      if (/\btx\(\s*'[^']*',\s*$/.test(before) || TRANSLATED.test(before)) continue;
      if (text.trim().length > 1 && TURKISH.test(text) && !isCodeLike(text) && !CALLS_TRANSLATION.test(text)) found.add(text.trim());
    }
    for (const m of line.matchAll(LABEL_PROP)) if (/^[A-ZÇĞİÖŞÜ]/.test(m[3])) found.add(m[3].trim());
    for (const m of line.matchAll(JSX_TEXT)) {
      const text = m[1].trim();
      // '=>' before the '>' is a generic type (Promise<T>), not JSX.
      if (line[m.index - 1] === '=' || text === 'blinkr') continue;
      if (text.length > 1 && /^[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text) && !/[=;()?]|=>|&&|\|\||^new /.test(text)) found.add(text);
    }
    if (file.endsWith('.tsx') && WORDS_ONLY_LINE.test(trimmed) && !trimmed.endsWith(',') && /[a-zçğıöşü]/.test(trimmed)) found.add(trimmed);
    for (const text of found) findings.push({ file: path.relative(root, file).replace(/\\/g, '/'), line: index + 1, text: text.slice(0, 90) });
  });
}

const byFile = findings.reduce((acc, f) => { acc[f.file] = (acc[f.file] ?? 0) + 1; return acc; }, {});
if (process.argv.includes('--summary')) {
  Object.entries(byFile).sort((a, b) => b[1] - a[1]).forEach(([file, count]) => console.log(String(count).padStart(4), file));
} else {
  findings.forEach((f) => console.log(`${f.file}:${f.line}  ${f.text}`));
}
console.log(`TOTAL ${findings.length} in ${Object.keys(byFile).length} files`);
const maxIndex = process.argv.indexOf('--max');
if (maxIndex > 0 && findings.length > Number(process.argv[maxIndex + 1])) process.exit(1);
