/**
 * Mock dataset: 3 systems, 32 structures made of primitives, arranged roughly like a 1.7 m body in the
 * normalized coordinate system (metres, +Y up, +Z anterior, +X = patient's LEFT).
 *
 * Development and test data only. Names are standard terms; definitions are placeholders, not content.
 * Sides are deliberately correct (liver on the patient's right = −X; heart/stomach/spleen on the left = +X)
 * so that orientation tests can run against mocks too.
 */
import type {
  BBox,
  DefinitionsFile,
  GroupNode,
  Landmark,
  Manifest,
  Names,
  SearchEntry,
  Side,
  Structure,
  SystemId,
  SystemStructuresFile,
  Vec3,
} from '@/contract';

export type MockShape =
  | { kind: 'box'; size: Vec3 }
  | { kind: 'sphere'; radius: number; scale?: Vec3 }
  | { kind: 'capsule'; radius: number; length: number; axis?: 'x' | 'y' | 'z' };

export interface MockStructureSpec {
  id: string;
  system: SystemId;
  names: Names;
  side?: Side;
  parentId?: string;
  regions: string[];
  center: Vec3;
  shape: MockShape;
  color: string;
  nonCommercial?: boolean;
  definition?: boolean;
  /** Muscles: ids of the bones they attach to, without the side suffix (it follows the muscle's side). */
  bones?: string[];
}

const BONE = '#e6dccb';
const MUSCLE = '#b4533f';

/** Mirror helper: spec on the patient's left (+X) and right (−X). */
function pair(
  base: Omit<MockStructureSpec, 'id' | 'side' | 'center'> & { id: string; center: Vec3 },
): MockStructureSpec[] {
  const [x, y, z] = base.center;
  return [
    { ...base, id: `${base.id}-l`, side: 'left', center: [Math.abs(x), y, z] },
    { ...base, id: `${base.id}-r`, side: 'right', center: [-Math.abs(x), y, z] },
  ];
}

