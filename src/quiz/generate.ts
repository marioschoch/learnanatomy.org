/**
 * Quiz generation (pure, seedable). Works on loaded structures (with geometry); landmarks and groups are
 * never asked (landmarks have no geometry, ARCHITECTURE.md §12.5).
 */
import type { NameLang, RegionInfo, Structure } from '@/contract';
import { displayName, patchKindOf } from '@/state';

export type QuestionType = 'locate' | 'identify' | 'name';
export type SideFilter = 'both' | 'left' | 'right';

export const QUESTION_TYPES: readonly QuestionType[] = ['locate', 'identify', 'name'];

export interface QuizScope {
  systems: string[];
  /** Region ids; empty = all regions. A parent region includes its children (trunk → thorax …). */
  regions: string[];
  side: SideFilter;
  count: number;
  types: QuestionType[];
}

export interface Question {
  id: string;
  type: QuestionType;
  targetId: string;
  /** Identify: structure ids of the options (target included), in display order. */
  options?: string[];
}

export type Rng = () => number;

/** Small deterministic PRNG (mulberry32) for reproducible tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Selected regions plus all their descendants (RegionInfo.parentId). */
export function expandRegions(regions: readonly RegionInfo[], selected: readonly string[]): Set<string> {
  const out = new Set(selected);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of regions) {
      if (r.parentId && out.has(r.parentId) && !out.has(r.id)) {
        out.add(r.id);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * Structures that match the scope (systems, regions incl. descendants, side). `exclude` = ids never asked: the
 * manifest's default-hidden structures (fasciae, liver segments), which stay hidden during the quiz.
 */
export function buildPool(
  structures: Iterable<Structure>,
  scope: Pick<QuizScope, 'systems' | 'regions' | 'side'>,
  regionInfo: readonly RegionInfo[],
  exclude: ReadonlySet<string> = new Set(),
): Structure[] {
  const systems = new Set(scope.systems);
  const regions = scope.regions.length ? expandRegions(regionInfo, scope.regions) : null;
  const out: Structure[] = [];
  for (const st of structures) {
    if (!systems.has(st.system) || exclude.has(st.id)) continue;
    if (regions && !st.regions.some((r) => regions.has(r))) continue;
    if (scope.side === 'left' && st.side === 'right') continue;
    if (scope.side === 'right' && st.side === 'left') continue;
    out.push(st);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

// Origin and insertion patches carry their muscle's name: the kind is part of what tells options apart.
const kindKey = (st: Structure) => {
  const kind = patchKindOf(st);
  return kind ? `#${kind}` : '';
};
const labelKey = (st: Structure, lang: NameLang) =>
  displayName(st.names, lang).trim().toLowerCase() + kindKey(st);
const enKey = (st: Structure) => st.names.en.trim().toLowerCase() + kindKey(st);

/**
 * Locate verdict for a 3D pick. Structures with the same displayed name (incl. patch kind) cannot be told apart by
 * the question (e.g. the numbered diaphragm origin patches), so any of them counts: same side → correct,
 * other side → wrong side.
 */
export function locateVerdict(
  target: Structure,
  picked: Structure | undefined,
  nameLang: NameLang,
): 'correct' | 'wrong-side' | 'wrong' {
  if (!picked) return 'wrong';
  if (picked.id === target.id) return 'correct';
  if (picked.id === target.pairId) return 'wrong-side';
  if (labelKey(picked, nameLang) !== labelKey(target, nameLang)) return 'wrong';
  return picked.side === target.side ? 'correct' : 'wrong-side';
}

/**
 * Up to `n` distractors for an Identify question, all with a name different from the target and from each
 * other (a left/right pair shares its name, so the counterpart is never an option):
 *   1. same system and sharing a region with the target
 *   2. same system (only when the target has no region or tier 1 is too small)
 * Distractors always come from `pool` (= the quiz scope).
 */
export function pickDistractors(
  target: Structure,
  pool: readonly Structure[],
  nameLang: NameLang,
  rng: Rng,
  n = 3,
): Structure[] {
  const used = new Set([labelKey(target, nameLang), enKey(target)]);
  const sameSystem = pool.filter(
    (s) => s.id !== target.id && s.id !== target.pairId && s.system === target.system,
  );
  const sharesRegion = (s: Structure) => s.regions.some((r) => target.regions.includes(r));
  const tiers = [
    shuffle(sameSystem.filter(sharesRegion), rng),
    shuffle(
      sameSystem.filter((s) => !sharesRegion(s)),
      rng,
    ),
  ];
  const out: Structure[] = [];
  for (const tier of tiers) {
    for (const s of tier) {
      if (out.length >= n) return out;
      const keys = [labelKey(s, nameLang), enKey(s)];
      if (keys.some((k) => used.has(k))) continue;
      keys.forEach((k) => used.add(k));
      out.push(s);
    }
  }
  return out;
}

export interface GenerateOptions {
  rng: Rng;
  nameLang: NameLang;
  /** Explicit targets (retry mistakes / weak structures) instead of a random sample of the pool. */
  targets?: { id: string; type?: QuestionType }[];
}

/** Build the question list. Identify needs ≥ 1 distractor; otherwise another enabled type is used. */
export function generateQuiz(
  pool: readonly Structure[],
  scope: QuizScope,
  opts: GenerateOptions,
): Question[] {
  const types = scope.types.length ? scope.types : [...QUESTION_TYPES];
  const byId = new Map(pool.map((s) => [s.id, s]));
  const picks: { st: Structure; type?: QuestionType }[] = opts.targets
    ? opts.targets.flatMap((t) => {
        const st = byId.get(t.id);
        return st ? [t.type ? { st, type: t.type } : { st }] : [];
      })
    : shuffle(pool, opts.rng)
        .slice(0, Math.max(0, Math.min(scope.count, pool.length)))
        .map((st) => ({ st }));

  // Spread the question types evenly, in random order.
  const typeCycle = shuffle(
    Array.from({ length: picks.length }, (_, i) => types[i % types.length]!),
    opts.rng,
  );

  return picks.map(({ st, type }, i) => {
    let t: QuestionType = type ?? typeCycle[i]!;
    let options: string[] | undefined;
    if (t === 'identify') {
      const distractors = pickDistractors(st, pool, opts.nameLang, opts.rng);
      if (distractors.length === 0) {
        t = types.find((x) => x !== 'identify') ?? 'name';
      } else {
        options = shuffle([st.id, ...distractors.map((d) => d.id)], opts.rng);
      }
    }
    const q: Question = { id: `q${i + 1}-${st.id}`, type: t, targetId: st.id };
    if (options) q.options = options;
    return q;
  });
}
