import type { SearchEntry } from '@/contract';
import { mockSearchEntries } from '@/mocks';
import { createSearchEngine } from './searchEngine';

const ids = (hits: { entry: SearchEntry }[]) => hits.map((h) => h.entry.id);

describe('search engine', () => {
  const engine = createSearchEngine(mockSearchEntries());

  it('finds by Latin and English names', () => {
    expect(ids(engine.search('hepar'))[0]).toBe('liver');
    expect(ids(engine.search('liver'))[0]).toBe('liver');
    expect(ids(engine.search('Cor'))[0]).toBe('heart');
  });

  it('ranks exact > prefix > word-start > substring > fuzzy', () => {
    const entries: SearchEntry[] = [
      { id: 'a-fuzzy', type: 'structure', system: 's', names: { en: 'Femor bone' } },
      { id: 'b-sub', type: 'structure', system: 's', names: { en: 'Xfemurx' } },
      { id: 'c-word', type: 'structure', system: 's', names: { en: 'Head of femur' } },
      { id: 'd-prefix', type: 'structure', system: 's', names: { en: 'Femur neck' } },
      { id: 'e-exact', type: 'structure', system: 's', names: { en: 'Femur' } },
    ];
    const hits = createSearchEngine(entries).search('femur');
    expect(ids(hits)).toEqual(['e-exact', 'd-prefix', 'c-word', 'b-sub', 'a-fuzzy']);
    expect(hits.map((h) => h.tier)).toEqual([0, 1, 2, 3, 4]);
  });

  it('puts structures before groups and landmarks of the same tier, both sides together', () => {
    const hits = engine.search('femur');
    expect(ids(hits).slice(0, 2).sort()).toEqual(['femur-l', 'femur-r']);
    expect(hits[0]!.entry.side).toBe('left');
  });

  it('tolerates typos', () => {
    expect(ids(engine.search('humerys'))).toContain('humerus-l');
    expect(ids(engine.search('gastrocnemus'))).toContain('gastrocnemius-l');
  });

  it('ignores case and diacritics', () => {
    const e = createSearchEngine([
      {
        id: 'x',
        type: 'structure',
        system: 's',
        names: { en: 'Muscle', fr: 'Muscle sterno-cléido-mastoïdien' },
      },
    ]);
    expect(ids(e.search('cleido mastoidien'))).toEqual(['x']);
    expect(ids(e.search('CLÉIDO'))).toEqual(['x']);
  });

  it('searches synonyms and reports what matched', () => {
    const e = createSearchEngine([
      { id: 'femur-l', type: 'structure', system: 's', names: { en: 'Femur' }, synonyms: ['Thigh bone'] },
    ]);
    const [hit] = e.search('thigh');
    expect(hit?.entry.id).toBe('femur-l');
    expect(hit?.matched).toBe('Thigh bone');
  });

  it('matches multi-word queries in any order', () => {
    expect(ids(engine.search('brachii biceps'))).toContain('biceps-brachii-l');
  });

  it('stays fast with ~5 500 entries', () => {
    const big: SearchEntry[] = [];
    const words = ['arteria', 'nervus', 'musculus', 'vena', 'os', 'ligamentum', 'nodus', 'ramus'];
    const quals = ['superior', 'inferior', 'medialis', 'lateralis', 'anterior', 'posterior', 'profundus'];
    for (let i = 0; i < 5500; i++) {
      const la = `${words[i % words.length]} ${quals[i % quals.length]} ${i}`;
      big.push({
        id: `n-${i}`,
        type: i % 10 === 0 ? 'group' : 'structure',
        system: 's',
        names: { la, en: `Structure number ${i}` },
        ...(i % 2 ? { side: 'left' as const } : {}),
      });
    }
    big.push({ id: 'target', type: 'structure', system: 's', names: { en: 'Nervus ischiadicus' } });
    const e = createSearchEngine(big);
    e.search('warm up');
    const t0 = performance.now();
    const hits = e.search('ischiadicus');
    const dt = performance.now() - t0;
    expect(hits[0]?.entry.id).toBe('target');
    expect(dt).toBeLessThan(500); // generous bound for loaded CI machines (see report for typical numbers)
  });

  it('returns nothing for an empty query', () => {
    expect(engine.search('   ')).toEqual([]);
  });
});
