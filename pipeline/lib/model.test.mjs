// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildModel, toStructure } from './model.mjs';

const config = {
  systems: [
    {
      id: 'skeletal',
      collection: '1: Skeletal system',
      layerOrder: 0,
      defaultVisible: true,
      defaultOpacity: 1,
    },
    {
      id: 'insertions',
      collection: '2: Muscular insertions',
      layerOrder: 1,
      defaultVisible: false,
      defaultOpacity: 1,
    },
    {
      id: 'muscular',
      collection: '4: Muscular system',
      layerOrder: 7,
      defaultVisible: false,
      defaultOpacity: 1,
    },
    {
      id: 'visceral',
      collection: '8: Visceral systems',
      layerOrder: 3,
      defaultVisible: true,
      defaultOpacity: 1,
    },
    {
      id: 'regions',
      collection: '9: Regions of human body',
      layerOrder: 8,
      defaultVisible: false,
      defaultOpacity: 1,
    },
  ],
  regions: [
    { id: 'trunk', collections: ['Trunk'] },
    { id: 'abdomen', collections: ['Abdomen'], parentId: 'trunk' },
    { id: 'lower-limb', collections: ['Left lower limb', 'Right lower limb'], nameEn: 'Lower limb' },
  ],
};
const nc = {
  sources: {
    'cowley-kidney': {
      text: 'Kidney - by Lissie Cowley - CC-BY-NC 4.0',
      license: 'CC-BY-NC-4.0',
      licenseUrl: 'x',
      structures: ['Kidney'],
    },
  },
};
const overrides = {
  sideSwaps: [
    { source: ['Eyelashes.l', 'Eyelashes.r'], status: 'approved' },
    { source: ['Proposed.l', 'Proposed.r'], status: 'proposed' },
  ],
};

const S = (name, system, extra = {}) => ({
  name,
  system,
  kind: 'structure',
  type: 'MESH',
  color: '#aabbcc',
  regionCollections: [],
  ...extra,
});
const scene = {
  systems: config.systems.map((s) => ({ id: s.id, collection: s.collection })),
  objects: [
    {
      name: 'Bones of lower limb.g',
      system: 'skeletal',
      kind: 'group',
      type: 'FONT',
      parent: 'Skeletal system.g',
    },
    { name: 'Skeletal system.g', system: 'skeletal', kind: 'helper', type: 'MESH' },
    S('Femur.l', 'skeletal', { parent: 'Bones of lower limb.g', regionCollections: ['Left lower limb'] }),
    S('Femur.r', 'skeletal', { parent: 'Bones of lower limb.g', regionCollections: ['Right lower limb'] }),
    S('Eyelashes.l', 'regions'),
    S('Eyelashes.r', 'regions'),
    S('Proposed.l', 'regions'),
    S('Proposed.r', 'regions'),
    S('Liver', 'visceral', { regionCollections: ['Abdomen', 'Trunk'], parent: 'Femur.l' }),
    S('Left ventricle', 'visceral'),
    S('Kidney.l', 'visceral'),
    S('Gluteus maximus.l', 'muscular'),
    S('Gluteus maximus.ol', 'insertions', { parent: 'Femur.l' }),
    S('Gluteus maximus.e2r', 'insertions', { parent: 'Femur.r' }),
    S('Unknown muscle.el', 'insertions', { parent: 'Femur.l' }),
    {
      name: 'Femur.t',
      system: 'skeletal',
      kind: 'label',
      type: 'FONT',
      parent: 'Femur.r',
      anchor: [-0.1, 0.6, 0],
    },
    {
      name: 'Femur.s',
      system: 'skeletal',
      kind: 'label',
      type: 'FONT',
      parent: 'Femur.l',
      anchor: [0.1, 0.6, 0],
    },
    {
      name: 'Linea aspera.s',
      system: 'skeletal',
      kind: 'label',
      type: 'FONT',
      parent: 'Femur.l',
      anchor: [0.09, 0.6, 0.01],
    },
    {
      name: 'Linea aspera.t',
      system: 'skeletal',
      kind: 'label',
      type: 'FONT',
      parent: 'Femur.r',
      anchor: [-0.09, 0.6, 0.01],
    },
    {
      name: 'Apex of heart.t',
      system: 'visceral',
      kind: 'label',
      type: 'FONT',
      parent: 'Heart.g',
      anchor: [0.1, 1.2, 0.1],
    },
    { name: 'Broken.t', system: 'skeletal', kind: 'label', type: 'FONT', parent: 'Femur.l' },
  ],
};
const texts = {
  translations: {
    header: ['English', 'Latin', 'Français', 'Español', 'Portugues'],
    rows: [
      ['Femur', 'Os femoris', 'Fémur', 'Fémur', 'Fêmur'],
      ['Skeletal system', 'Systema skeletale', '', '', ''],
    ],
  },
  texts: {
    Femur: 'FEMUR\n\nThe femur.\n\nhttps://en.wikipedia.org/wiki/Femur',
    Liver: 'LIVER\n\nThe liver.',
    Abdomen: 'ABDOMEN\n\nThe abdomen.',
  },
};
const ta2 = [
  { id: '1360', en: 'Femur', la: 'Os femoris' },
  { id: '3023', en: 'Liver', la: 'Hepar' },
];