export const MOCK_STRUCTURES: MockStructureSpec[] = [
  // ------------------------------------------------------------------ skeletal (12)
  {
    id: 'cranium',
    system: 'skeletal',
    names: { en: 'Cranium', la: 'Cranium' },
    parentId: 'g-axial-skeleton',
    regions: ['head'],
    center: [0, 1.6, 0],
    shape: { kind: 'sphere', radius: 0.09, scale: [0.85, 1, 1.05] },
    color: BONE,
    definition: true,
  },
  {
    id: 'mandible',
    system: 'skeletal',
    names: { en: 'Mandible', la: 'Mandibula' },
    parentId: 'g-axial-skeleton',
    regions: ['head'],
    center: [0, 1.5, 0.05],
    shape: { kind: 'box', size: [0.1, 0.03, 0.06] },
    color: BONE,
  },
  {
    id: 'vertebral-column',
    system: 'skeletal',
    names: { en: 'Vertebral column', la: 'Columna vertebralis' },
    parentId: 'g-axial-skeleton',
    regions: ['neck', 'back'],
    center: [0, 1.18, -0.05],
    shape: { kind: 'capsule', radius: 0.02, length: 0.5 },
    color: BONE,
  },
  {
    id: 'sternum',
    system: 'skeletal',
    names: { en: 'Sternum', la: 'Sternum' },
    parentId: 'g-axial-skeleton',
    regions: ['thorax'],
    center: [0, 1.3, 0.09],
    shape: { kind: 'box', size: [0.035, 0.17, 0.015] },
    color: BONE,
  },
  ...pair({
    id: 'hip-bone',
    system: 'skeletal',
    names: { en: 'Hip bone', la: 'Os coxae' },
    parentId: 'g-appendicular-skeleton',
    regions: ['pelvis'],
    center: [0.08, 0.95, 0],
    shape: { kind: 'box', size: [0.1, 0.14, 0.1] },
    color: BONE,
  }),
  ...pair({
    id: 'humerus',
    system: 'skeletal',
    names: { en: 'Humerus', la: 'Humerus' },
    parentId: 'g-appendicular-skeleton',
    regions: ['upper-limb'],
    center: [0.2, 1.27, 0],
    shape: { kind: 'capsule', radius: 0.018, length: 0.26 },
    color: BONE,
  }),
  ...pair({
    id: 'femur',
    system: 'skeletal',
    names: { en: 'Femur', la: 'Femur' },
    parentId: 'g-appendicular-skeleton',
    regions: ['lower-limb'],
    center: [0.09, 0.69, 0],
    shape: { kind: 'capsule', radius: 0.022, length: 0.38 },
    color: BONE,
    definition: true,
  }),
  ...pair({
    id: 'tibia',
    system: 'skeletal',
    names: { en: 'Tibia', la: 'Tibia' },
    parentId: 'g-appendicular-skeleton',
    regions: ['lower-limb'],
    center: [0.09, 0.27, 0.01],
    shape: { kind: 'capsule', radius: 0.02, length: 0.34 },
    color: BONE,
  }),

  // ------------------------------------------------------------------ muscular (12)
  ...pair({
    id: 'deltoid-muscle',
    system: 'muscular',
    names: { en: 'Deltoid muscle', la: 'Musculus deltoideus' },
    parentId: 'g-muscles-of-upper-limb',
    regions: ['upper-limb'],
    center: [0.2, 1.4, 0],
    shape: { kind: 'sphere', radius: 0.05, scale: [1, 1.2, 1] },
    color: MUSCLE,
    bones: ['humerus'],
  }),
  ...pair({
    id: 'biceps-brachii',
    system: 'muscular',
    names: { en: 'Biceps brachii', la: 'Musculus biceps brachii' },
    parentId: 'g-muscles-of-upper-limb',
    regions: ['upper-limb'],
    center: [0.2, 1.25, 0.035],
    shape: { kind: 'capsule', radius: 0.022, length: 0.16 },
    color: MUSCLE,
    definition: true,
  }),
  ...pair({
    id: 'pectoralis-major',
    system: 'muscular',
    names: { en: 'Pectoralis major', la: 'Musculus pectoralis major' },
    parentId: 'g-muscles-of-trunk',
    regions: ['thorax'],
    center: [0.08, 1.33, 0.1],
    shape: { kind: 'box', size: [0.12, 0.1, 0.025] },
    color: MUSCLE,
  }),
  ...pair({
    id: 'rectus-abdominis',
    system: 'muscular',
    names: { en: 'Rectus abdominis', la: 'Musculus rectus abdominis' },
    parentId: 'g-muscles-of-trunk',
    regions: ['abdomen'],
    center: [0.035, 1.08, 0.1],
    shape: { kind: 'box', size: [0.06, 0.3, 0.02] },
    color: MUSCLE,
  }),
  ...pair({
    id: 'quadriceps-femoris',
    system: 'muscular',
    names: { en: 'Quadriceps femoris', la: 'Musculus quadriceps femoris' },
    parentId: 'g-muscles-of-lower-limb',
    regions: ['lower-limb'],
    center: [0.09, 0.7, 0.04],
    shape: { kind: 'capsule', radius: 0.045, length: 0.28 },
    color: MUSCLE,
  }),
  ...pair({
    id: 'gastrocnemius',
    system: 'muscular',
    names: { en: 'Gastrocnemius', la: 'Musculus gastrocnemius' },
    parentId: 'g-muscles-of-lower-limb',
    regions: ['lower-limb'],
    center: [0.09, 0.33, -0.04],
    shape: { kind: 'capsule', radius: 0.035, length: 0.16 },
    color: MUSCLE,
  }),

  // ------------------------------------------------------------------ visceral (8)
  {
    id: 'heart',
    system: 'visceral',
    names: { en: 'Heart', la: 'Cor' },
    parentId: 'g-thoracic-organs',
    regions: ['thorax'],
    center: [0.03, 1.27, 0.04],
    shape: { kind: 'sphere', radius: 0.055, scale: [1, 1.1, 0.9] },
    color: '#a8383a',
    definition: true,
  },
  {
    id: 'lung-l',
    system: 'visceral',
    names: { en: 'Left lung', la: 'Pulmo sinister' },
    side: 'left',
    parentId: 'g-thoracic-organs',
    regions: ['thorax'],
    center: [0.09, 1.3, 0],
    shape: { kind: 'capsule', radius: 0.055, length: 0.12 },
    color: '#d7a19c',
  },
  {
    id: 'lung-r',
    system: 'visceral',
    names: { en: 'Right lung', la: 'Pulmo dexter' },
    side: 'right',
    parentId: 'g-thoracic-organs',
    regions: ['thorax'],
    center: [-0.09, 1.3, 0],
    shape: { kind: 'capsule', radius: 0.06, length: 0.12 },
    color: '#d7a19c',
  },
  {
    id: 'liver',
    system: 'visceral',
    names: { en: 'Liver', la: 'Hepar' },
    parentId: 'g-abdominal-organs',
    regions: ['abdomen'],
    center: [-0.06, 1.15, 0.03],
    shape: { kind: 'sphere', radius: 0.08, scale: [1.3, 0.6, 0.9] },
    color: '#7b2f25',
    definition: true,
  },
  {
    id: 'stomach',
    system: 'visceral',
    names: { en: 'Stomach', la: 'Gaster' },
    parentId: 'g-abdominal-organs',
    regions: ['abdomen'],
    center: [0.06, 1.13, 0.04],
    shape: { kind: 'sphere', radius: 0.05, scale: [1, 0.8, 0.8] },
    color: '#cf8a7b',
  },
  {
    id: 'spleen',
    system: 'visceral',
    names: { en: 'Spleen', la: 'Splen' },
    parentId: 'g-abdominal-organs',
    regions: ['abdomen'],
    center: [0.11, 1.15, -0.03],
    shape: { kind: 'sphere', radius: 0.035, scale: [0.7, 1.2, 0.8] },
    color: '#6c2b3b',
  },
  ...pair({
    id: 'kidney',
    system: 'visceral',
    names: { en: 'Kidney', la: 'Ren' },
    parentId: 'g-abdominal-organs',
    regions: ['abdomen'],
    center: [0.06, 1.05, -0.05],
    shape: { kind: 'sphere', radius: 0.04, scale: [0.6, 1.1, 0.5] },
    color: '#8a3a2f',
    nonCommercial: true,
  }),
];

