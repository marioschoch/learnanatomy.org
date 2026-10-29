import { systemRootKey } from '@/contract';
import type { GroupNode, Structure, SystemInfo } from '@/contract';
import { buildTreeRows, expansionPathFor, filterTree, type TreeInput } from './treeModel';

function structure(id: string, system: string, parentId?: string, extra: Partial<Structure> = {}): Structure {
  return {
    id,
    kind: 'structure',
    nodeName: id,
    chunk: 'c',
    system,
    regions: [],
    names: { en: id.replace(/-/g, ' ') },
    color: '#fff',
    centroid: [0, 0, 0],
    bbox: { min: [0, 0, 0], max: [1, 1, 1] },
    triangles: 0,
    attribution: 'x',
    license: 'x',
    ...(parentId ? { parentId } : {}),
    ...extra,
  };
}

function sys(id: string, layerOrder = 0): SystemInfo {
  return {
    id,
    names: { en: `${id} system` },
    color: '#000',
    layerOrder,
    defaultVisible: true,
    defaultOpacity: 1,
    chunks: [],
    structuresFile: '',
    structureCount: 0,
    triangleCount: 0,
  };
}

/** Build a TreeInput the same way the store builds childrenOf. */
function makeInput(systems: SystemInfo[], groups: GroupNode[], structures: Structure[]): TreeInput {
  const childrenOf: Record<string, string[]> = {};
  const push = (p: string, c: string) => (childrenOf[p] ??= []).push(c);
  for (const g of groups) push(g.parentId ?? systemRootKey(g.system), g.id);
  for (const s of structures) push(s.parentId ?? systemRootKey(s.system), s.id);
  return {
    systems,
    childrenOf,
    structures: Object.fromEntries(structures.map((s) => [s.id, s])),
    groups: Object.fromEntries(groups.map((g) => [g.id, g])),
    layers: Object.fromEntries(systems.map((s) => [s.id, { visible: true, opacity: 1 }])),
    hiddenIds: {},
    systemLoad: Object.fromEntries(
      systems.map((s) => [s.id, { meta: 'loaded' as const, geometry: 'idle' as const, progress: 0 }]),
    ),
    nameLang: 'la',
    systemLabel: (s) => s.names.en,
  };
}

const small = () =>
  makeInput(
    [sys('skeletal'), sys('muscular', 7)],
    [
      { id: 'g-limb', system: 'skeletal', names: { en: 'Bones of limb', la: 'Ossa membri' } },
      { id: 'g-leg', system: 'skeletal', names: { en: 'Leg bones' }, parentId: 'g-limb' },
    ],
    [
      structure('femur-l', 'skeletal', 'g-leg', { side: 'left', names: { en: 'Femur', la: 'Femur' } }),
      structure('femur-r', 'skeletal', 'g-leg', { side: 'right', names: { en: 'Femur', la: 'Femur' } }),
      structure('sternum', 'skeletal'),
      structure('biceps', 'muscular'),
    ],
  );

