/**
 * Typed-answer checking for "Name it": forgiving about case, accents, punctuation, standard Latin
 * abbreviations (M., A., N., Lig. …) and a few typos — and it tells the student how many.
 */

/** Standard abbreviations in anatomical Latin (TA usage). Only expands what the student typed. */
const ABBREVIATIONS: Record<string, string> = {
  m: 'musculus',
  mm: 'musculi',
  a: 'arteria',
  aa: 'arteriae',
  v: 'vena',
  vv: 'venae',
  n: 'nervus',
  nn: 'nervi',
  lig: 'ligamentum',
  ligg: 'ligamenta',
  r: 'ramus',
  rr: 'rami',
  proc: 'processus',
  gl: 'glandula',
  ggl: 'ganglion',
  for: 'foramen',
};

/** Generic class words that may be left out ("biceps brachii" for "Musculus biceps brachii"). */
const OPTIONAL_WORDS = new Set(['musculus', 'muscle', 'm']);

export function normalizeAnswer(s: string): string {
  const base = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim();
  return base
    .split(' ')
    .map((w) => {
      const bare = w.replace(/\.+$/, '');
      return w.endsWith('.') && ABBREVIATIONS[bare] ? ABBREVIATIONS[bare] : bare.replace(/\./g, '');
    })
    .filter(Boolean)
    .join(' ');
}

/** Variants of a correct name that count as the same answer. */
export function answerVariants(name: string): string[] {
  const out = new Set<string>();
  const full = normalizeAnswer(name);
  out.add(full);
  const noParens = normalizeAnswer(name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '));
  if (noParens) out.add(noParens);
  for (const v of [...out]) {
    const words = v.split(' ');
    const stripped = words.filter((w, i) => !(OPTIONAL_WORDS.has(w) && (i === 0 || i === words.length - 1)));
    if (stripped.length && stripped.length < words.length) out.add(stripped.join(' '));
  }
  return [...out];
}

/** Levenshtein distance with an optional early exit above `max`. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** Allowed typos for an answer of this length: 0 up to 4 letters, then 1, 2 from 9, 3 from 15. */
export function typoTolerance(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  if (length <= 14) return 2;
  return 3;
}

export interface TypedAnswerResult {
  verdict: 'exact' | 'typo' | 'wrong';
  /** Edit distance to the closest accepted name (0 for exact). */
  distance: number;
  /** Allowed distance for the closest accepted name. */
  tolerance: number;
  /** The accepted name (original spelling) closest to the input. */
  expected: string;
}

/** Check a typed answer against the accepted names (e.g. Latin + English). */
export function checkTypedAnswer(input: string, acceptedNames: readonly string[]): TypedAnswerResult {
  let best: TypedAnswerResult = {
    verdict: 'wrong',
    distance: Infinity,
    tolerance: 0,
    expected: acceptedNames[0] ?? '',
  };
  const givenVariants = normalizeAnswer(input) ? answerVariants(input) : [];
  if (givenVariants.length === 0) return best;
  for (const name of acceptedNames) {
    for (const variant of answerVariants(name)) {
      const tolerance = typoTolerance(variant.length);
      for (const given of givenVariants) {
        const d = levenshtein(given, variant, Math.max(tolerance, 8));
        if (d < best.distance) best = { verdict: 'wrong', distance: d, tolerance, expected: name };
      }
    }
  }
  if (best.distance === 0) best.verdict = 'exact';
  else if (best.distance <= best.tolerance) best.verdict = 'typo';
  return best;
}