const MOCK_GROUPS: GroupNode[] = [
  { id: 'g-axial-skeleton', system: 'skeletal', names: { en: 'Axial skeleton', la: 'Skeleton axiale' } },
  {
    id: 'g-appendicular-skeleton',
    system: 'skeletal',
    names: { en: 'Appendicular skeleton', la: 'Skeleton appendiculare' },
  },
  {
    id: 'g-muscles-of-upper-limb',
    system: 'muscular',
    names: { en: 'Muscles of upper limb', la: 'Musculi membri superioris' },
  },
  { id: 'g-muscles-of-trunk', system: 'muscular', names: { en: 'Muscles of trunk' } },
  {
    id: 'g-muscles-of-lower-limb',
    system: 'muscular',
    names: { en: 'Muscles of lower limb', la: 'Musculi membri inferioris' },
  },
  { id: 'g-thoracic-organs', system: 'visceral', names: { en: 'Thoracic organs (mock group)' } },
  { id: 'g-abdominal-organs', system: 'visceral', names: { en: 'Abdominal organs (mock group)' } },
];

const MOCK_LANDMARKS: Landmark[] = [
  {
    id: 'lm-greater-trochanter-l',
    system: 'skeletal',
    structureId: 'femur-l',
    names: { en: 'Greater trochanter', la: 'Trochanter major' },
    side: 'left',
    anchor: [0.115, 0.86, 0],
  },
  {
    id: 'lm-greater-trochanter-r',
    system: 'skeletal',
    structureId: 'femur-r',
    names: { en: 'Greater trochanter', la: 'Trochanter major' },
    side: 'right',
    anchor: [-0.115, 0.86, 0],
  },
];

export const MOCK_SYSTEMS: {
  id: SystemId;
  names: Names;
  color: string;
  layerOrder: number;
  defaultVisible: boolean;
  defaultOpacity: number;
}[] = [
  {
    id: 'skeletal',
    names: { en: 'Skeletal system', la: 'Systema skeletale' },
    color: BONE,
    layerOrder: 0,
    defaultVisible: true,
    defaultOpacity: 1,
  },
  {
    id: 'visceral',
    names: { en: 'Visceral systems' },
    color: '#a8383a',
    layerOrder: 3,
    defaultVisible: true,
    defaultOpacity: 1,
  },
  {
    id: 'muscular',
    names: { en: 'Muscular system', la: 'Systema musculare' },
    color: MUSCLE,
    layerOrder: 7,
    defaultVisible: false,
    defaultOpacity: 1,
  },
];

/** Approximate bbox of a mock shape (exact for boxes/capsules; spheres use their scaled radius). */
export function mockBBox(spec: MockStructureSpec): BBox {
  const [cx, cy, cz] = spec.center;
  let h: Vec3;
  const s = spec.shape;
  if (s.kind === 'box') h = [s.size[0] / 2, s.size[1] / 2, s.size[2] / 2];
  else if (s.kind === 'sphere') {
    const sc = s.scale ?? [1, 1, 1];
    h = [s.radius * sc[0], s.radius * sc[1], s.radius * sc[2]];
  } else {
    const half = s.length / 2 + s.radius;
    const axis = s.axis ?? 'y';
    h = [axis === 'x' ? half : s.radius, axis === 'y' ? half : s.radius, axis === 'z' ? half : s.radius];
  }
  return { min: [cx - h[0], cy - h[1], cz - h[2]], max: [cx + h[0], cy + h[1], cz + h[2]] };
}

function chunkFile(system: SystemId) {
  return `mock-${system}.glb`;
}

