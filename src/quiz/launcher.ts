/**
 * Tiny store that opens/closes the quiz panel. Lives in the main bundle; the quiz itself (QuizPanel,
 * generation, Leitner) is code-split and loaded on first open.
 */
import { create } from 'zustand';

export interface QuizLaunchScope {
  systems?: string[];
  regions?: string[];
}

interface QuizLauncherState {
  open: boolean;
  /** Increments on every openQuiz() so the panel can re-read the initial scope. */
  seq: number;
  initialScope: QuizLaunchScope | null;
  openQuiz(scope?: QuizLaunchScope): void;
  closeQuiz(): void;
}

export const useQuizLauncher = create<QuizLauncherState>()((set) => ({
  open: false,
  seq: 0,
  initialScope: null,
  openQuiz(scope) {
    set((s) => ({ open: true, seq: s.seq + 1, initialScope: scope ?? null }));
  },
  closeQuiz() {
    set({ open: false, initialScope: null });
  },
}));
