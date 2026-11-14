// Page model for the static structure pages (one page per structure, left/right pair, group or landmark with a
// description). Shared by the Vite plugin (seo/plugin.ts) and the thumbnail renderer (seo/thumbnails.ts).
// Pure apart from loadSiteData; runs under Node's type stripping, so: erasable TypeScript only, `.ts` imports.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BBox,
  Definition,
  DefinitionsFile,
  GroupNode,
  Landmark,
  Manifest,
  Names,
  Side,
  Structure,
  SystemId,
  SystemStructuresFile,
  Vec3,
} from '../src/contract/anatomy.ts';
import { supportPath } from '../src/donation.ts';

export const SITE_URL = 'https://learnanatomy.org';
export const PAGE_LANGS = ['en', 'de'] as const;
export type PageLang = (typeof PAGE_LANGS)[number];

/** Path segment of the per-system index pages (/en/systems/skeletal); never used as a structure slug. */
export const SYSTEMS_SEGMENT = 'systems';
/** Published thumbnail paths (relative to the site root), written by seo/thumbnails.ts into public/. */
export const THUMBS_DIR = 'thumbs';
export const thumbPath = (slug: string) => `${THUMBS_DIR}/${slug}.webp`;
export const cardPath = (slug: string) => `${THUMBS_DIR}/og/${slug}.jpg`;
export const THUMB_SIZE = 800;
export const CARD_SIZE = { width: 1200, height: 630 };

/** Supply and function shown on the pages, with the Wikidata property each comes from (seo/wikidata.ts). */
export const RELATION_PROPS = {
  innervation: 'P3189',
  arterialSupply: 'P2286',
  venousDrainage: 'P2289',
  lymphaticDrainage: 'P2288',
  action: 'P3310',
} as const;
export type RelationKind = keyof typeof RELATION_PROPS;
export const RELATION_KINDS = Object.keys(RELATION_PROPS) as RelationKind[];

/** data/wikidata/wikidata.json, written by seo/wikidata.ts. */
export interface WikidataFile {
  schemaVersion: 1;
  fetchedAt: string;
  /** TA2 ID → item (only IDs that exactly one item carries). */
  byTa2: Record<string, string>;
  /** English Wikipedia title (as in a description's source URL, spaces for underscores) → item. */
  byEnwiki: Record<string, string>;
  items: Record<string, { dewiki?: string; relations?: Partial<Record<RelationKind, string[]>> }>;
  labels: Record<string, { en?: string; de?: string }>;
  /** German Wikipedia title → introduction (paragraphs separated by a blank line) and article URL. */
  dewiki: Record<string, { text: string; url: string }>;
}

/** A nerve, vessel or action: a link when it has a page of its own, else its Wikidata label. */
export interface RelationRef {
  slug?: string;
  label: { en?: string; de?: string };
}

export interface SiteData {
  manifest: Manifest;
  structures: Structure[];
  groups: GroupNode[];
  landmarks: Landmark[];
  /** Key: `${system}:${definitionKey}`. */
  definitions: Record<string, Definition>;
  wikidata?: WikidataFile;
}

export type PageType = 'structure' | 'group' | 'landmark';

/** How seo/thumbnails.ts renders a page's image. */
export interface RenderSpec {
  /** Structure ids (with geometry) to isolate and frame. */
  ids: string[];
  /** 'left' / 'right': camera on the patient's left / right (+X / −X). */
  view: 'anterior' | 'posterior' | 'left' | 'right';
  /** 'context' ghosts the default layers around the structure; tiny structures are shown alone. */
  mode: 'context' | 'isolate';
  bbox: BBox;
  /** Multiplies the framing distance; skin regions are shown with more of the body around them. */
  zoomOut: number;
}

/** A link to another page, or just names when the target has no page (landmarks without a description). */
export interface Ref {
  slug?: string;
  names: Names;
}

export interface Page {
  slug: string;
  type: PageType;
  /** Node ids of this page: one, or a left/right pair (left first). */
  ids: string[];
  /** Same-named structures folded into a group page (e.g. g-midbrain + midbrain-l/-r). */
  mergedIds: string[];
  system: SystemId;
  names: Names;
  synonyms: string[];
  sides: Side[];
  regions: string[];
  definition?: Definition;
  /** German Wikipedia introduction for the German page (the English page shows `definition`). */
  definitionDe?: Definition;
  /** Wikidata item of the page (by TA2 ID, else by the English article of its description). */
  qid?: string;
  /** Supply and function from Wikidata. */
  relations?: Partial<Record<RelationKind, RelationRef[]>>;
  /** Node selected by "Open in 3D" (/?s=…). */
  openId: string;
  /** Root first; the last entry is the direct parent. */
  ancestors: string[];
  parts: string[];
  landmarks: Ref[];
  siblings: string[];
  /** For muscles: bones of origin / insertion. For bones: muscles that arise / insert there. */
  attachments: { origins: string[]; insertions: string[]; originOf: string[]; insertionOf: string[] };
  /** Page whose image is shown (landmarks reuse their structure's image). */
  thumbSlug?: string;
  render?: RenderSpec;
}

