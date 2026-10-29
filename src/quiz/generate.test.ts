import type { Structure } from '@/contract';
import { mockManifest, mockStructuresFile } from '@/mocks';
import { displayName } from '@/state';
import {
  buildPool,
  expandRegions,
  generateQuiz,
  locateVerdict,
  pickDistractors,
  seededRng,
  type QuizScope,
} from './generate';

const manifest = mockManifest();
const all: Structure[] = ['skeletal', 'muscular', 'visceral'].flatMap(
  (s) => mockStructuresFile(s).structures,
);
const scope = (patch: Partial<QuizScope> = {}): QuizScope => ({
  systems: ['skeletal', 'muscular', 'visceral'],
  regions: [],
  side: 'both',
  count: 10,
  types: ['locate', 'identify', 'name'],
  ...patch,
});

describe('quiz pool', () => {
  it('filters by system', () => {
    const pool = buildPool(all, scope({ systems: ['skeletal'] }), manifest.regions);
    expect(pool.length).toBe(12);
    expect(pool.every((s) => s.system === 'skeletal')).toBe(true);
  });

  it('expands parent regions to their children', () => {
    expect([...expandRegions(manifest.regions, ['trunk'])].sort()).toEqual([
      'abdomen',
      'back',
      'pelvis',
      'thorax',
      'trunk',
    ]);
    const pool = buildPool(all, scope({ regions: ['trunk'] }), manifest.regions);
    expect(pool.map((s) => s.id)).toContain('heart');
    expect(pool.map((s) => s.id)).toContain('liver');
    expect(pool.map((s) => s.id)).not.toContain('femur-l');
  });

  it('side filter keeps unpaired structures and drops the other side', () => {
    const left = buildPool(all, scope({ side: 'left' }), manifest.regions);
    expect(left.some((s) => s.side === 'right')).toBe(false);
    expect(left.some((s) => s.side === 'left')).toBe(true);
    expect(left.some((s) => s.id === 'heart')).toBe(true);
  });

  it('never asks excluded (default-hidden) structures', () => {
    const pool = buildPool(all, scope(), manifest.regions, new Set(['liver']));
    expect(pool.map((s) => s.id)).not.toContain('liver');
    expect(pool.map((s) => s.id)).toContain('heart');
  });
});

