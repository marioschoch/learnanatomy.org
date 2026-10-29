import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAtlasStore } from '@/state';
import { useQuizLauncher } from '@/quiz/launcher';
import { initMockStore, renderUi } from '../testUtils';
import { InfoPanel } from './InfoPanel';

async function selectNode(id: string) {
  await act(async () => {
    useAtlasStore.getState().select(id);
    await useAtlasStore.getState().ensureNodeMeta(id);
  });
}

describe('InfoPanel', () => {
  beforeEach(() => initMockStore());

  it('renders nothing without a selection', () => {
    const { container } = renderUi(<InfoPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Latin bold, English, system, region, side and the counterpart link', async () => {
    renderUi(<InfoPanel />);
    await selectNode('biceps-brachii-l');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Musculus biceps brachii');
    expect(screen.getByText('Biceps brachii')).toBeInTheDocument();
    expect(screen.getByText('Muscular system')).toBeInTheDocument();
    expect(screen.getByText('Upper limb')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /right counterpart/ }));
    await vi.waitFor(() => expect(useAtlasStore.getState().selectedId).toBe('biceps-brachii-r'));
  });

  it('loads the definition and marks it unreviewed with source and licence', async () => {
    renderUi(<InfoPanel />);
    await selectNode('femur-l');
    expect(await screen.findByText(/Placeholder definition for "Femur"/)).toBeInTheDocument();
    expect(screen.getByText('Unreviewed')).toBeInTheDocument();
    expect(screen.getByText(/Source:/)).toBeInTheDocument();
  });

  it('shows the non-commercial licence note', async () => {
    renderUi(<InfoPanel />);
    await selectNode('kidney-l');
    expect(screen.getByText('Non-commercial licence.')).toBeInTheDocument();
  });

  it('runs the actions through the store', async () => {
    renderUi(<InfoPanel />);
    await selectNode('heart');
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(useAtlasStore.getState().hiddenIds.heart).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Pin label' }));
    expect(useAtlasStore.getState().pinnedIds).toEqual(['heart']);
    await userEvent.click(screen.getByRole('button', { name: 'Isolate with context' }));
    expect(useAtlasStore.getState().isolate).toMatchObject({ mode: 'context', ids: ['heart'] });
    expect(useAtlasStore.getState().viewerQueue.some((c) => c.command.type === 'focus')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Exit isolate' }));
    expect(useAtlasStore.getState().isolate.mode).toBe('none');
    await userEvent.click(screen.getByRole('button', { name: 'Quiz me on this region' }));
    expect(useQuizLauncher.getState()).toMatchObject({
      open: true,
      initialScope: { systems: ['visceral'], regions: ['thorax'] },
    });
  });

  it('describes groups and landmarks', async () => {
    renderUi(<InfoPanel />);
    await selectNode('g-appendicular-skeleton');
    expect(screen.getByText('Group of 8 structures')).toBeInTheDocument();
    await selectNode('lm-greater-trochanter-r');
    expect(screen.getByText('Landmark on')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeDisabled();
  });

  it('uses German UI labels but never translates anatomical names', async () => {
    await initMockStore('de');
    renderUi(<InfoPanel />);
    await selectNode('liver');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Hepar');
    expect(screen.getByText('Liver')).toBeInTheDocument();
    expect(screen.getByText('Eingeweidesysteme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ausblenden' })).toBeInTheDocument();
  });
});
