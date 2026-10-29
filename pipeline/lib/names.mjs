// Pure helpers for Z-Anatomy object names → ids, sides, kinds (ARCHITECTURE.md §4.3). No I/O.

/** URL-safe slug: NFKD, strip diacritics, lowercase, drop apostrophes, non [a-z0-9] runs → '-', trim '-'. */
export function slug(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

const SIDE_OF_LETTER = { l: 'left', r: 'right' };
export const SIDE_LETTER = { left: 'l', right: 'r' };

/**
 * Split a Z-Anatomy object name into its parts.
 *   "Femur.l"                  → { base: "Femur", suffix: ".l", side: "left", kind: "structure" }
 *   "Liver"                    → { base: "Liver", suffix: "", kind: "structure" }
 *   "Diaphragm.o2r"            → { base: "Diaphragm", kind: "origin", patch: 2, side: "right" }
 *   "Adductor pollicis.e1l"    → { base: "Adductor pollicis", kind: "insertion", patch: 1, side: "left" }
 *   "Bones of lower limb.g"    → { base: "Bones of lower limb", suffix: ".g", kind: "group" }
 *   "Acetabular fossa.s"       → { base: "Acetabular fossa", suffix: ".s", kind: "label" }
 * `base` is trimmed (two source names have a leading space).
 */
export function parseName(name) {
  const raw = String(name);
  let m = raw.match(/^(.*)\.([oe])(\d*)([lr])$/);
  if (m && m[1].trim()) {
    return {
      base: m[1].trim(),
      suffix: `.${m[2]}${m[3]}${m[4]}`,
      kind: m[2] === 'o' ? 'origin' : 'insertion',
      patch: m[3] ? Number(m[3]) : undefined,
      side: SIDE_OF_LETTER[m[4]],
    };
  }
  m = raw.match(/^(.*)\.([lr])$/);
  if (m && m[1].trim())
    return { base: m[1].trim(), suffix: `.${m[2]}`, kind: 'structure', side: SIDE_OF_LETTER[m[2]] };
  m = raw.match(/^(.*)\.(g)$/);
  if (m && m[1].trim()) return { base: m[1].trim(), suffix: '.g', kind: 'group' };
  m = raw.match(/^(.*)\.([ts])$/);
  if (m && m[1].trim()) return { base: m[1].trim(), suffix: `.${m[2]}`, kind: 'label' };
  m = raw.match(/^(.*)\.([ji])$/);
  if (m && m[1].trim()) return { base: m[1].trim(), suffix: `.${m[2]}`, kind: 'line' };
  return { base: raw.trim(), suffix: '', kind: 'structure' };
}

/**
 * Side stated by an English name without suffix: leading "Left …"/"Right …" or "… of (the) left/right …".
 * Returns 'left' | 'right' | undefined. Names that mention both sides return undefined.
 */
export function sideFromName(base) {
  const b = String(base).trim();
  const lead = b.match(/^(left|right)\b/i);
  const of = [...b.matchAll(/\bof (?:the )?(left|right)\b/gi)].map((x) => x[1].toLowerCase());
  const found = new Set([...(lead ? [lead[1].toLowerCase()] : []), ...of]);
  if (found.size !== 1) return undefined;
  return [...found][0];
}

/** Id stem of a node before collision handling (ARCHITECTURE.md §4.3). */
export function baseId(kind, base, { side, sideFromSuffix, patch } = {}) {
  const s = slug(base);
  const sideSuffix = side && sideFromSuffix ? `-${SIDE_LETTER[side]}` : '';
  switch (kind) {
    case 'origin':
    case 'insertion':
      return `${s}-${kind}${patch ? `-${patch}` : ''}${side ? `-${SIDE_LETTER[side]}` : ''}`;
    case 'group':
      return `g-${s}`;
    case 'landmark':
      return `lm-${s}${side ? `-${SIDE_LETTER[side]}` : ''}`;
    default:
      return `${s}${sideSuffix}`;
  }
}

/**
 * Resolve id collisions deterministically.
 * items: [{ key, stem, sourceName, system, systemOrder }]
 * Sorted by (sourceName, systemOrder); the first keeps the stem, later ones get `-<system>`, then `-2`, `-3`, …
 * Returns { ids: Map<key, id>, collisions: [{ stem, members: [{ sourceName, system, id }] }] }.
 */
export function resolveIds(items) {
  const byStem = new Map();
  for (const it of items) {
    if (!byStem.has(it.stem)) byStem.set(it.stem, []);
    byStem.get(it.stem).push(it);
  }
  const taken = new Set([...byStem.keys()]);
  const ids = new Map();
  const collisions = [];
  const stems = [...byStem.keys()].sort();
  for (const stem of stems) {
    const group = byStem
      .get(stem)
      .slice()
      .sort((a, b) =>
        a.sourceName < b.sourceName
          ? -1
          : a.sourceName > b.sourceName
            ? 1
            : (a.systemOrder ?? 0) - (b.systemOrder ?? 0),
      );
    if (group.length === 1) {
      ids.set(group[0].key, stem);
      continue;
    }
    const members = [];
    group.forEach((it, i) => {
      let id = stem;
      if (i > 0) {
        id = `${stem}-${slug(it.system)}`;
        let n = 2;
        while (taken.has(id)) id = `${stem}-${slug(it.system)}-${n++}`;
        taken.add(id);
      }
      ids.set(it.key, id);
      members.push({ sourceName: it.sourceName, system: it.system, id });
    });
    collisions.push({ stem, members });
  }
  return { ids, collisions };
}