describe('buildModel', () => {
  const m = buildModel({ scene, texts, config, nc, overrides, ta2 });
  const byName = (n) => m.structByName.get(n);

  it('builds ids, sides and pairs from suffixes', () => {
    expect(byName('Femur.l')).toMatchObject({
      id: 'femur-l',
      side: 'left',
      sideSource: 'suffix',
      pairId: 'femur-r',
    });
    expect(byName('Femur.r')).toMatchObject({ id: 'femur-r', side: 'right', pairId: 'femur-l' });
    expect(byName('Left ventricle')).toMatchObject({
      id: 'left-ventricle',
      side: 'left',
      sideSource: 'name',
    });
    expect(byName('Liver').side).toBeUndefined();
  });

  it('applies only approved side swaps; ids and pairs follow the geometry', () => {
    expect(byName('Eyelashes.l')).toMatchObject({ id: 'eyelashes-r', side: 'right', pairId: 'eyelashes-l' });
    expect(byName('Eyelashes.r')).toMatchObject({ id: 'eyelashes-l', side: 'left', pairId: 'eyelashes-r' });
    expect(byName('Proposed.l')).toMatchObject({ id: 'proposed-l', side: 'left' });
    expect(m.report.sideSwaps).toHaveLength(2);
  });

  it('keeps parentId inside the system only', () => {
    expect(byName('Femur.l').parentId).toBe('g-bones-of-lower-limb');
    expect(byName('Liver').parentId).toBeUndefined();
    expect(m.groups.find((g) => g.id === 'g-bones-of-lower-limb').parentId).toBeUndefined();
  });

  it('links insertion patches to muscle and bone and inherits regions', () => {
    expect(byName('Gluteus maximus.ol')).toMatchObject({
      id: 'gluteus-maximus-origin-l',
      kind: 'origin',
      muscleId: 'gluteus-maximus-l',
      boneId: 'femur-l',
      regions: ['lower-limb'],
    });
    expect(byName('Gluteus maximus.e2r')).toMatchObject({
      id: 'gluteus-maximus-insertion-2-r',
      boneId: 'femur-r',
    });
    expect(byName('Gluteus maximus.e2r').muscleId).toBeUndefined(); // no right muscle in the scene
    expect(m.report.insertionsWithoutMuscle).toContain('Unknown muscle.el');
  });

  it('maps regions, names, TA2 and definitions', () => {
    expect(byName('Liver').regions).toEqual(['trunk', 'abdomen']);
    expect(byName('Femur.l').names).toEqual({
      en: 'Femur',
      la: 'Os femoris',
      fr: 'Fémur',
      es: 'Fémur',
      pt: 'Fêmur',
    });
    expect(byName('Femur.l').taId).toBe('1360');
    expect(byName('Liver').names.la).toBe('Hepar'); // filled from TA2 (no Translations row)
    expect(byName('Femur.l').definitionKey).toBe('femur');
    expect(m.definitions.skeletal.femur).toMatchObject({
      source: 'Wikipedia',
      license: 'CC-BY-SA-3.0',
      reviewed: false,
    });
    expect(m.definitions.visceral.liver).toMatchObject({ source: 'Z-Anatomy', license: 'CC-BY-SA-4.0' });
    expect(m.report.definitionsUnattached.map((d) => d.name)).toContain('Abdomen');
  });

  it('turns own labels into labelAnchors and others into landmarks', () => {
    expect(byName('Femur.r').labelAnchor).toEqual([-0.1, 0.6, 0]);
    expect(byName('Femur.l').labelAnchor).toEqual([0.1, 0.6, 0]);
    const lms = m.landmarks.map((l) => [l.id, l.structureId, l.side]);
    expect(lms).toContainEqual(['lm-linea-aspera-l', 'femur-l', 'left']);
    expect(lms).toContainEqual(['lm-linea-aspera-r', 'femur-r', 'right']);
    expect(m.report.unattachedLabels.map((u) => u.label)).toContain('Apex of heart.t');
    expect(m.report.labelsWithoutAnchor).toContain('Broken.t');
  });

  it('flags non-commercial structures', () => {
    expect(byName('Kidney.l')).toMatchObject({
      nonCommercial: true,
      attribution: 'cowley-kidney',
      license: 'CC-BY-NC-4.0',
    });
    expect(byName('Femur.l')).toMatchObject({ attribution: 'z-anatomy', license: 'CC-BY-SA-4.0' });
    expect(byName('Femur.l').nonCommercial).toBeUndefined();
  });

  it('produces unique ids and contract-shaped structures', () => {
    const ids = [...m.structures, ...m.groups, ...m.landmarks].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    const s = toStructure(byName('Femur.l'), {
      chunk: 'skeletal.glb',
      centroid: [1, 2, 3],
      bbox: { min: [0, 0, 0], max: [1, 1, 1] },
      triangles: 10,
    });
    expect(s).toMatchObject({ id: 'femur-l', nodeName: 'femur-l', chunk: 'skeletal.glb', triangles: 10 });
    expect(Object.keys(s)).not.toContain('sourceName');
  });

  it('is deterministic', () => {
    const again = buildModel({
      scene: { ...scene, objects: [...scene.objects].reverse() },
      texts,
      config,
      nc,
      overrides,
      ta2,
    });
    const ids = (mm) => mm.structures.map((s) => [s.sourceName, s.id]).sort();
    expect(ids(again)).toEqual(ids(m));
  });
});
