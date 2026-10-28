/**
 * Shared data contract: what the asset pipeline (pipeline/) writes to public/models/ and what the app reads.
 *
 * OWNER: lead. Agents propose changes, they don't edit this file.
 * Every change must stay in sync with pipeline/manifest.mjs and pipeline/validate.mjs.
 *
 * Coordinate system (normalized by the pipeline, see ARCHITECTURE.md §Coordinates):
 *   units = metres, true scale (the Z-Anatomy body is ≈1.70 m tall; we do not rescale)
 *   +Y = superior (up), feet at y = 0
 *   +Z = anterior (the body faces +Z)
 *   +X = patient's LEFT (so in an anterior view the patient's left is on the viewer's right)
 *   x = 0 is the median plane; z is centred on the body's bounding box
 * GLB nodes carry no transform except the shared dequantization transform written by
 * KHR_mesh_quantization (quantizationVolume 'scene'); decodeGlb applies it, so every LoadedNode geometry
 * is in this space.
 */

/** Languages that can occur in the data. Only those listed in `Manifest.languages` are actually present. */
export type Lang = 'la' | 'en' | 'de' | 'fr' | 'es' | 'pt';

/** English is always present (it is the canonical name in Z-Anatomy); every other language is optional. */
export type Names = { en: string } & Partial<Record<Lang, string>>;

export type Vec3 = [number, number, number];

/** Map keyed by system id (index signature, so lookups are `T | undefined` under noUncheckedIndexedAccess). */
export type BySystem<T> = { [systemId: string]: T };

export interface BBox {
  min: Vec3;
  max: Vec3;
}

/**
 * Side of the body, from the patient's perspective.
 * Derived only from the source data: the `.l` / `.r` name suffix, or a name that states the side
 * ("Left ventricle", "… of right kidney"). Structures without that information have no `side`;
 * we do NOT guess "midline" from geometry.
 */
export type Side = 'left' | 'right';

/** How `side` was determined (for QA / reviewers). */
export type SideSource = 'suffix' | 'name';

// ---------------------------------------------------------------------------------------------
// Manifest (public/models/manifest.json) — loaded at startup, must stay small
// ---------------------------------------------------------------------------------------------

export interface Manifest {
  schemaVersion: 1;
  generatedAt: string;
  appDataVersion: string; // content hash of the asset build; used for cache busting
  source: { name: 'Z-Anatomy'; url: string; license: 'CC BY-SA 4.0' };
  /** Languages that actually occur in structure names (e.g. ['en','la','fr','es','pt']). */
  languages: Lang[];
  units: 'm';
  /** Bounding box of all exported geometry, in normalized coordinates. Used for clipping sliders and camera limits. */
  bodyBounds: BBox;
  systems: SystemInfo[];
  regions: RegionInfo[];
  /** Attribution / licence records referenced by `Structure.attribution`. Key = short id. */
  attributions: Record<string, AttributionInfo>;
  /** Relative to the manifest. Small file with names only, loaded at startup. */
  searchIndexFile: string;
}

export interface ChunkInfo {
  file: string; // relative to the manifest, e.g. "skeletal.glb" or "muscular-lower-limb.glb"
  bytes: number;
  region?: string; // set when a system had to be split by region (> 20 MB)
  structureCount: number;
  triangleCount: number;
}

export interface SystemInfo {
  id: SystemId;
  /** Names from the source data (en always; la/fr/es/pt when present). German UI labels live in i18n. */
  names: Names;
  /** Representative hex colour (sRGB) for the UI colour chip. Per-structure colours are in Structure.color. */
  color: string;
  /** Render/transparency order: 0 = innermost … highest = outermost (skin). See ARCHITECTURE.md §Transparency. */
  layerOrder: number;
  defaultVisible: boolean;
  defaultOpacity: number; // 0..1
  chunks: ChunkInfo[];
  /** Relative to the manifest. Structures, groups and landmarks of this system. */
  structuresFile: string;
  /** Relative to the manifest. Definitions, loaded on demand by the info panel. */
  definitionsFile?: string;
  structureCount: number;
  triangleCount: number;
}

/**
 * System ids produced by the pipeline from the Z-Anatomy top-level collections.
 * `string & {}` keeps the type open for future systems while giving autocompletion.
 */
export type SystemId =
  | 'skeletal'
  | 'insertions'
  | 'joints'
  | 'muscular'
  | 'cardiovascular'
  | 'lymphoid'
  | 'nervous'
  | 'visceral'
  | 'regions'
  | (string & {});

export interface RegionInfo {
  id: string; // e.g. 'head', 'neck', 'thorax', 'upper-limb' (side-agnostic; side is a separate attribute)
  names: Names;
  parentId?: string; // e.g. 'thorax' → 'trunk'
}

