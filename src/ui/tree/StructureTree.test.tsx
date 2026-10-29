import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAtlasStore } from '@/state';
import { initMockStore, renderUi } from '../testUtils';
import { StructureTree } from './StructureTree';

const item = (name: string | RegExp) =>
  screen.getAllByRole('treeitem').find((el) => el.textContent?.match(name));

describe('StructureTree', () => {
  beforeEach(() => initMockStore());

  it('shows the systems and expands to groups and structures', async () => {
    renderUi(<StructureTree />);
    expect(screen.getAllByRole('treeitem').map((el) => el.textContent)).toEqual([
      'Skeletal system',
      'Visceral systems',
      'Muscular system',
    ]);
    await userEvent.click(item('Skeletal system')!);
    expect(item('Skeleton appendiculare')).toBeDefined();
    expect(item('Skeleton axiale')).toHaveAttribute('aria-level', '2');
  });

  it('expands, scrolls to and marks the selection', async () => {
    renderUi(<StructureTree />);
    act(() => useAtlasStore.getState().select('femur-r'));
    const row = await vi.waitFor(() => {
      const r = screen.getAllByRole('treeitem').find((el) => el.getAttribute('aria-selected') === 'true');
      expect(r).toBeDefined();
      return r!;
    });
    expect(row.textContent).toContain('Femur');
    expect(row.textContent).toContain('R');
    expect(row).toHaveAttribute('aria-level', '3');
  });

  it('toggles visibility of groups and structures with the checkbox (mixed state on parents)', async () => {
    renderUi(<StructureTree />);
    await userEvent.click(item('Skeletal system')!);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Skeleton axiale' }));
    expect(useAtlasStore.getState().hiddenIds['g-axial-skeleton']).toBe(true);
    const sys = screen.getByRole('checkbox', { name: 'Show Skeletal system' }) as HTMLInputElement;
    expect(sys.indeterminate).toBe(true);
    await userEvent.click(sys);
    expect(useAtlasStore.getState().layers.skeletal?.visible).toBe(false);
  });

  it('selects and focuses on click', async () => {
    renderUi(<StructureTree />);
    await userEvent.click(item('Visceral systems')!);
    await userEvent.click(item('Thoracic organs')!.querySelector('button')!);
    await userEvent.click(item(/^Cor$/)!);
    await vi.waitFor(() => expect(useAtlasStore.getState().selectedId).toBe('heart'));
    expect(useAtlasStore.getState().viewerQueue.at(-1)?.command).toMatchObject({
      type: 'focus',
      ids: ['heart'],
    });
  });

  it('filters by any name language', async () => {
    renderUi(<StructureTree />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Filter the structure tree' }), 'liver');
    await vi.waitFor(() => expect(item('Hepar')).toBeDefined());
    expect(item('Femur')).toBeUndefined();
    expect(screen.getByText(/1 system is not loaded/)).toBeInTheDocument();
  });

  it('supports keyboard navigation (arrows, Enter, Space)', async () => {
    renderUi(<StructureTree />);
    const tree = screen.getByRole('tree');
    tree.focus();
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(tree.getAttribute('aria-activedescendant')).toMatch(/skeletal/);
    fireEvent.keyDown(tree, { key: 'ArrowRight' });
    expect(item('Skeleton axiale')).toBeDefined();
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    fireEvent.keyDown(tree, { key: ' ' });
    expect(useAtlasStore.getState().hiddenIds['g-axial-skeleton']).toBe(true);
    fireEvent.keyDown(tree, { key: 'Enter' });
    await vi.waitFor(() => expect(useAtlasStore.getState().selectedId).toBe('g-axial-skeleton'));
  });

  it('virtualizes thousands of rows', async () => {
    renderUi(<StructureTree />);
    act(() => {
      const s = useAtlasStore.getState();
      const structures = { ...s.structures };
      const kids: string[] = [];
      const base = s.structures.sternum!;
      for (let i = 0; i < 4000; i++) {
        const id = `synthetic-${i}`;
        structures[id] = { ...base, id, nodeName: id, names: { en: `Synthetic ${i}` } };
        kids.push(id);
      }
      useAtlasStore.setState({
        structures,
        childrenOf: { ...s.childrenOf, '@skeletal': [...(s.childrenOf['@skeletal'] ?? []), ...kids] },
      });
    });
    await userEvent.click(item('Skeletal system')!);
    const rendered = screen.getAllByRole('treeitem').length;
    expect(rendered).toBeGreaterThan(10);
    expect(rendered).toBeLessThan(80);
  });
});
