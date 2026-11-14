// Small synthetic data set for the seo/ unit tests (no pipeline output needed).
import type { BBox, Structure, SystemInfo } from '../src/contract/anatomy.ts';
import type { SiteData, WikidataFile } from './model.ts';

const box = (x0: number, x1: number, y0 = 0.5, y1 = 0.9, z0 = -0.05, z1 = 0.05): BBox => ({
  min: [x0, y0, z0],
  max: [x1, y1, z1],
});

function structure(
  id: string,
  system: string,
  en: string,
  bbox: BBox,
  extra: Partial<Structure> = {},
): Structure {
  const side = id.endsWith('-l') ? 'left' : id.endsWith('-r') ? 'right' : undefined;
  return {
    id,
    kind: 'structure',
    nodeName: id,
    chunk: `${system}.glb`,
    system,
    regions: ['lower-limb'],
    ...(side ? { side } : {}),
    names: { en },
    color: '#cccccc',
    centroid: [0, 0, 0],
    bbox,
    triangles: 100,
    attribution: 'z-anatomy',
    license: 'CC-BY-SA-4.0',
    ...extra,
  };
}

const system = (id: string, layerOrder: number): SystemInfo => ({
  id,
  names: { en: id },
  color: '#cccccc',
  layerOrder,
  defaultVisible: id === 'skeletal',
  defaultOpacity: 1,
  chunks: [],
  structuresFile: `structures/${id}.json`,
  structureCount: 0,
  triangleCount: 0,
});

export function testData(): SiteData {
  return {
    manifest: {
      schemaVersion: 1,
      generatedAt: '2026-10-29T12:00:00.000Z',
      appDataVersion: 'test',
      source: { name: 'Z-Anatomy', url: 'https://example.org', license: 'CC BY-SA 4.0' },
      languages: ['la', 'en'],
      units: 'm',
      bodyBounds: { min: [-0.3, 0, -0.15], max: [0.3, 1.7, 0.15] },
      systems: ['skeletal', 'insertions', 'muscular', 'nervous', 'regions'].map(system),
      regions: [],
      attributions: { 'z-anatomy': { text: 'Z-Anatomy', license: 'CC-BY-SA-4.0' } },
      searchIndexFile: 'search-index.json',
    },
    structures: [
      structure('femur-l', 'skeletal', 'Femur', box(0.03, 0.15), {
        names: { en: 'Femur', la: 'Os femoris', fr: 'Fémur' },
        parentId: 'g-bones-of-lower-limb',
        pairId: 'femur-r',
        definitionKey: 'femur',
      }),
      structure('femur-r', 'skeletal', 'Femur', box(-0.15, -0.03), {
        names: { en: 'Femur', la: 'Os femoris', fr: 'Fémur' },
        parentId: 'g-bones-of-lower-limb',
        pairId: 'femur-l',
        definitionKey: 'femur',
      }),
      structure('tibia-l', 'skeletal', 'Tibia', box(0.05, 0.12), { parentId: 'g-bones-of-lower-limb' }),
      structure('radius-l', 'skeletal', 'Radius', box(0.2, 0.26)),
      structure('scapula-l', 'skeletal', 'Scapula', box(0.1, 0.2)),
      structure('humerus-l', 'skeletal', 'Humerus', box(0.15, 0.25)),
      structure('humerus-r', 'skeletal', 'Humerus', box(-0.25, -0.15)),
      structure('stapes-l', 'skeletal', 'Stapes', box(0.06, 0.063, 1.5, 1.503, 0, 0.003)),
      structure('trapezius', 'muscular', 'Trapezius', box(-0.2, 0.2, 1.1, 1.5, -0.12, -0.02)),
      structure('long-head-of-biceps-l', 'muscular', 'Long head of biceps', box(0.18, 0.22), {
        parentId: 'g-biceps',
        taId: '2471',
        definitionKey: 'biceps',
      }),
      structure('musculocutaneous-nerve-l', 'nervous', 'Musculocutaneous nerve', box(0.15, 0.2), {
        names: { en: 'Musculocutaneous nerve', la: 'Nervus musculocutaneus' },
        taId: '6421',
      }),
      structure('midbrain-l', 'nervous', 'Midbrain', box(0, 0.02, 1.5, 1.55), { parentId: 'g-midbrain' }),
      structure('midbrain-r', 'nervous', 'Midbrain', box(-0.02, 0, 1.5, 1.55), { parentId: 'g-midbrain' }),
      structure('greater-trochanter-l', 'regions', 'Greater trochanter region', box(0.12, 0.16)),
      // muscle attachment patches: one with a muscleId, one resolved by its name ("(Biceps)" → g-biceps)
      structure('biceps-origin-l', 'insertions', 'Long head of biceps', box(0.1, 0.12), {
        kind: 'origin',
        muscleId: 'long-head-of-biceps-l',
        boneId: 'scapula-l',
      }),
      structure('biceps-insertion-l', 'insertions', '(Biceps)', box(0.2, 0.22), {
        kind: 'insertion',
        boneId: 'radius-l',
      }),
    ],
    groups: [
      { id: 'g-bones-of-lower-limb', system: 'skeletal', names: { en: 'Bones of lower limb' } },
      {
        id: 'g-biceps',
        system: 'muscular',
        names: { en: 'Biceps', la: 'Musculus biceps' },
        definitionKey: 'biceps',
      },
      { id: 'g-midbrain', system: 'nervous', names: { en: 'Midbrain' } },
      { id: 'g-empty', system: 'skeletal', names: { en: 'Empty group' } },
    ],
    landmarks: [
      {
        id: 'lm-greater-trochanter-l',
        system: 'skeletal',
        structureId: 'femur-l',
        names: { en: 'Greater trochanter', la: 'Trochanter major' },
        side: 'left',
        anchor: [0.1, 0.85, 0],
        definitionKey: 'greater-trochanter',
      },
      {
        id: 'lm-greater-trochanter-r',
        system: 'skeletal',
        structureId: 'femur-r',
        names: { en: 'Greater trochanter', la: 'Trochanter major' },
        side: 'right',
        anchor: [-0.1, 0.85, 0],
        definitionKey: 'greater-trochanter',
      },
      {
        id: 'lm-linea-aspera-l',
        system: 'skeletal',
        structureId: 'femur-l',
        names: { en: 'Linea aspera' },
        side: 'left',
        anchor: [0.1, 0.7, 0],
      },
    ],
    definitions: {
      'skeletal:femur': {
        text: {
          en: 'The femur (, pl. femora ), or thigh bone, is the bone of the thigh.\n\nIt is <long>.\n\n== Structure ==\n\nThe head …',
        },
        source: 'Wikipedia',
        sourceUrl: 'https://en.wikipedia.org/wiki/Femur',
        license: 'CC-BY-SA-3.0',
        reviewed: false,
      },
      'muscular:biceps': {
        text: {
          en: 'The biceps is a large muscle that lies on the front of the upper arm between the shoulder and the elbow.',
        },
        source: 'Wikipedia',
        sourceUrl: 'https://en.wikipedia.org/wiki/Biceps',
        license: 'CC-BY-SA-3.0',
        reviewed: false,
      },
      'skeletal:greater-trochanter': {
        text: { en: 'A large projection of the femur.\n-Gluteus medius\n-Gluteus minimus' },
        source: 'Z-Anatomy',
        license: 'CC-BY-SA-4.0',
        reviewed: true,
      },
    },
  };
}

