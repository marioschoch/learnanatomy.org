/**
 * Simple spaced repetition (Leitner boxes), one card per structure id, stored in localStorage.
 *
 *  - Boxes 1…5. A wrong answer moves the card to box 1; a correct one moves it up one box
 *    (a card answered correctly the first time starts in box 2).
 *  - A card is due when the box interval has passed since the last review.
 *  - "Weak" = box ≤ 2 and at least one mistake so far: missed recently and not yet recovered.
 *
 * All storage access is wrapped in try/catch (private mode, quota, blocked storage).
 */
export const BOX_COUNT = 5;
/** Days until a card in box n (index n-1) is due again. */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 21] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'oaa.quiz.leitner.v1';

export interface LeitnerCard {
  /** Box 1…5 */
  b: number;
  /** Last review (ms since epoch) */
  t: number;
  /** Times asked */
  n: number;
  /** Times answered correctly */
  ok: number;
}

export type LeitnerDeck = Record<string, LeitnerCard>;

const clampBox = (b: number) => Math.min(BOX_COUNT, Math.max(1, Math.round(b)));

/** Returns a new deck with the review applied (pure). */
export function review(deck: LeitnerDeck, id: string, correct: boolean, now = Date.now()): LeitnerDeck {
  const prev = deck[id];
  const b = correct ? (prev ? clampBox(prev.b + 1) : 2) : 1;
  return {
    ...deck,
    [id]: { b, t: now, n: (prev?.n ?? 0) + 1, ok: (prev?.ok ?? 0) + (correct ? 1 : 0) },
  };
}

export function isDue(card: LeitnerCard, now = Date.now()): boolean {
  const days = BOX_INTERVAL_DAYS[clampBox(card.b) - 1] ?? 0;
  return now - card.t >= days * DAY_MS;
}

export function isWeak(card: LeitnerCard | undefined): boolean {
  return Boolean(card && card.b <= 2 && card.ok < card.n);
}

/** Weak card ids, weakest first (lowest box, then most mistakes, then longest ago). */
export function weakIds(deck: LeitnerDeck, candidates?: ReadonlySet<string>): string[] {
  return Object.entries(deck)
    .filter(([id, c]) => isWeak(c) && (!candidates || candidates.has(id)))
    .sort(([, a], [, b]) => a.b - b.b || b.n - b.ok - (a.n - a.ok) || a.t - b.t)
    .map(([id]) => id);
}

/** Due card ids (any box), most overdue box first. */
export function dueIds(deck: LeitnerDeck, now = Date.now()): string[] {
  return Object.entries(deck)
    .filter(([, c]) => isDue(c, now))
    .sort(([, a], [, b]) => a.b - b.b || a.t - b.t)
    .map(([id]) => id);
}

function isCard(v: unknown): v is LeitnerCard {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return ['b', 't', 'n', 'ok'].every((k) => typeof c[k] === 'number' && Number.isFinite(c[k]));
}

export function loadDeck(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): LeitnerDeck {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const deck: LeitnerDeck = {};
    for (const [id, card] of Object.entries(parsed as Record<string, unknown>)) {
      if (isCard(card)) deck[id] = { ...card, b: clampBox(card.b) };
    }
    return deck;
  } catch {
    return {};
  }
}

export function saveDeck(
  deck: LeitnerDeck,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(deck));
    return true;
  } catch {
    return false;
  }
}

export const LEITNER_STORAGE_KEY = STORAGE_KEY;