export interface Site {
  data: SiteData;
  pages: Page[];
  bySlug: Map<string, Page>;
  /** Every structure, group and landmark id with a page → its slug. */
  slugOfId: Map<string, string>;
}

/** `wikidataFile` (data/wikidata/wikidata.json) is optional: without it the pages have no supply/function box and
 * German pages show the English description. */
export function loadSiteData(modelsDir: string, wikidataFile?: string): SiteData | null {
  const read = <T>(file: string): T => JSON.parse(readFileSync(join(modelsDir, file), 'utf8')) as T;
  if (!existsSync(join(modelsDir, 'manifest.json'))) return null;
  const manifest = read<Manifest>('manifest.json');
  const data: SiteData = { manifest, structures: [], groups: [], landmarks: [], definitions: {} };
  if (wikidataFile && existsSync(wikidataFile))
    data.wikidata = JSON.parse(readFileSync(wikidataFile, 'utf8')) as WikidataFile;
  for (const sys of manifest.systems) {
    const f = read<SystemStructuresFile>(sys.structuresFile);
    data.structures.push(...f.structures);
    data.groups.push(...f.groups);
    data.landmarks.push(...f.landmarks);
    if (sys.definitionsFile) {
      const d = read<DefinitionsFile>(sys.definitionsFile);
      for (const [key, def] of Object.entries(d.definitions)) data.definitions[`${sys.id}:${key}`] = def;
    }
  }
  return data;
}

const SIDE_SUFFIX = /-(l|r)$/;
const baseOf = (id: string) => id.replace(/^(g|lm)-/, '').replace(SIDE_SUFFIX, '');
const sideOrder = (id: string) => (id.endsWith('-l') ? 0 : id.endsWith('-r') ? 1 : 2);
const byName = (a: { names: Names }, b: { names: Names }) => a.names.en.localeCompare(b.names.en, 'en');

function definitionOf(data: SiteData, system: SystemId, key: string | undefined): Definition | undefined {
  const def = key ? data.definitions[`${system}:${key}`] : undefined;
  return def && Object.values(def.text).some((t) => t && t.trim()) ? def : undefined;
}

function unionBox(boxes: BBox[]): BBox | null {
  if (!boxes.length) return null;
  const min: Vec3 = [...boxes[0]!.min];
  const max: Vec3 = [...boxes[0]!.max];
  for (const b of boxes)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, b.min[i]!);
      max[i] = Math.max(max[i]!, b.max[i]!);
    }
  return { min, max };
}

const width = (b: BBox) => b.max[0] - b.min[0];
const maxExtent = (b: BBox) => Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);

/**
 * Which structures to show in a page's image. Both sides together when they sit close (femora, kidneys, heart);
 * otherwise only the patient's left side, so a paired muscle is not shrunk to two specks at the image edges.
 * Seen from the front, from behind when the structure lies wholly behind the coronal midplane, and skin regions
 * that face sideways (thin in x) from the side.
 */
export function renderSpecFor(structures: Structure[], bodyBounds: BBox): RenderSpec | undefined {
  const left = structures.filter((s) => s.side === 'left');
  const right = structures.filter((s) => s.side === 'right');
  let chosen = structures;
  if (left.length && right.length) {
    const all = unionBox(structures.map((s) => s.bbox))!;
    const single = Math.max(
      width(unionBox(left.map((s) => s.bbox))!),
      width(unionBox(right.map((s) => s.bbox))!),
    );
    if (width(all) > 0.35 || width(all) > 4 * single) chosen = left;
  }
  const bbox = unionBox(chosen.map((s) => s.bbox));
  if (!bbox) return undefined;
  const bodyMidZ = (bodyBounds.min[2] + bodyBounds.max[2]) / 2;
  const centreX = (bbox.min[0] + bbox.max[0]) / 2;
  const sideways =
    chosen.every((s) => s.system === 'regions') &&
    (bbox.max[0] - bbox.min[0]) * 1.5 < bbox.max[2] - bbox.min[2] &&
    Math.abs(centreX) > 0.03;
  return {
    ids: chosen.map((s) => s.id),
    view: sideways ? (centreX > 0 ? 'left' : 'right') : bbox.max[2] < bodyMidZ ? 'posterior' : 'anterior',
    mode: maxExtent(bbox) < 0.024 ? 'isolate' : 'context',
    bbox,
    zoomOut: chosen.every((s) => s.system === 'regions') ? 2.4 : 1,
  };
}

