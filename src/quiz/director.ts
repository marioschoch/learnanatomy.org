/**
 * Side effects of the quiz on the atlas store — only through its public actions (ARCHITECTURE.md §6):
 * setMode, layer actions, setIsolate/exitIsolate, setHighlights, setLabelsVisible, requestViewer.
 *
 *  enterQuizMode   snapshot the shareable view, show the scope layers, hide labels/selection, mode 'quiz'
 *  presentQuestion Locate: overview camera, nothing highlighted · Identify / Name it: isolate with context +
 *                  'quiz-target' highlight + focus
 *  presentFeedback highlight the correct structure (and a wrong pick)
 *  exitQuizMode    clear highlights, mode 'explore', restore the snapshot exactly
 */
import type { HighlightKind, ShareableState } from '@/contract';
import { useAtlasStore } from '@/state';
import type { Question } from './generate';
import type { QuizAnswer } from './quizStore';

let snapshot: { view: ShareableState; labelsVisible: boolean } | null = null;

const atlas = () => useAtlasStore.getState();
const animate = () => !atlas().reducedMotion;

export function enterQuizMode(systems: string[]): void {
  const s = atlas();
  if (!snapshot) snapshot = { view: s.getShareableState(), labelsVisible: s.labelsVisible };
  s.select(null);
  s.setHovered(null);
  if (s.isolate.mode !== 'none') s.exitIsolate();
  s.setHighlights({});
  s.setLabelsVisible(false);
  s.setXray(false);
  s.resetClipping();
  s.setExplode(0);
  s.showAllNodes();
  if (systems.length)
    s.applyLayerPreset(Object.fromEntries(systems.map((id) => [id, { visible: true, opacity: 1 }])));
  s.setMode('quiz');
}

export function exitQuizMode(): void {
  const s = atlas();
  s.setHighlights({});
  if (s.isolate.mode !== 'none') s.exitIsolate();
  if (s.mode === 'quiz') s.setMode('explore');
  if (snapshot) {
    const { view, labelsVisible } = snapshot;
    snapshot = null;
    s.setLabelsVisible(labelsVisible);
    void s.applyShareableState(view);
  }
}

export function isInQuizMode(): boolean {
  return snapshot !== null;
}

export function presentQuestion(q: Question): void {
  const s = atlas();
  if (q.type === 'locate') {
    s.setHighlights({});
    if (s.isolate.mode !== 'none') s.exitIsolate();
    void s.requestViewer({ type: 'resetCamera', animate: animate() });
    return;
  }
  s.setIsolate('context', [q.targetId]);
  s.setHighlights({ [q.targetId]: 'quiz-target' });
  void s.requestViewer({ type: 'focus', ids: [q.targetId], animate: animate() });
}

export function presentFeedback(q: Question, answer: QuizAnswer): void {
  const s = atlas();
  const ok = answer.verdict === 'correct' || answer.verdict === 'typo';
  const highlights: Record<string, HighlightKind> = {};
  const given = answer.givenId && answer.givenId !== q.targetId ? answer.givenId : null;
  if (q.type === 'name') highlights[q.targetId] = ok ? 'quiz-correct' : 'quiz-wrong';
  else {
    highlights[q.targetId] = 'quiz-correct';
    // A correct pick on a same-named structure (Locate) is highlighted as correct, too.
    if (given) highlights[given] = ok ? 'quiz-correct' : 'quiz-wrong';
  }
  if (q.type === 'identify' && given) s.setIsolate('context', [q.targetId, given]);
  s.setHighlights(highlights);
  if (q.type === 'locate') void s.requestViewer({ type: 'focus', ids: [q.targetId], animate: animate() });
}
