/**
 * Quiz session state (own zustand store, ARCHITECTURE.md §6). Pure state transitions; the side effects on
 * the atlas store (mode, highlights, isolate, camera) live in useQuizDirector.
 */
import { create } from 'zustand';
import type { Question, QuizScope } from './generate';

export type QuizPhase = 'setup' | 'running' | 'summary';

export type Verdict = 'correct' | 'typo' | 'wrong' | 'wrong-side' | 'skipped';

export interface QuizAnswer {
  verdict: Verdict;
  /** Locate: clicked structure; Identify: chosen option. */
  givenId?: string | null;
  /** Name it: what was typed. */
  givenText?: string;
  /** Name it: edit distance and tolerance, accepted spelling. */
  distance?: number;
  tolerance?: number;
  expected?: string;
}

export const isCorrect = (a: QuizAnswer | undefined) => a?.verdict === 'correct' || a?.verdict === 'typo';

export interface QuizSessionState {
  phase: QuizPhase;
  scope: QuizScope;
  questions: Question[];
  index: number;
  answers: Record<string, QuizAnswer>;
  /** "Practice weak structures" session. */
  weakMode: boolean;
  /** Structure ids the questions (and Identify distractors) were drawn from; reused by "retry mistakes". */
  poolIds: string[];
}

export interface QuizSessionActions {
  setScope(patch: Partial<QuizScope>): void;
  start(questions: Question[], opts?: { weakMode?: boolean; poolIds?: string[] }): void;
  answer(questionId: string, answer: QuizAnswer): void;
  next(): void;
  backToSetup(): void;
  reset(): void;
}

export const DEFAULT_SCOPE: QuizScope = {
  systems: [],
  regions: [],
  side: 'both',
  count: 10,
  types: ['locate', 'identify', 'name'],
};

export const useQuizStore = create<QuizSessionState & QuizSessionActions>()((set, get) => ({
  phase: 'setup',
  scope: DEFAULT_SCOPE,
  questions: [],
  index: 0,
  answers: {},
  weakMode: false,
  poolIds: [],

  setScope(patch) {
    set((s) => ({ scope: { ...s.scope, ...patch } }));
  },
  start(questions, opts) {
    if (questions.length === 0) return;
    set({
      phase: 'running',
      questions,
      index: 0,
      answers: {},
      weakMode: Boolean(opts?.weakMode),
      poolIds: opts?.poolIds ?? get().poolIds,
    });
  },
  answer(questionId, answer) {
    const { phase, answers } = get();
    if (phase !== 'running' || answers[questionId]) return; // one answer per question
    set({ answers: { ...answers, [questionId]: answer } });
  },
  next() {
    const { index, questions } = get();
    if (index + 1 >= questions.length) set({ phase: 'summary' });
    else set({ index: index + 1 });
  },
  backToSetup() {
    set({ phase: 'setup', questions: [], index: 0, answers: {}, weakMode: false, poolIds: [] });
  },
  reset() {
    set({
      phase: 'setup',
      scope: DEFAULT_SCOPE,
      questions: [],
      index: 0,
      answers: {},
      weakMode: false,
      poolIds: [],
    });
  },
}));

/** Score = number of correct answers (typos count as correct). */
export function scoreOf(s: Pick<QuizSessionState, 'answers'>): number {
  return Object.values(s.answers).filter(isCorrect).length;
}

/** Questions answered wrongly or skipped. */
export function mistakesOf(s: Pick<QuizSessionState, 'answers' | 'questions'>): Question[] {
  return s.questions.filter((q) => s.answers[q.id] && !isCorrect(s.answers[q.id]));
}
