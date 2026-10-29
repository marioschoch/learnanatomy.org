/**
 * The app store interface (zustand). One store, typed, read with selectors:
 *   const selectedId = useAtlasStore((s) => s.selectedId);
 *
 * The implementation lives in src/state/store.ts. This file is the contract:
 *  - UI (Agent C) and viewer (Agent B) read state and call actions; they never set state directly.
 *  - Viewer-internal objects (BatchedMesh, geometries, id maps) are NOT in the store.
 *  - The quiz keeps its own store in src/quiz/ and talks to this one only through the actions below
 *    (setMode, setHighlights, setIsolate…, pickStructure → quizPick).
 *
 * OWNER: lead.
 */
import type {
  AtlasNode,
  BySystem,
  Definition,
  GroupNode,
  Landmark,
  Lang,
  Manifest,
  SearchEntry,
  Structure,
  SystemId,
} from './anatomy';
import type { AtlasDataSource } from './dataSource';
import type {
  CameraPose,
  QueuedViewerCommand,
  ViewerCommand,
  ViewerCommandResult,
  ViewerStats,
} from './viewerApi';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface SystemLoadState {
  /** structures/<system>.json */
  meta: LoadStatus;
  /** GLB chunk(s), loaded by the viewer */
  geometry: LoadStatus;
  /** 0..1 download progress of the geometry */
  progress: number;
  error?: string;
}

export interface LayerState {
  visible: boolean;
  /** 0..1, user setting. The rendered opacity may be lower (see xray, isolate-with-context). */
  opacity: number;
}

/** Anatomical planes. sagittal ⟂ x (left/right), coronal ⟂ z (front/back), transverse ⟂ y (up/down). */
export type PlaneAxis = 'sagittal' | 'coronal' | 'transverse';

export interface ClipPlaneState {
  enabled: boolean;
  /** 0..1 across Manifest.bodyBounds on the plane's axis (0 = min, 1 = max). */
  position: number;
  /**
   * false: keep the part with the larger coordinate (removes the right / posterior / inferior part).
   * true: keep the other part.
   */
  flipped: boolean;
}

export type IsolateMode = 'none' | 'isolate' | 'context';

export interface IsolateState {
  mode: IsolateMode;
  /** Structure / group ids; groups include all their descendants. */
  ids: string[];
  /** Camera pose before isolating; restored on exit. */
  cameraBefore: CameraPose | null;
}

/**
 * Extra highlight colours. 'selected' and 'hover' are derived from selectedId / hoveredId and must not be
 * set here. The quiz uses the 'quiz-*' kinds.
 */
export type HighlightKind = 'quiz-target' | 'quiz-correct' | 'quiz-wrong' | 'preview';

export type AppMode = 'explore' | 'quiz';
export type UiLang = 'de' | 'en';
export type ThemePref = 'light' | 'dark' | 'system';
/** Preferred language for anatomical names. Falls back Latin → English when missing; never translated. */
export type NameLang = Lang;

/** The part of the state encoded in the URL (format: ARCHITECTURE.md §URL state; codec in src/ui/). */
export interface ShareableState {
  selectedId: string | null;
  layers: BySystem<LayerState>;
  hiddenIds: string[];
  isolate: { mode: IsolateMode; ids: string[] };
  clipping: Record<PlaneAxis, ClipPlaneState>;
  explode: number;
  xray: boolean;
  camera: CameraPose | null;
  nameLang: NameLang;
  pinnedIds: string[];
}

export interface AtlasState {
  // ---------------------------------------------------------------- data
  dataSource: AtlasDataSource | null;
  dataStatus: LoadStatus;
  dataError: string | null;
  manifest: Manifest | null;
  searchIndex: SearchEntry[];
  /** All loaded structures / groups / landmarks by id (filled per system as systems load). */
  structures: Record<string, Structure>;
  groups: Record<string, GroupNode>;
  landmarks: Record<string, Landmark>;
  /**
   * Ordered child ids per parent id (group or structure). Roots of a system are under `systemRootKey(id)`
   * ('@<systemId>'). Built when a system loads. Landmarks are not part of the tree.
   */
  childrenOf: Record<string, string[]>;
  /** Structure ids per system (only for loaded systems). */
  structureIdsBySystem: BySystem<string[]>;
  systemLoad: BySystem<SystemLoadState>;
  /** Definitions by `${system}/${definitionKey}` once loaded. */
  definitions: Record<string, Definition>;
  definitionsStatus: BySystem<LoadStatus>;

  // ---------------------------------------------------------------- layers & visibility
  layers: BySystem<LayerState>;
  /** Per-node visibility override (tree checkboxes, "Hide"). A hidden group hides all descendants. */
  hiddenIds: Record<string, true>;
  /** Outer layers semi-transparent (see ARCHITECTURE.md §X-ray). Does not change `layers`. */
  xray: boolean;

