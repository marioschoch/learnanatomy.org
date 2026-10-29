import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAtlasStore } from '@/state';
import { initMockStore, renderUi } from '@/ui/testUtils';
import { useQuizLauncher } from './launcher';
import { LEITNER_STORAGE_KEY } from './leitner';
import QuizPanel from './QuizPanel';
import { useQuizStore } from './quizStore';

describe('QuizPanel', () => {
  beforeEach(async () => {
    await initMockStore();
    useQuizStore.getState().reset();
  });

  it('uses the launcher scope, starts a quiz in quiz mode and hides labels/selection', async () => {
    act(() => {
      useAtlasStore.getState().select('heart');
      useQuizLauncher.getState().openQuiz({ systems: ['visceral'], regions: ['thorax'] });
    });
    renderUi(<QuizPanel />);
    expect(await screen.findByText('3 structures in scope')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('quiz-start'));
    const s = useAtlasStore.getState();
    expect(s.mode).toBe('quiz');
    expect(s.labelsVisible).toBe(false);
    expect(s.selectedId).toBeNull();
    expect(screen.getByText('Question 1 of 3 · Score: 0 / 0')).toBeInTheDocument();
  });

  it('evaluates a Locate pick from the 3D view, records Leitner progress and restores the view at the end', async () => {
    act(() => useQuizLauncher.getState().openQuiz({ systems: ['visceral'], regions: ['thorax'] }));
    useQuizStore.getState().setScope({ types: ['locate'], count: 5 });
    renderUi(<QuizPanel />);
    await screen.findByText('3 structures in scope');
    await userEvent.click(screen.getByTestId('quiz-start'));

    for (let i = 0; i < 3; i++) {
      const q = useQuizStore.getState().questions[useQuizStore.getState().index]!;
      // wrong pick for the first question, right pick afterwards
      act(() => useAtlasStore.getState().pickStructure(i === 0 ? 'femur-l' : q.targetId));
      expect(screen.getByTestId('quiz-feedback')).toHaveAttribute(
        'data-verdict',
        i === 0 ? 'wrong' : 'correct',
      );
      if (i === 0) expect(useAtlasStore.getState().highlights[q.targetId]).toBe('quiz-correct');
      await userEvent.click(screen.getByTestId('quiz-next'));
    }
    expect(screen.getByTestId('quiz-summary')).toHaveTextContent('2 of 3 correct');
    expect(useAtlasStore.getState().mode).toBe('explore');
    expect(useAtlasStore.getState().labelsVisible).toBe(true);
    const deck = JSON.parse(localStorage.getItem(LEITNER_STORAGE_KEY)!);
    expect(Object.keys(deck)).toHaveLength(3);
    expect(Object.values(deck).filter((c) => (c as { b: number }).b === 1)).toHaveLength(1);

    await userEvent.click(screen.getByTestId('quiz-retry'));
    expect(useQuizStore.getState().questions).toHaveLength(1);
    expect(useAtlasStore.getState().mode).toBe('quiz');
  });

  it('accepts typed names with a typo and shows the tolerance', async () => {
    act(() => useQuizLauncher.getState().openQuiz({ systems: ['visceral'], regions: ['abdomen'] }));
    useQuizStore.getState().setScope({ types: ['name'], count: 5 });
    renderUi(<QuizPanel />);
    await screen.findByText(/structures in scope/);
    await userEvent.click(screen.getByTestId('quiz-start'));
    const q = useQuizStore.getState().questions[0]!;
    const target = useAtlasStore.getState().structures[q.targetId]!;
    expect(useAtlasStore.getState().isolate).toMatchObject({ mode: 'context', ids: [q.targetId] });
    const typo = `${target.names.en}x`;
    await userEvent.type(screen.getByRole('textbox', { name: /Name the highlighted structure/ }), typo);
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    const fb = screen.getByTestId('quiz-feedback');
    expect(fb).toHaveAttribute('data-verdict', target.names.en.length > 4 ? 'typo' : 'wrong');
    if (target.names.en.length > 4) expect(fb).toHaveTextContent('Accepted with 1 wrong letter.');
  });
});
