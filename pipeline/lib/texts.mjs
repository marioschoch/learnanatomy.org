// Pure helpers for the Z-Anatomy text datablocks: definitions, Translations, TA2 (ARCHITECTURE.md §4.3).

const URL_LINE_RE = /^(https?:\/\/\S+)$/;
const HEADING_RE = /^=+\s.*\s=+$/;

/**
 * Parse a definition text datablock.
 *   "\n\nFEMUR\n\n\nThe femur … \n\n\nhttps://en.wikipedia.org/wiki/Femur"
 * → { text: "The femur …", sourceUrl, source: "Wikipedia", license: "CC-BY-SA-3.0", lang: "en" }
 * The leading title paragraph (upper case) and the trailing URL are removed; whitespace-only lines and
 * trailing empty wiki section headings ("== Notes ==") are dropped. Returns null when no text remains.
 */
export function parseDefinition(raw) {
  if (typeof raw !== 'string') return null;
  let lines = raw.replace(/\r\n?/g, '\n').split('\n');
  lines = lines.map((l) => (l.trim() === '' ? '' : l.replace(/\s+$/, '')));
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();

  let sourceUrl;
  if (lines.length && URL_LINE_RE.test(lines[lines.length - 1].trim())) {
    sourceUrl = lines.pop().trim();
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
  }
  // title paragraph: the first block of lines before an empty line, when it contains no lower-case letters
  const firstBlank = lines.indexOf('');
  const titleBlock = firstBlank === -1 ? lines : lines.slice(0, firstBlank);
  if (titleBlock.length && titleBlock.length <= 4 && !/\p{Ll}/u.test(titleBlock.join(' '))) {
    lines = firstBlank === -1 ? [] : lines.slice(firstBlank);
  }
  let text = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // drop trailing empty section headings
  for (;;) {
    const paras = text.split('\n\n');
    const last = paras[paras.length - 1]?.trim() ?? '';
    if (paras.length > 0 && HEADING_RE.test(last)) {
      paras.pop();
      text = paras.join('\n\n').trim();
    } else break;
  }
  if (!text) return null;

  let source = 'Z-Anatomy';
  let license = 'CC-BY-SA-4.0';
  // All Z-Anatomy definition texts are English (also the two taken from fr.wikipedia.org pages).
  const lang = 'en';
  if (sourceUrl) {
    let host;
    try {
      host = new URL(sourceUrl).hostname;
    } catch {
      host = '';
    }
    if (/(^|\.)wikipedia\.org$/.test(host)) {
      source = 'Wikipedia';
      license = 'CC-BY-SA-3.0';
    } else if (host) {
      source = host;
    }
  }
  return { text, sourceUrl, source, license, lang };
}

const LANG_COLUMNS = {
  English: 'en',
  Latin: 'la',
  Français: 'fr',
  Español: 'es',
  Portugues: 'pt',
  Deutsch: 'de',
};

/**
 * Index of the `Translations` text: exact (trimmed) English → { la, fr, es, pt }.
 * Duplicated English rows: the first row wins; conflicts are returned for the report.
 */
export function buildTranslations({ header, rows }) {
  const cols = header.map((h) => LANG_COLUMNS[h.trim()]);
  const enCol = cols.indexOf('en');
  const map = new Map();
  const conflicts = [];
  for (const row of rows) {
    const en = (row[enCol] ?? '').trim();
    if (!en) continue;
    const names = {};
    cols.forEach((lang, i) => {
      if (!lang || lang === 'en') return;
      const v = (row[i] ?? '').trim();
      if (v) names[lang] = v;
    });
    if (map.has(en)) {
      if (JSON.stringify(map.get(en)) !== JSON.stringify(names)) conflicts.push(en);
      continue;
    }
    map.set(en, names);
  }
  const languages = [...new Set(cols.filter(Boolean))];
  return { map, conflicts, languages };
}

/** Normalization for TA2 matching: case- and whitespace-insensitive. */
export function normTerm(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Parse TA2.csv (UTF-8 with BOM, every line wrapped in "…", `;`-separated:
 * TA2ID;English;Latin;Français;Español;Portugues;Italiano;Parsi). Returns rows { id, en, la }.
 */
export function parseTa2Csv(content) {
  const out = [];
  const lines = String(content)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/);
  let header = null;
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('"') && line.endsWith('"') && line.length >= 2) line = line.slice(1, -1);
    const cols = line.split(';');
    if (!header) {
      header = cols.map((c) => c.trim());
      continue;
    }
    const get = (name) => (cols[header.indexOf(name)] ?? '').trim();
    const id = get('TA2ID');
    const en = get('English');
    if (!id || !en) continue;
    out.push({ id, en, la: get('Latin') });
  }
  return out;
}

export function buildTa2Index(rows) {
  const byEn = new Map();
  for (const r of rows) {
    const k = normTerm(r.en);
    if (!byEn.has(k)) byEn.set(k, []);
    byEn.get(k).push(r);
  }
  return byEn;
}

/**
 * TA2 match for an English base name (ARCHITECTURE.md §4.3): the row is used when the English match is unique,
 * or when several rows match and exactly one also has the same Latin name as `Translations`.
 * Returns { status: 'match' | 'ambiguous' | 'none', row? }.
 */
export function matchTa2(index, en, translationsLatin) {
  if (!index) return { status: 'none' };
  const rows = index.get(normTerm(en)) ?? [];
  if (rows.length === 0) return { status: 'none' };
  if (rows.length === 1) return { status: 'match', row: rows[0] };
  if (translationsLatin) {
    const same = rows.filter((r) => normTerm(r.la) === normTerm(translationsLatin));
    if (same.length === 1) return { status: 'match', row: same[0] };
  }
  return { status: 'ambiguous' };
}