describe('tree model', () => {
  it('shows only system rows when nothing is expanded', () => {
    const rows = buildTreeRows(small(), new Set());
    expect(rows.map((r) => r.key)).toEqual(['@skeletal', '@muscular']);
    expect(rows[0]!.hasChildren).toBe(true);
  });

  it('descends into expanded nodes with depth and Latin labels', () => {
    const rows = buildTreeRows(small(), new Set(['@skeletal', 'g-limb', 'g-leg']));
    expect(rows.map((r) => [r.key, r.depth])).toEqual([
      ['@skeletal', 0],
      ['g-limb', 1],
      ['g-leg', 2],
      ['femur-l', 3],
      ['femur-r', 3],
      ['sternum', 1],
      ['@muscular', 0],
    ]);
    expect(rows[1]!.label).toBe('Ossa membri');
    expect(rows[3]!.side).toBe('left');
  });

  it('marks hidden nodes, mixed ancestors and hidden-by-parent descendants', () => {
    const input = small();
    input.hiddenIds = { 'femur-l': true };
    let rows = buildTreeRows(input, new Set(['@skeletal', 'g-limb', 'g-leg']));
    const by = (k: string) => rows.find((r) => r.key === k)!;
    expect(by('femur-l').checked).toBe(false);
    expect(by('g-leg').checked).toBe('mixed');
    expect(by('g-limb').checked).toBe('mixed');
    expect(by('@skeletal').checked).toBe('mixed');
    expect(by('femur-r').checked).toBe(true);

    input.hiddenIds = { 'g-limb': true };
    rows = buildTreeRows(input, new Set(['@skeletal', 'g-limb', 'g-leg']));
    expect(by('g-limb').checked).toBe(false);
    expect(by('femur-r').hiddenByParent).toBe(true);
    expect(by('sternum').hiddenByParent).toBe(false);

    input.hiddenIds = {};
    input.layers.skeletal = { visible: false, opacity: 1 };
    rows = buildTreeRows(input, new Set(['@skeletal']));
    expect(by('@skeletal').checked).toBe(false);
    expect(by('g-limb').hiddenByParent).toBe(true);
  });

  it('filters by any name (diacritic-insensitive) and expands matching branches', () => {
    const rows = buildTreeRows(small(), new Set(), 'FÉMUR');
    expect(rows.map((r) => r.key)).toEqual(['@skeletal', 'g-limb', 'g-leg', 'femur-l', 'femur-r']);
    expect(rows.filter((r) => r.match).map((r) => r.key)).toEqual(['femur-l', 'femur-r']);
    expect(buildTreeRows(small(), new Set(), 'ossa').map((r) => r.key)).toEqual(['@skeletal', 'g-limb']);
  });

  it('reports unloaded systems while filtering and keeps them as rows', () => {
    const input = small();
    input.systemLoad.muscular = { meta: 'idle', geometry: 'idle', progress: 0 };
    expect(filterTree(input, 'x').unloadedSystems).toEqual(['muscular']);
    const rows = buildTreeRows(input, new Set(), 'femur');
    expect(rows.at(-1)!.key).toBe('@muscular');
    expect(rows.at(-1)!.loadStatus).toBe('idle');
  });

  it('computes the expansion path of a nested node', () => {
    expect(expansionPathFor(small(), 'femur-r')).toEqual(['@skeletal', 'g-limb', 'g-leg']);
    expect(expansionPathFor(small(), 'sternum')).toEqual(['@skeletal']);
    expect(expansionPathFor(small(), 'unknown')).toEqual([]);
  });

  it('handles ~4 000 structures and 500 groups quickly', () => {
    const systems = [sys('skeletal'), sys('muscular', 7), sys('nervous', 6)];
    const groups: GroupNode[] = [];
    const structures: Structure[] = [];
    for (const s of systems) {
      for (let g = 0; g < 170; g++) {
        const parent = g % 10 === 0 ? undefined : `g-${s.id}-${g - (g % 10)}`;
        groups.push({
          id: `g-${s.id}-${g}`,
          system: s.id,
          names: { en: `Group ${g} of ${s.id}` },
          ...(parent ? { parentId: parent } : {}),
        });
      }
      for (let i = 0; i < 1350; i++)
        structures.push(
          structure(`${s.id}-${i}`, s.id, `g-${s.id}-${i % 170}`, {
            names: { en: `Structure ${i} ${s.id}` },
          }),
        );
    }
    const input = makeInput(systems, groups, structures);
    const all = new Set<string>([...systems.map((s) => systemRootKey(s.id)), ...groups.map((g) => g.id)]);
    const t0 = performance.now();
    const rows = buildTreeRows(input, all);
    const filtered = buildTreeRows(input, new Set(), 'structure 12');
    const dt = performance.now() - t0;
    expect(rows.length).toBe(3 + groups.length + structures.length);
    expect(filtered.some((r) => r.key === 'nervous-1299')).toBe(true);
    expect(dt).toBeLessThan(300);
  });
});