/**
 * Wikidata for testData(): the femur by its English article; the biceps (a group) by its article, with nerve
 * supply (one target with a page, one without) and action; its long head by TA2 ID, an item without statements.
 */
export function testWikidata(): WikidataFile {
  return {
    schemaVersion: 1,
    fetchedAt: '2026-11-14T10:00:00.000Z',
    byTa2: { '2471': 'Q20', '6421': 'Q30' },
    byEnwiki: { Femur: 'Q1', Biceps: 'Q10' },
    items: {
      Q1: { dewiki: 'Oberschenkelknochen' },
      Q10: {
        dewiki: 'Musculus biceps brachii',
        relations: { innervation: ['Q30', 'Q31'], action: ['Q40'], arterialSupply: ['Q99'] },
      },
      Q20: {},
    },
    labels: {
      Q30: { en: 'musculocutaneous nerve', de: 'Nervus musculocutaneus' },
      Q31: { en: 'radial nerve' },
      Q40: { en: 'elbow flexion', de: 'Beugung im Ellenbogengelenk' },
    },
    dewiki: {
      Oberschenkelknochen: {
        text: 'Der Oberschenkelknochen (lateinisch Os femoris) ist der längste Knochen des menschlichen Körpers.\n\nEr verbindet Hüfte und Knie.',
        url: 'https://de.wikipedia.org/wiki/Oberschenkelknochen',
      },
      'Musculus biceps brachii': {
        text: 'Der Musculus biceps brachii ist ein zweiköpfiger Skelettmuskel des Oberarms, der vor allem den Ellenbogen beugt.',
        url: 'https://de.wikipedia.org/wiki/Musculus_biceps_brachii',
      },
    },
  };
}
