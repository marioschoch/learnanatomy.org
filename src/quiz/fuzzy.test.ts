import { answerVariants, checkTypedAnswer, levenshtein, normalizeAnswer, typoTolerance } from './fuzzy';

describe('typed answers', () => {
  it('computes edit distance', () => {
    expect(levenshtein('femur', 'femur')).toBe(0);
    expect(levenshtein('femur', 'femure')).toBe(1);
    expect(levenshtein('tibia', 'fibula')).toBe(3);
    expect(levenshtein('abc', 'abcdefgh', 2)).toBe(3);
  });

  it('normalizes case, accents, punctuation and Latin abbreviations', () => {
    expect(normalizeAnswer('  M. Biceps  brachii ')).toBe('musculus biceps brachii');
    expect(normalizeAnswer('Lig. teres')).toBe('ligamentum teres');
    expect(normalizeAnswer('Sterno-cléido')).toBe('sterno cleido');
    expect(normalizeAnswer('Vagus nerve (X)')).toBe('vagus nerve x');
  });

  it('accepts names without the generic class word and without parentheses', () => {
    expect(answerVariants('Musculus biceps brachii')).toContain('biceps brachii');
    expect(answerVariants('Deltoid muscle')).toContain('deltoid');
    expect(answerVariants('Vagus nerve (X)')).toContain('vagus nerve');
  });

  it('accepts exact answers in Latin or English', () => {
    const names = ['Musculus biceps brachii', 'Biceps brachii'];
    expect(checkTypedAnswer('biceps brachii', names).verdict).toBe('exact');
    expect(checkTypedAnswer('M. biceps brachii', names).verdict).toBe('exact');
    expect(checkTypedAnswer('Hepar', ['Hepar', 'Liver']).verdict).toBe('exact');
    expect(checkTypedAnswer('liver', ['Hepar', 'Liver'])).toMatchObject({
      verdict: 'exact',
      expected: 'Liver',
    });
  });

  it('accepts small typos and reports how many', () => {
    const r = checkTypedAnswer('gastrocnemus', ['Musculus gastrocnemius', 'Gastrocnemius']);
    expect(r.verdict).toBe('typo');
    expect(r.distance).toBe(1);
    expect(r.expected).toMatch(/gastrocnemius/i);
    expect(checkTypedAnswer('humerous', ['Humerus']).verdict).toBe('typo');
  });

  it('rejects wrong answers and short-word typos', () => {
    expect(checkTypedAnswer('tibia', ['Fibula']).verdict).toBe('wrong');
    expect(checkTypedAnswer('cot', ['Cor', 'Heart']).verdict).toBe('wrong'); // ≤ 4 letters: no typo allowed
    expect(checkTypedAnswer('', ['Cor']).verdict).toBe('wrong');
    expect(checkTypedAnswer('femur', ['Humerus']).verdict).toBe('wrong');
  });

  it('scales the tolerance with the length', () => {
    expect([4, 5, 9, 15].map(typoTolerance)).toEqual([0, 1, 2, 3]);
  });
});
