import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAtlasStore } from '@/state';
import { initMockStore, renderUi } from '../testUtils';
import { SearchBox } from './SearchBox';

describe('SearchBox', () => {
  beforeEach(() => initMockStore());

  it('shows results while typing with system chip and side, and opens one with the keyboard', async () => {
    renderUi(<SearchBox />);
    const input = screen.getByRole('combobox', { name: 'Search anatomical structures' });
    await userEvent.type(input, 'biceps');
    const options = await screen.findAllByRole('option');
    expect(options.slice(0, 2).map((o) => o.textContent)).toEqual([
      expect.stringContaining('Musculus biceps brachii'),
      expect.stringContaining('Musculus biceps brachii'),
    ]);
    expect(options[0]).toHaveTextContent('L');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]!.id);
    await userEvent.keyboard('{Enter}');

    // biceps lives in the hidden muscular system: it is loaded, shown, selected and focused
    await vi.waitFor(() => expect(useAtlasStore.getState().selectedId).toBe('biceps-brachii-r'));
    const s = useAtlasStore.getState();
    expect(s.layers.muscular?.visible).toBe(true);
    expect(s.systemLoad.muscular?.meta).toBe('loaded');
    expect(s.viewerQueue.at(-1)?.command).toMatchObject({ type: 'focus', ids: ['biceps-brachii-r'] });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes with Escape and reports no matches', async () => {
    renderUi(<SearchBox />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'zzzzqq');
    expect(await screen.findByText('No matching structures')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('displays names in the chosen name language', async () => {
    useAtlasStore.getState().setNameLang('en');
    renderUi(<SearchBox />);
    await userEvent.type(screen.getByRole('combobox'), 'hepar');
    const [first] = await screen.findAllByRole('option');
    expect(first).toHaveTextContent('Liver');
  });
});