interface Unit {
  type: PageType;
  base: string;
  ids: string[];
  mergedIds: string[];
  system: SystemId;
}

/** Slug priority on a clash: anatomical structures and groups first, landmarks next, skin regions last. */
function priority(u: Unit): number {
  return (u.type === 'landmark' ? 2 : u.type === 'group' ? 1 : 0) + (u.system === 'regions' ? 3 : 0);
}
const CLASH_SUFFIX: Record<PageType, string> = {
  structure: 'structure',
  group: 'group',
  landmark: 'landmark',
};

export function buildSite(data: SiteData): Site {
  const structById = new Map(data.structures.map((s) => [s.id, s]));
  const groupById = new Map(data.groups.map((g) => [g.id, g]));
  const landmarkById = new Map(data.landmarks.map((l) => [l.id, l]));
  const patches = data.structures.filter((p) => p.kind !== 'structure');
  const childrenOf = new Map<string, string[]>();
  for (const n of [...data.structures, ...data.groups])
    if (n.parentId) childrenOf.set(n.parentId, [...(childrenOf.get(n.parentId) ?? []), n.id]);
  const landmarksOf = new Map<string, Landmark[]>();
  for (const l of data.landmarks)
    landmarksOf.set(l.structureId, [...(landmarksOf.get(l.structureId) ?? []), l]);

  /** A node and every structure and group below it. Patches are not in the tree. */
  const subtree = (id: string, seen = new Set<string>()): string[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    return [id, ...(childrenOf.get(id) ?? []).flatMap((c) => subtree(c, seen))];
  };

  // 1. units: structure pairs, groups, landmark pairs (landmarks only with their own description)
  const units = new Map<string, Unit>();
  const addUnit = (type: PageType, id: string, system: SystemId) => {
    const key = `${type}:${system}:${baseOf(id)}`;
    const u = units.get(key) ?? { type, base: baseOf(id), ids: [], mergedIds: [], system };
    u.ids.push(id);
    u.ids.sort((a, b) => sideOrder(a) - sideOrder(b));
    units.set(key, u);
  };
  for (const s of data.structures) if (s.kind === 'structure') addUnit('structure', s.id, s.system);
  for (const g of data.groups) addUnit('group', g.id, g.system);
  for (const l of data.landmarks)
    if (definitionOf(data, l.system, l.definitionKey)) addUnit('landmark', l.id, l.system);

  // 2. fold a structure into the same-named group that contains it or sits next to it
  //    (g-midbrain ⊃ midbrain-l/-r; g-hepatic-portal-vein beside hepatic-portal-vein)
  for (const [key, u] of units) {
    if (u.type !== 'structure') continue;
    const parent = structById.get(u.ids[0]!)?.parentId;
    const group = units.get(`group:${u.system}:${u.base}`);
    const groupId = group?.ids[0];
    if (group && parent && (groupId === parent || groupById.get(groupId!)?.parentId === parent)) {
      group.mergedIds.push(...u.ids);
      units.delete(key);
    }
  }
  // groups without geometry and without a description would be empty pages
  for (const [key, u] of units)
    if (
      u.type === 'group' &&
      !u.mergedIds.length &&
      !subtree(u.ids[0]!).some((id) => structById.has(id)) &&
      !definitionOf(data, u.system, groupById.get(u.ids[0]!)?.definitionKey)
    )
      units.delete(key);

  // 3. slugs
  // /de/support is the German support page (src/donation.ts), so "support" is never a structure slug either.
  const taken = new Set<string>([SYSTEMS_SEGMENT, supportPath('de').split('/').pop()!]);
  const slugged: [string, Unit][] = [];
  const ordered = [...units.values()].sort(
    (a, b) => priority(a) - priority(b) || a.base.localeCompare(b.base),
  );
  for (const u of ordered) {
    let slug = u.base;
    if (taken.has(slug)) slug = `${u.base}-${u.system === 'regions' ? 'region' : CLASH_SUFFIX[u.type]}`;
    for (let i = 2; taken.has(slug); i++) slug = `${u.base}-${i}`;
    taken.add(slug);
    slugged.push([slug, u]);
  }
  const slugOfId = new Map<string, string>();
  for (const [slug, u] of slugged) for (const id of [...u.ids, ...u.mergedIds]) slugOfId.set(id, slug);

  const nodeOf = (id: string) => structById.get(id) ?? groupById.get(id) ?? landmarkById.get(id);
  // Some patches carry no muscleId (the muscle is a group, e.g. "Biceps brachii muscle"): match the patch's
  // English name to exactly one structure or group page instead.
  const pageIdByName = new Map<string, string | null>();
  for (const [, u] of slugged) {
    if (u.type === 'landmark') continue;
    const name = nodeOf(u.ids[0]!)!.names.en.toLowerCase();
    pageIdByName.set(name, pageIdByName.has(name) ? null : u.ids[0]!);
  }
  const muscleOf = (p: Structure) =>
    p.muscleId ?? pageIdByName.get(p.names.en.replace(/^\((.*)\)$/, '$1').toLowerCase()) ?? undefined;
  const slugsOf = (ids: Iterable<string>, self: string) => [
    ...new Set([...ids].map((id) => slugOfId.get(id)).filter((s): s is string => Boolean(s) && s !== self)),
  ];

  // 4. pages
  const pages: Page[] = [];
  for (const [slug, u] of slugged) {
    const primary = nodeOf(u.ids[0]!)!;
    const merged = u.mergedIds.map((id) => structById.get(id)!);
    const nodeIds =
      u.type === 'landmark' ? [] : [...new Set([...u.ids, ...u.mergedIds].flatMap((id) => subtree(id)))];
    const structures = nodeIds.flatMap((id) => structById.get(id) ?? []);
    const owner = u.type === 'landmark' ? structById.get((primary as Landmark).structureId) : undefined;

    const parentId = u.type === 'landmark' ? owner?.id : (primary as Structure | GroupNode).parentId;
    const ancestors: string[] = [];
    for (let id = parentId, guard = 0; id && guard < 50; guard++) {
      const s = slugOfId.get(id);
      if (s && s !== slug && !ancestors.includes(s)) ancestors.unshift(s);
      id = (structById.get(id) ?? groupById.get(id))?.parentId;
    }
    const parentSlug = ancestors[ancestors.length - 1];

    const childIds = [...u.ids, ...u.mergedIds].flatMap((id) => childrenOf.get(id) ?? []);
    const siblingIds = parentId ? (childrenOf.get(parentId) ?? []) : [];

    const lmRefs = new Map<string, Ref>();
    if (u.type !== 'landmark')
      for (const id of [...u.ids, ...u.mergedIds])
        for (const l of landmarksOf.get(id) ?? []) {
          const s = slugOfId.get(l.id);
          if (!lmRefs.has(s ?? baseOf(l.id)))
            lmRefs.set(s ?? baseOf(l.id), s ? { slug: s, names: l.names } : { names: l.names });
        }

    const attach = {
      origins: [] as string[],
      insertions: [] as string[],
      originOf: [] as string[],
      insertionOf: [] as string[],
    };
    // muscles are often groups of parts (g-biceps-brachii-muscle); patches point at a part or at the group
    const smallGroup = u.type === 'group' && u.system === 'muscular' && structures.length <= 16;
    if (u.type === 'structure' || smallGroup) {
      const own = new Set(nodeIds);
      const bonesOf = (kind: Structure['kind']) =>
        slugsOf(
          patches.filter((p) => p.kind === kind && own.has(muscleOf(p) ?? '')).flatMap((p) => p.boneId ?? []),
          slug,
        );
      const musclesOn = (kind: Structure['kind']) =>
        slugsOf(
          patches.filter((p) => p.kind === kind && own.has(p.boneId ?? '')).flatMap((p) => muscleOf(p) ?? []),
          slug,
        );
      attach.origins = bonesOf('origin');
      attach.insertions = bonesOf('insertion');
      if (u.type === 'structure') {
        attach.originOf = musclesOn('origin');
        attach.insertionOf = musclesOn('insertion');
      }
    }

    const regions = new Set<string>();
    for (const s of owner ? [owner] : structures) for (const r of s.regions) regions.add(r);

    const sides = [
      ...new Set(
        u.ids.map((id) => (structById.get(id) ?? landmarkById.get(id))?.side).filter((s): s is Side => !!s),
      ),
    ];
    const synonyms = [
      ...new Set([u.ids[0]!, ...merged.map((m) => m.id)].flatMap((id) => structById.get(id)?.synonyms ?? [])),
    ];
    const definition =
      definitionOf(data, primary.system, primary.definitionKey) ??
      merged.map((m) => definitionOf(data, m.system, m.definitionKey)).find(Boolean);

    pages.push({
      slug,
      type: u.type,
      ids: u.ids,
      mergedIds: u.mergedIds,
      system: u.system,
      names: primary.names,
      synonyms: synonyms.filter((s) => !Object.values(primary.names).includes(s)),
      sides,
      regions: [...regions],
      ...(definition ? { definition } : {}),
      openId: u.ids[0]!,
      ancestors,
      parts: slugsOf(childIds, slug),
      landmarks: [...lmRefs.values()].sort(byName),
      siblings: slugsOf(siblingIds, slug).filter((s) => s !== parentSlug),
      attachments: attach,
      ...(u.type === 'landmark' ? {} : { render: renderSpecFor(structures, data.manifest.bodyBounds) }),
    });
  }

  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  for (const p of pages) {
    if (p.render) p.thumbSlug = p.slug;
    else if (p.type === 'landmark') {
      const owner = structById.get((nodeOf(p.ids[0]!) as Landmark).structureId);
      const ownerSlug = owner ? slugOfId.get(owner.id) : undefined;
      if (ownerSlug && bySlug.get(ownerSlug)?.render) p.thumbSlug = ownerSlug;
    }
    if (p.render === undefined) delete p.render;
  }
  if (data.wikidata) addWikidata(data, data.wikidata, pages, slugOfId);
  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  return { data, pages, bySlug, slugOfId };
}

