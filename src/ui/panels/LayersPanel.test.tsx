import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAtlasStore } from '@/state';
import { initMockStore, renderUi } from '../testUtils';
import { LayersPanel } from './LayersPanel';

describe('LayersPanel', () => {
  beforeEach(() => initMockStore());

  it('lists every system with a colour chip, a visibility switch and an opacity slider', () => {
    renderUi(<LayersPanel />);
    for (const name of ['Skeletal system', 'Visceral systems', 'Muscular system']) {
      expect(screen.getByRole('switch', { name: `Show ${name}` })).toBeInTheDocument();
      expect(screen.getByRole('slider', { name: `Opacity of ${name}` })).toBeInTheDocument();
    }
    expect(screen.getByRole('switch', { name: 'Show Skeletal system' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show Muscular system' })).not.toBeChecked();
  });

  it('toggles a layer and loads its metadata', async () => {
    renderUi(<LayersPanel />);
    await userEvent.click(screen.getByRole('switch', { name: 'Show Muscular system' }));
    expect(useAtlasStore.getState().layers.muscular?.visible).toBe(true);
    await vi.waitFor(() => expect(useAtlasStore.getState().systemLoad.muscular?.meta).toBe('loaded'));
  });

  it('shows a loading indicator with progress while geometry loads', () => {
    renderUi(<LayersPanel />);
    act(() => useAtlasStore.getState().setGeometryStatus('skeletal', 'loading', 0.42));
    const row = document.querySelector('[data-system="skeletal"]') as HTMLElement;
    expect(within(row).getByRole('status', { name: 'Loading 42 %' })).toBeInTheDocument();
    expect(row).toHaveAttribute('aria-busy', 'true');
  });

  it('applies presets and reset', async () => {
    renderUi(<LayersPanel />);
    await userEvent.click(screen.getByRole('button', { name: 'Bones + Muscles' }));
    let s = useAtlasStore.getState();
    expect(s.layers.skeletal?.visible && s.layers.muscular?.visible).toBe(true);
    expect(s.layers.visceral?.visible).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Full X-ray' }));
    s = useAtlasStore.getState();
    expect(Object.values(s.layers).every((l) => l.visible)).toBe(true);
    expect(s.xray).toBe(true);
    expect(screen.getByText(/X-ray is on/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    s = useAtlasStore.getState();
    expect(s.xray).toBe(false);
    expect(s.layers.muscular?.visible).toBe(false);
    expect(s.layers.skeletal?.visible).toBe(true);
  });

  it('disables presets whose system is not in the data', () => {
    renderUi(<LayersPanel />);
    expect(screen.getByRole('button', { name: 'Circulation' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Nervous system' })).toBeDisabled();
  });

  it('offers "show all" when structures are hidden', async () => {
    renderUi(<LayersPanel />);
    act(() => useAtlasStore.getState().setNodeHidden('sternum', true));
    expect(screen.getByText('1 structure hidden')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(useAtlasStore.getState().hiddenIds).toEqual({});
  });
});