  // ---------------------------------------------------------------- selection
  selectedId: string | null;
  hoveredId: string | null;
  pinnedIds: string[];
  isolate: IsolateState;
  highlights: Record<string, HighlightKind>;

  // ---------------------------------------------------------------- tools
  clipping: Record<PlaneAxis, ClipPlaneState>;
  /** 0 = assembled … 1 = fully exploded */
  explode: number;
  labelsVisible: boolean;

  // ---------------------------------------------------------------- camera / viewer
  /** Last camera pose reported by the viewer when the camera came to rest. */
  camera: CameraPose | null;
  viewerReady: boolean;
  viewerQueue: QueuedViewerCommand[];
  viewerStats: ViewerStats | null;

  // ---------------------------------------------------------------- app / ui
  mode: AppMode;
  /** Set by pickStructure while mode === 'quiz'; seq increments on every pick (also for repeated ids). */
  quizPick: { id: string | null; seq: number };
  uiLang: UiLang;
  nameLang: NameLang;
  theme: ThemePref;
  reducedMotion: boolean;
}

export interface AtlasActions {
  // ---------------------------------------------------------------- data
  /** Loads manifest + search index and applies manifest defaults. Call once at startup. */
  init(dataSource: AtlasDataSource): Promise<void>;
  /** Loads structures/<system>.json if needed. Resolves when metadata is in the store. */
  ensureSystemMeta(systemId: SystemId): Promise<void>;
  /** Loads the system containing `id` (looked up in the search index) if needed. */
  ensureNodeMeta(id: string): Promise<AtlasNode | null>;
  /** Loads definitions/<system>.json if needed. */
  ensureDefinitions(systemId: SystemId): Promise<void>;
  /** Viewer reports geometry load status for a system. */
  setGeometryStatus(systemId: SystemId, status: LoadStatus, progress?: number, error?: string): void;

  // ---------------------------------------------------------------- layers
  setLayerVisible(systemId: SystemId, visible: boolean): void;
  setLayerOpacity(systemId: SystemId, opacity: number): void;
  /** Replace several layers at once (presets). Systems not mentioned are hidden. */
  applyLayerPreset(layers: Partial<BySystem<Partial<LayerState>>>): void;
  /** Default layers, default-hidden nodes (Manifest.defaultHiddenIds), X-ray off. */
  resetLayers(): void;
  setNodeHidden(id: string, hidden: boolean): void;
  /** Shows every node the user hid; default-hidden nodes stay hidden. */
  showAllNodes(): void;
  setXray(on: boolean): void;

  // ---------------------------------------------------------------- selection
  /** Select (or clear with null). Does not move the camera. */
  select(id: string | null): void;
  /** Make the node's system visible, load it, select it and request a focus. */
  selectAndFocus(id: string): Promise<void>;
  setHovered(id: string | null): void;
  /** Called by the viewer on click/tap. Explore mode → select(id); quiz mode → quizPick. */
  pickStructure(id: string | null): void;
  togglePinned(id: string): void;
  clearPinned(): void;
  /** Isolate the given ids (default: current selection). Stores the camera pose for restore. */
  setIsolate(mode: Exclude<IsolateMode, 'none'>, ids?: string[]): void;
  /** Exit isolate; restores the previous visibility exactly (isolate never mutates layers/hiddenIds) and the camera. */
  exitIsolate(): void;
  setHighlights(highlights: Record<string, HighlightKind>): void;

  // ---------------------------------------------------------------- tools
  setClipPlane(axis: PlaneAxis, patch: Partial<ClipPlaneState>): void;
  resetClipping(): void;
  setExplode(value: number): void;
  setLabelsVisible(on: boolean): void;

  // ---------------------------------------------------------------- viewer bridge
  /** Queue a command for the viewer. Resolves with the viewer's result. */
  requestViewer(command: ViewerCommand): Promise<ViewerCommandResult>;
  /** Viewer only: report the result of a queued command and remove it from the queue. */
  completeViewerCommand(id: number, result: ViewerCommandResult): void;
  /** Reject all pending commands (e.g. viewer unmounted). */
  cancelViewerCommands(reason: string): void;
  setViewerReady(ready: boolean): void;
  /** Viewer only: camera came to rest. */
  setCamera(pose: CameraPose): void;
  setViewerStats(stats: ViewerStats | null): void;

  // ---------------------------------------------------------------- app / ui
  setMode(mode: AppMode): void;
  setUiLang(lang: UiLang): void;
  setNameLang(lang: NameLang): void;
  setTheme(theme: ThemePref): void;
  setReducedMotion(on: boolean): void;

  // ---------------------------------------------------------------- URL state
  getShareableState(): ShareableState;
  /** Apply a decoded URL state (loads needed systems, restores camera via a viewer command). */
  applyShareableState(state: Partial<ShareableState>): Promise<void>;
}

export type AtlasStore = AtlasState & AtlasActions;