function toStructure(spec: MockStructureSpec): Structure {
  const bbox = mockBBox(spec);
  const st: Structure = {
    id: spec.id,
    kind: 'structure',
    nodeName: spec.id,
    chunk: chunkFile(spec.system),
    system: spec.system,
    regions: spec.regions,
    names: spec.names,
    color: spec.color,
    centroid: spec.center,
    bbox,
    labelAnchor: [spec.center[0], bbox.max[1], spec.center[2]],
    triangles: 0,
    attribution: 'mock',
    license: 'CC0-1.0',
  };
  if (spec.side) {
    st.side = spec.side;
    st.sideSource = spec.id.endsWith('-l') || spec.id.endsWith('-r') ? 'suffix' : 'name';
    const base = spec.id.replace(/-(l|r)$/, '');
    const other = `${base}-${spec.side === 'left' ? 'r' : 'l'}`;
    if (MOCK_STRUCTURES.some((m) => m.id === other)) st.pairId = other;
  }
  if (spec.parentId) st.parentId = spec.parentId;
  if (spec.nonCommercial) st.nonCommercial = true;
  if (spec.definition) st.definitionKey = spec.id.replace(/-(l|r)$/, '');
  if (spec.bones)
    st.boneIds = spec.bones.map((b) => (spec.side ? `${b}-${spec.side === 'left' ? 'l' : 'r'}` : b));
  return st;
}

export function mockManifest(): Manifest {
  const all = MOCK_STRUCTURES.map(mockBBox);
  const min: Vec3 = [0, 1, 2].map((i) => Math.min(...all.map((b) => b.min[i]!))) as Vec3;
  const max: Vec3 = [0, 1, 2].map((i) => Math.max(...all.map((b) => b.max[i]!))) as Vec3;
  return {
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    appDataVersion: 'mock',
    source: {
      name: 'Z-Anatomy',
      url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy',
      license: 'CC BY-SA 4.0',
    },
    languages: ['en', 'la'],
    units: 'm',
    bodyBounds: { min, max },
    systems: MOCK_SYSTEMS.map((s) => {
      const members = MOCK_STRUCTURES.filter((m) => m.system === s.id);
      return {
        ...s,
        chunks: [{ file: chunkFile(s.id), bytes: 1, structureCount: members.length, triangleCount: 0 }],
        structuresFile: `structures/${s.id}.json`,
        definitionsFile: `definitions/${s.id}.json`,
        structureCount: members.length,
        triangleCount: 0,
      };
    }),
    regions: [
      { id: 'head', names: { en: 'Head', la: 'Caput' } },
      { id: 'neck', names: { en: 'Neck', la: 'Collum' } },
      { id: 'trunk', names: { en: 'Trunk', la: 'Truncus' } },
      { id: 'thorax', names: { en: 'Thorax', la: 'Thorax' }, parentId: 'trunk' },
      { id: 'abdomen', names: { en: 'Abdomen', la: 'Abdomen' }, parentId: 'trunk' },
      { id: 'pelvis', names: { en: 'Pelvis', la: 'Pelvis' }, parentId: 'trunk' },
      { id: 'back', names: { en: 'Back', la: 'Dorsum' }, parentId: 'trunk' },
      { id: 'upper-limb', names: { en: 'Upper limb', la: 'Membrum superius' } },
      { id: 'lower-limb', names: { en: 'Lower limb', la: 'Membrum inferius' } },
    ],
    attributions: {
      mock: {
        text: 'Mock development data (primitives), not anatomical content',
        license: 'CC0-1.0',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      },
    },
    searchIndexFile: 'search-index.json',
  };
}

export function mockStructuresFile(system: SystemId): SystemStructuresFile {
  return {
    schemaVersion: 1,
    system,
    structures: MOCK_STRUCTURES.filter((m) => m.system === system).map(toStructure),
    groups: MOCK_GROUPS.filter((g) => g.system === system),
    landmarks: MOCK_LANDMARKS.filter((l) => l.system === system),
  };
}

export function mockDefinitionsFile(system: SystemId): DefinitionsFile {
  const definitions: DefinitionsFile['definitions'] = {};
  for (const m of MOCK_STRUCTURES) {
    if (m.system !== system || !m.definition) continue;
    definitions[m.id.replace(/-(l|r)$/, '')] = {
      text: {
        en: `Placeholder definition for "${m.names.en}" (mock data for development, not anatomical content).`,
      },
      source: 'Mock',
      license: 'CC0-1.0',
      reviewed: false,
    };
  }
  return { schemaVersion: 1, system, definitions };
}

export function mockSearchEntries(): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const m of MOCK_STRUCTURES) {
    const e: SearchEntry = { id: m.id, type: 'structure', system: m.system, names: m.names };
    if (m.side) e.side = m.side;
    out.push(e);
  }
  for (const g of MOCK_GROUPS) out.push({ id: g.id, type: 'group', system: g.system, names: g.names });
  for (const l of MOCK_LANDMARKS) {
    const e: SearchEntry = { id: l.id, type: 'landmark', system: l.system, names: l.names };
    if (l.side) e.side = l.side;
    out.push(e);
  }
  return out;
}