/** "https://en.wikipedia.org/wiki/Pectoralis_major" → "Pectoralis major" (the key of WikidataFile.byEnwiki). */
export function enwikiTitle(url: string | undefined): string | undefined {
  const m = url ? /^https?:\/\/en\.wikipedia\.org\/wiki\/([^#?]+)/.exec(url) : null;
  if (!m) return undefined;
  try {
    return decodeURIComponent(m[1]!).replace(/_/g, ' ');
  } catch {
    return m[1]!.replace(/_/g, ' ');
  }
}

/**
 * Wikidata item, German description and supply/function of each page. The item is matched by TA2 ID (exact),
 * else by the English article of the page's description. The German text is the German version of that same
 * article, so both language pages say the same; supply and function come from the page's own item only, never
 * from a broader article (a muscle part's page does not inherit the whole muscle's nerves).
 */
function addWikidata(data: SiteData, wd: WikidataFile, pages: Page[], slugOfId: Map<string, string>) {
  const structById = new Map(data.structures.map((s) => [s.id, s]));
  const slugOfTa2 = new Map<string, string>();
  for (const s of data.structures) {
    const slug = s.taId ? slugOfId.get(s.id) : undefined;
    if (slug && !slugOfTa2.has(s.taId!)) slugOfTa2.set(s.taId!, slug);
  }
  const slugOfQid = new Map<string, string>();
  for (const [ta2, qid] of Object.entries(wd.byTa2)) {
    const slug = slugOfTa2.get(ta2);
    if (slug && !slugOfQid.has(qid)) slugOfQid.set(qid, slug);
  }

  for (const page of pages) {
    const taQid = [...page.ids, ...page.mergedIds]
      .map((id) => structById.get(id)?.taId)
      .map((ta2) => (ta2 ? wd.byTa2[ta2] : undefined))
      .find(Boolean);
    const title = enwikiTitle(page.definition?.sourceUrl);
    const articleQid = title ? wd.byEnwiki[title] : undefined;
    const qid = taQid ?? articleQid;
    if (!qid) continue;
    page.qid = qid;

    for (const q of [articleQid, taQid]) {
      const deTitle = q ? wd.items[q]?.dewiki : undefined;
      const de = deTitle ? wd.dewiki[deTitle] : undefined;
      if (de) {
        page.definitionDe = {
          text: { de: de.text },
          source: 'Wikipedia',
          sourceUrl: de.url,
          license: 'CC-BY-SA-4.0',
          reviewed: false,
        };
        break;
      }
    }

    const relations: Partial<Record<RelationKind, RelationRef[]>> = {};
    for (const kind of RELATION_KINDS) {
      const refs: RelationRef[] = [];
      const seen = new Set<string>();
      for (const target of wd.items[qid]?.relations?.[kind] ?? []) {
        const slug = slugOfQid.get(target);
        const label = wd.labels[target] ?? {};
        const key = slug ?? target;
        if (slug === page.slug || seen.has(key) || (!slug && !label.en && !label.de)) continue;
        seen.add(key);
        refs.push(slug ? { slug, label } : { label });
      }
      if (refs.length) relations[kind] = refs;
    }
    if (Object.keys(relations).length) page.relations = relations;
  }
}
