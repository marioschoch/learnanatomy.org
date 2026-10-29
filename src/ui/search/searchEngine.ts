/**
 * Search over all names (every language present in an entry) and synonyms.
 *
 * Fuse.js finds candidates (typo tolerant); results are then ranked in tiers so that what students expect
 * comes first:
 *   0 exact name · 1 name starts with the query · 2 a word starts with the query ·
 *   3 the name contains the query (or all query words) · 4 fuzzy only
 * Within a tier: structures before groups before landmarks before origin/insertion patches (they carry their
 * muscle's name, so "biceps brachii" must find the muscle first), then Fuse score, then shorter names.
 */
import Fuse, { type IFuseOptions } from 'fuse.js';
import type { SearchEntry } from '@/contract';
import { normalizeText } from '../lib/labels';

export interface SearchHit {
  entry: SearchEntry;
  tier: number;
  score: number;
  /** The name or synonym that matched best (may differ from the displayed name). */
  matched: string;
}

export interface SearchEngine {
  search(query: string, limit?: number): SearchHit[];
  readonly size: number;
}

interface Doc {
  entry: SearchEntry;
  /** All names + synonyms, original spelling. */
  texts: string[];
  /** Same, normalized (lowercase, no diacritics). */
  norm: string[];
}

/** Run the fuzzy pass only when the substring pass found fewer matches than this. */
const FUZZY_BELOW = 8;

const TYPE_RANK: Record<SearchEntry['type'], number> = { structure: 0, group: 1, landmark: 2 };
const PATCH_RANK = 3;
const rankOf = (e: SearchEntry) => (e.kind ? PATCH_RANK : TYPE_RANK[e.type]);
const WORD_START = /[\s(/[,-]/;

function textsOf(e: SearchEntry): string[] {
  const out: string[] = [];
  for (const v of Object.values(e.names)) if (v && !out.includes(v)) out.push(v);
  for (const v of e.synonyms ?? []) if (v && !out.includes(v)) out.push(v);
  return out;
}

function tierOf(norm: string, q: string, words: string[]): number {
  if (norm === q) return 0;
  if (norm.startsWith(q)) return 1;
  const idx = norm.indexOf(q);
  if (idx > 0 && WORD_START.test(norm[idx - 1]!)) return 2;
  if (idx > 0) {
    // a later occurrence may start a word
    let from = idx;
    while ((from = norm.indexOf(q, from + 1)) > 0) if (WORD_START.test(norm[from - 1]!)) return 2;
    return 3;
  }
  if (words.length > 1 && words.every((w) => norm.includes(w))) return 3;
  return 4;
}

const FUSE_OPTIONS: IFuseOptions<Doc> = {
  keys: [{ name: 'texts', weight: 1 }],
  includeScore: true,
  ignoreLocation: true,
  ignoreDiacritics: true,
  threshold: 0.34,
  minMatchCharLength: 2,
};

function trigrams(text: string): string[] {
  const t = ` ${text} `;
  const out: string[] = [];
  for (let i = 0; i + 3 <= t.length; i++) out.push(t.slice(i, i + 3));
  return out;
}

/** Max. entries handed to Fuse after the trigram prefilter (keeps typo search fast on ~5 500 entries). */
const FUZZY_CANDIDATES = 300;

export function createSearchEngine(entries: readonly SearchEntry[]): SearchEngine {
  const docs: Doc[] = entries.map((entry) => {
    const texts = textsOf(entry);
    return { entry, texts, norm: texts.map(normalizeText) };
  });

  // Inverted trigram index, built on the first fuzzy query.
  let gramIndex: Map<string, number[]> | null = null;
  const getGramIndex = () => {
    if (gramIndex) return gramIndex;
    gramIndex = new Map();
    docs.forEach((d, i) => {
      const seen = new Set<string>();
      for (const n of d.norm) for (const g of trigrams(n)) seen.add(g);
      for (const g of seen) {
        const list = gramIndex!.get(g);
        if (list) list.push(i);
        else gramIndex!.set(g, [i]);
      }
    });
    return gramIndex;
  };
  const counts = new Uint16Array(docs.length);

  /** Docs sharing the most trigrams with the query (at least ~a third of them). */
  const fuzzyCandidates = (q: string): number[] => {
    const grams = [...new Set(trigrams(q))];
    const index = getGramIndex();
    counts.fill(0);
    const touched: number[] = [];
    for (const g of grams) {
      for (const i of index.get(g) ?? []) {
        if (counts[i] === 0) touched.push(i);
        counts[i]!++;
      }
    }
    const min = Math.max(1, Math.floor(grams.length / 3));
    return touched
      .filter((i) => counts[i]! >= min)
      .sort((a, b) => counts[b]! - counts[a]!)
      .slice(0, FUZZY_CANDIDATES);
  };

  return {
    size: docs.length,
    search(query, limit = 30) {
      const q = normalizeText(query);
      if (q.length < 1) return [];
      const words = q.split(' ').filter(Boolean);
      const byIndex = new Map<number, number>(); // doc index → fuse score (0 for substring matches)

      // 1. Cheap substring pass (tiers 0–3).
      for (let i = 0; i < docs.length; i++) {
        const norm = docs[i]!.norm;
        if (norm.some((n) => n.includes(q) || (words.length > 1 && words.every((w) => n.includes(w)))))
          byIndex.set(i, 0);
      }
      // 2. Fuse for typo tolerance (tier 4, always ranked last), only when few direct matches exist and only
      //    over the trigram-prefiltered candidates.
      if (q.length >= 3 && byIndex.size < FUZZY_BELOW) {
        const cand = fuzzyCandidates(q);
        if (cand.length) {
          const fuse = new Fuse(
            cand.map((i) => docs[i]!),
            FUSE_OPTIONS,
          );
          for (const r of fuse.search(q, { limit: 200 })) {
            const i = cand[r.refIndex]!;
            if (!byIndex.has(i)) byIndex.set(i, r.score ?? 1);
          }
        }
      }

      const hits: SearchHit[] = [];
      for (const [i, score] of byIndex) {
        const doc = docs[i]!;
        let tier = 5;
        let matched = doc.texts[0] ?? doc.entry.names.en;
        for (let k = 0; k < doc.norm.length; k++) {
          const t = tierOf(doc.norm[k]!, q, words);
          if (t < tier) {
            tier = t;
            matched = doc.texts[k]!;
          }
        }
        if (tier === 5) tier = 4;
        hits.push({ entry: doc.entry, tier, score, matched });
      }
      hits.sort(
        (a, b) =>
          a.tier - b.tier ||
          rankOf(a.entry) - rankOf(b.entry) ||
          (a.tier === 4 ? a.score - b.score : 0) ||
          a.matched.length - b.matched.length ||
          a.matched.localeCompare(b.matched) ||
          (a.entry.side ?? '').localeCompare(b.entry.side ?? '') ||
          a.entry.id.localeCompare(b.entry.id),
      );
      return hits.slice(0, limit);
    },
  };
}