describe('distractors', () => {
  const pool = buildPool(all, scope(), manifest.regions);

  it('come from the same system and region, never duplicate names, never the counterpart', () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 25; seed++) {
      for (const target of pool) {
        const ds = pickDistractors(target, pool, 'la', seededRng(seed));
        const names = [target, ...ds].map((s) => displayName(s.names, 'la').toLowerCase());
        if (new Set(names).size !== names.length)
          problems.push(`${target.id}: duplicate names ${names.join('|')}`);
        for (const d of ds) {
          if (d.system !== target.system) problems.push(`${target.id}: ${d.id} other system`);
          if (d.id === target.pairId || d.id === target.id)
            problems.push(`${target.id}: ${d.id} is target/counterpart`);
          if (!pool.includes(d)) problems.push(`${target.id}: ${d.id} outside scope`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('prefers distractors sharing a region', () => {
    const femur = pool.find((s) => s.id === 'femur-l')!;
    // lower-limb skeletal structures with another name: tibia only → 1 same-region distractor first
    const ds = pickDistractors(femur, pool, 'la', seededRng(3), 1);
    expect(ds.map((d) => d.names.en)).toEqual(['Tibia']);
  });

  it('stays inside a narrow scope', () => {
    const narrow = buildPool(all, scope({ systems: ['visceral'], regions: ['thorax'] }), manifest.regions);
    const heart = narrow.find((s) => s.id === 'heart')!;
    const ds = pickDistractors(heart, narrow, 'la', seededRng(1));
    expect(ds.every((d) => d.regions.includes('thorax') && d.system === 'visceral')).toBe(true);
    expect(ds.map((d) => d.id).sort()).toEqual(['lung-l', 'lung-r']);
  });
});

describe('generateQuiz', () => {
  const pool = buildPool(all, scope(), manifest.regions);

  it('creates the requested number of distinct questions with options that include the answer', () => {
    const qs = generateQuiz(pool, scope({ count: 10 }), { rng: seededRng(42), nameLang: 'la' });
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.targetId)).size).toBe(10);
    for (const q of qs) {
      if (q.type !== 'identify') continue;
      expect(q.options).toContain(q.targetId);
      expect(new Set(q.options).size).toBe(q.options!.length);
      expect(q.options!.length).toBeGreaterThanOrEqual(2);
      expect(q.options!.length).toBeLessThanOrEqual(4);
      const labels = q.options!.map((id) => displayName(pool.find((s) => s.id === id)!.names, 'la'));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('mixes the enabled types evenly', () => {
    const qs = generateQuiz(pool, scope({ count: 9 }), { rng: seededRng(7), nameLang: 'la' });
    const counts = { locate: 0, identify: 0, name: 0 };
    for (const q of qs) counts[q.type]++;
    expect(counts.locate).toBeGreaterThanOrEqual(2);
    expect(counts.name).toBeGreaterThanOrEqual(2);
    expect(counts.locate + counts.identify + counts.name).toBe(9);
  });

  it('uses only enabled types and caps the count at the pool size', () => {
    const small = buildPool(all, scope({ systems: ['visceral'] }), manifest.regions);
    const qs = generateQuiz(small, scope({ count: 50, types: ['locate'] }), {
      rng: seededRng(1),
      nameLang: 'la',
    });
    expect(qs).toHaveLength(small.length);
    expect(qs.every((q) => q.type === 'locate')).toBe(true);
  });

  it('falls back from Identify when no distractor exists', () => {
    const lone = pool.filter((s) => s.id === 'heart');
    const qs = generateQuiz(lone, scope({ types: ['identify', 'name'], count: 1 }), {
      rng: seededRng(1),
      nameLang: 'la',
      targets: [{ id: 'heart', type: 'identify' }],
    });
    expect(qs[0]!.type).toBe('name');
  });

  it('is deterministic for a seed and supports explicit targets (retry mistakes)', () => {
    const a = generateQuiz(pool, scope(), { rng: seededRng(5), nameLang: 'la' });
    const b = generateQuiz(pool, scope(), { rng: seededRng(5), nameLang: 'la' });
    expect(a).toEqual(b);
    const retry = generateQuiz(pool, scope(), {
      rng: seededRng(9),
      nameLang: 'la',
      targets: [
        { id: 'liver', type: 'locate' },
        { id: 'gone', type: 'name' },
        { id: 'femur-l', type: 'identify' },
      ],
    });
    expect(retry.map((q) => [q.targetId, q.type])).toEqual([
      ['liver', 'locate'],
      ['femur-l', 'identify'],
    ]);
  });
});

describe('muscle attachment patches', () => {
  const base = all.find((s) => s.id === 'biceps-brachii-l')!;
  const patch = (id: string, kind: 'origin' | 'insertion'): Structure => ({
    ...base,
    id,
    nodeName: id,
    kind,
    system: 'insertions',
    regions: ['upper-limb'],
  });
  const pool = [
    patch('biceps-brachii-origin-l', 'origin'),
    patch('biceps-brachii-insertion-l', 'insertion'),
    { ...patch('deltoid-origin-l', 'origin'), names: { en: 'Deltoid muscle', la: 'Musculus deltoideus' } },
  ];

  it('offers the origin and the insertion of the same muscle as different options', () => {
    const d = pickDistractors(pool[0]!, pool, 'la', seededRng(3));
    expect(d.map((s) => s.id).sort()).toEqual(['biceps-brachii-insertion-l', 'deltoid-origin-l']);
  });
});

describe('locate verdict', () => {
  const femurL = all.find((s) => s.id === 'femur-l')!;
  const femurR = all.find((s) => s.id === 'femur-r')!;
  const heart = all.find((s) => s.id === 'heart')!;
  const twin = (id: string, side: Structure['side']): Structure => ({ ...femurL, id, nodeName: id, side });

  it('grades the target, its counterpart and other structures', () => {
    expect(locateVerdict(femurL, femurL, 'la')).toBe('correct');
    expect(locateVerdict(femurL, femurR, 'la')).toBe('wrong-side');
    expect(locateVerdict(femurL, heart, 'la')).toBe('wrong');
    expect(locateVerdict(femurL, undefined, 'la')).toBe('wrong');
  });

  it('accepts a same-named structure on the same side (numbered patches)', () => {
    expect(locateVerdict(femurL, twin('femur-2-l', 'left'), 'la')).toBe('correct');
    expect(locateVerdict(femurL, twin('femur-2-r', 'right'), 'la')).toBe('wrong-side');
    const origin = { ...twin('femur-origin-l', 'left'), kind: 'origin' as const };
    expect(locateVerdict(femurL, origin, 'la')).toBe('wrong');
  });
});