export interface AttributionInfo {
  /** Human-readable attribution line exactly as required upstream. */
  text: string;
  license: string; // SPDX-like, e.g. 'CC-BY-SA-4.0', 'CC-BY-NC-SA-4.0'
  licenseUrl: string;
  url?: string;
  nonCommercial?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Per-system file (public/models/structures/<system>.json) — loaded when the system is first needed
// ---------------------------------------------------------------------------------------------

export interface SystemStructuresFile {
  schemaVersion: 1;
  system: SystemId;
  structures: Structure[];
  groups: GroupNode[];
  landmarks: Landmark[];
}

/**
 * Kind of a structure with geometry.
 * - 'structure': an anatomical structure (bone, muscle, vessel, organ, skin region …)
 * - 'origin' / 'insertion': muscle attachment patch on a bone (Z-Anatomy ".o"/".e" objects, system 'insertions')
 */
export type StructureKind = 'structure' | 'origin' | 'insertion';

/** A pickable thing with geometry. Exactly one GLB node per structure. */
export interface Structure {
  /** Stable, URL-safe, globally unique (across structures, groups and landmarks). Format: ARCHITECTURE.md §Ids. */
  id: string;
  kind: StructureKind;
  /** Node name inside the GLB chunk (== id). */
  nodeName: string;
  chunk: string; // ChunkInfo.file
  system: SystemId;
  regions: string[]; // RegionInfo.id; empty when the source has no region information
  side?: Side;
  sideSource?: SideSource;
  /** Counterpart on the other side (left ↔ right). */
  pairId?: string;
  /** Parent in the hierarchy tree: a GroupNode id or another Structure id (e.g. a vessel branch). */
  parentId?: string;
  names: Names;
  synonyms?: string[];
  /** Not present in Z-Anatomy; kept for a possible future TA2 mapping (see ARCHITECTURE.md §Deviations). */
  taId?: string;
  fmaId?: string;
  /** Key into the system's definitions file. Left/right pairs usually share one definition. */
  definitionKey?: string;
  /** For origin/insertion patches: the muscle and the bone they connect. */
  muscleId?: string;
  boneId?: string;
  /** sRGB hex base colour from the source material. */
  color: string;
  centroid: Vec3;
  bbox: BBox;
  /** Point on/near the surface where a leader line should end (from the Z-Anatomy label line when available). */
  labelAnchor?: Vec3;
  triangles: number;
  /** Key into Manifest.attributions. */
  attribution: string;
  license: string; // e.g. 'CC-BY-SA-4.0'
  nonCommercial?: boolean;
}

/** A node of the hierarchy tree without its own geometry (Z-Anatomy ".g" objects, e.g. "Bones of lower limb"). */
export interface GroupNode {
  id: string;
  system: SystemId;
  names: Names;
  parentId?: string;
  definitionKey?: string;
}

/**
 * A named point on a structure without its own geometry (Z-Anatomy labels that point at a feature,
 * e.g. "Greater trochanter" on the femur). Searchable and pinnable, but not clickable in 3D.
 */
export interface Landmark {
  id: string;
  system: SystemId;
  structureId: string; // the structure the feature belongs to
  names: Names;
  side?: Side;
  /** Point on the structure surface (end of the leader line). */
  anchor: Vec3;
  definitionKey?: string;
}

/** Union used wherever "the selected thing" can be any node. */
export type AtlasNode =
  | ({ nodeType: 'structure' } & Structure)
  | ({ nodeType: 'group' } & GroupNode)
  | ({ nodeType: 'landmark' } & Landmark);

// ---------------------------------------------------------------------------------------------
// Definitions (public/models/definitions/<system>.json) — loaded on demand
// ---------------------------------------------------------------------------------------------

export interface Definition {
  text: Partial<Record<Lang, string>>;
  /** Human-readable source, e.g. 'Wikipedia' or 'Z-Anatomy'. */
  source: string;
  sourceUrl?: string;
  license: string; // 'CC-BY-SA-3.0' for Wikipedia
  /** false until a human reviewer has checked it (see CONTRIBUTING.md). */
  reviewed: boolean;
  /** Set when the text was machine-translated upstream. */
  machineTranslated?: boolean;
}

export interface DefinitionsFile {
  schemaVersion: 1;
  system: SystemId;
  definitions: Record<string, Definition>;
}

// ---------------------------------------------------------------------------------------------
// Search index (public/models/search-index.json) — names only, loaded at startup
// ---------------------------------------------------------------------------------------------

export type SearchEntryType = 'structure' | 'group' | 'landmark';

export interface SearchEntry {
  id: string;
  type: SearchEntryType;
  system: SystemId;
  names: Names;
  synonyms?: string[];
  side?: Side;
}

export interface SearchIndexFile {
  schemaVersion: 1;
  entries: SearchEntry[];
}
