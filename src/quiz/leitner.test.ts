import {
  BOX_COUNT,
  dueIds,
  isDue,
  isWeak,
  loadDeck,
  LEITNER_STORAGE_KEY,
  review,
  saveDeck,
  weakIds,
  type LeitnerDeck,
} from './leitner';

const DAY = 24 * 60 * 60 * 1000;

describe('Leitner boxes', () => {
  it('moves cards up on correct answers and back to box 1 on mistakes', () => {
    let deck: LeitnerDeck = {};
    deck = review(deck, 'femur-l', true, 0);
    expect(deck['femur-l']).toEqual({ b: 2, t: 0, n: 1, ok: 1 });
    deck = review(deck, 'femur-l', true, 1);
    expect(deck['femur-l']!.b).toBe(3);
    deck = review(deck, 'femur-l', false, 2);
    expect(deck['femur-l']).toEqual({ b: 1, t: 2, n: 3, ok: 2 });
    for (let i = 0; i < 10; i++) deck = review(deck, 'femur-l', true, 3 + i);
    expect(deck['femur-l']!.b).toBe(BOX_COUNT);
  });

  it('does not mutate the input deck', () => {
    const deck: LeitnerDeck = {};
    review(deck, 'x', true);
    expect(deck).toEqual({});
  });

  it('marks missed, not yet recovered cards as weak, weakest first', () => {
    let deck: LeitnerDeck = {};
    deck = review(deck, 'ok-first', true, 0); // box 2, no mistakes → not weak
    deck = review(deck, 'missed', false, 0); // box 1
    deck = review(deck, 'recovering', false, 0);
    deck = review(deck, 'recovering', true, 1); // box 2 with a mistake → weak
    deck = review(deck, 'recovered', false, 0);
    deck = review(deck, 'recovered', true, 1);
    deck = review(deck, 'recovered', true, 2); // box 3 → not weak
    expect(isWeak(deck['ok-first'])).toBe(false);
    expect(weakIds(deck)).toEqual(['missed', 'recovering']);
    expect(weakIds(deck, new Set(['recovering']))).toEqual(['recovering']);
  });

  it('computes due cards from box intervals', () => {
    const deck: LeitnerDeck = { a: { b: 1, t: 0, n: 1, ok: 0 }, b: { b: 3, t: 0, n: 2, ok: 2 } };
    expect(isDue(deck.a!, 0)).toBe(true);
    expect(isDue(deck.b!, 2 * DAY)).toBe(false);
    expect(isDue(deck.b!, 3 * DAY)).toBe(true);
    expect(dueIds(deck, DAY)).toEqual(['a']);
  });

  it('persists to storage and survives broken or blocked storage', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    const deck = review({}, 'heart', false, 5);
    expect(saveDeck(deck, storage)).toBe(true);
    expect(loadDeck(storage)).toEqual(deck);

    mem.set(LEITNER_STORAGE_KEY, '{not json');
    expect(loadDeck(storage)).toEqual({});
    mem.set(LEITNER_STORAGE_KEY, JSON.stringify({ good: { b: 9, t: 1, n: 1, ok: 1 }, bad: { b: 'x' } }));
    expect(loadDeck(storage)).toEqual({ good: { b: BOX_COUNT, t: 1, n: 1, ok: 1 } });

    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(loadDeck(throwing)).toEqual({});
    expect(saveDeck(deck, throwing)).toBe(false);
  });
});
