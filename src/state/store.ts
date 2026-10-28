/**
 * Minimal but complete implementation of the AtlasStore contract (src/contract/store.ts).
 * OWNER: lead. Agents use the actions; changes go through the lead.
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { definitionStoreKey, systemRootKey } from '@/contract';
import type {
  AtlasDataSource,
  AtlasState,
  AtlasStore,
  BySystem,
  ClipPlaneState,
  LayerState,
  Manifest,
  PlaneAxis,
  ShareableState,
  SystemId,
  SystemLoadState,
  UiLang,
  ViewerCommandResult,
} from '@/contract';
import { selectNode, systemOfNode } from './selectors';

const AXES: PlaneAxis[] = ['sagittal', 'coronal', 'transverse'];

function defaultClipping(): Record<PlaneAxis, ClipPlaneState> {
  return {
    sagittal: { enabled: false, position: 0.5, flipped: false },
    coronal: { enabled: false, position: 0.5, flipped: false },
    transverse: { enabled: false, position: 0.5, flipped: false },
  };
}

function defaultLayers(manifest: Manifest | null): BySystem<LayerState> {
  const out: BySystem<LayerState> = {};
  for (const sys of manifest?.systems ?? [])
    out[sys.id] = { visible: sys.defaultVisible, opacity: sys.defaultOpacity };
  return out;
}

function detectUiLang(): UiLang {
  try {
    const langs = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
    return langs.some((l) => l?.toLowerCase().startsWith('de')) ? 'de' : 'en';
  } catch {
    return 'en';
  }
}

function detectReducedMotion(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const idleLoad = (): SystemLoadState => ({ meta: 'idle', geometry: 'idle', progress: 0 });

export function initialState(): AtlasState {
  return {
    dataSource: null,
    dataStatus: 'idle',
    dataError: null,
    manifest: null,
    searchIndex: [],
    structures: {},
    groups: {},
    landmarks: {},
    childrenOf: {},
    structureIdsBySystem: {},
    systemLoad: {},
    definitions: {},
    definitionsStatus: {},

    layers: {},
    hiddenIds: {},
    xray: false,

    selectedId: null,
    hoveredId: null,
    pinnedIds: [],
    isolate: { mode: 'none', ids: [], cameraBefore: null },
    highlights: {},

    clipping: defaultClipping(),
    explode: 0,
    labelsVisible: true,

    camera: null,
    viewerReady: false,
    viewerQueue: [],
    viewerStats: null,

    mode: 'explore',
    quizPick: { id: null, seq: 0 },
    uiLang: detectUiLang(),
    nameLang: 'la',
    theme: 'system',
    reducedMotion: detectReducedMotion(),
  };
}

// In-flight promises / pending viewer commands live outside the reactive state.
const metaInFlight = new Map<SystemId, Promise<void>>();
const defsInFlight = new Map<SystemId, Promise<void>>();
const pendingViewer = new Map<number, (r: ViewerCommandResult) => void>();
let viewerSeq = 0;

export const useAtlasStore = create<AtlasStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState(),

    // ------------------------------------------------------------------ data
    async init(dataSource: AtlasDataSource) {
      set({ dataSource, dataStatus: 'loading', dataError: null });
      try {
        const manifest = await dataSource.loadManifest();
        const index = await dataSource.loadSearchIndex(manifest);
        const systemLoad: BySystem<SystemLoadState> = {};
        for (const sys of manifest.systems) systemLoad[sys.id] = idleLoad();
        set({
          manifest,
          searchIndex: index.entries,
          layers: defaultLayers(manifest),
          systemLoad,
          dataStatus: 'loaded',
        });
        await Promise.all(
          manifest.systems.filter((s) => s.defaultVisible).map((s) => get().ensureSystemMeta(s.id)),
        );
      } catch (e) {
        set({ dataStatus: 'error', dataError: e instanceof Error ? e.message : String(e) });
      }
    },

    ensureSystemMeta(systemId) {
      const { manifest, dataSource, systemLoad } = get();
      const sys = manifest?.systems.find((s) => s.id === systemId);
      if (!sys || !dataSource) return Promise.resolve();
      if (systemLoad[systemId]?.meta === 'loaded') return Promise.resolve();
      const inflight = metaInFlight.get(systemId);
      if (inflight) return inflight;

      const patchLoad = (patch: Partial<SystemLoadState>) =>
        set((s) => ({
          systemLoad: {
            ...s.systemLoad,
            [systemId]: { ...(s.systemLoad[systemId] ?? idleLoad()), ...patch },
          },
        }));

      patchLoad({ meta: 'loading' });
      const p = dataSource
        .loadStructures(sys)
        .then((file) => {
          set((s) => {
            const structures = { ...s.structures };
            const groups = { ...s.groups };
            const landmarks = { ...s.landmarks };
            const childrenOf = { ...s.childrenOf };
            const push = (parent: string, child: string) => {
              childrenOf[parent] = [...(childrenOf[parent] ?? []), child];
            };
            for (const g of file.groups) {
              groups[g.id] = g;
              push(g.parentId ?? systemRootKey(systemId), g.id);
            }
            for (const st of file.structures) {
              structures[st.id] = st;
              push(st.parentId ?? systemRootKey(systemId), st.id);
            }
            for (const l of file.landmarks) landmarks[l.id] = l;
            return {
              structures,
              groups,
              landmarks,
              childrenOf,
              structureIdsBySystem: {
                ...s.structureIdsBySystem,
                [systemId]: file.structures.map((st) => st.id),
              },
            };
          });
          patchLoad({ meta: 'loaded' });
        })
        .catch((e: unknown) => {
          patchLoad({ meta: 'error', error: e instanceof Error ? e.message : String(e) });
        })
        .finally(() => metaInFlight.delete(systemId));
      metaInFlight.set(systemId, p);
      return p;
    },

    async ensureNodeMeta(id) {
      const existing = selectNode(get(), id);
      if (existing) return existing;
      const system = systemOfNode(get(), id);
      if (!system) return null;
      await get().ensureSystemMeta(system);
      return selectNode(get(), id);
    },

    ensureDefinitions(systemId) {
      const { manifest, dataSource, definitionsStatus } = get();
      const sys = manifest?.systems.find((s) => s.id === systemId);
      if (!sys?.definitionsFile || !dataSource) return Promise.resolve();
      if (definitionsStatus[systemId] === 'loaded') return Promise.resolve();
      const inflight = defsInFlight.get(systemId);
      if (inflight) return inflight;
      set((s) => ({ definitionsStatus: { ...s.definitionsStatus, [systemId]: 'loading' } }));
      const p = dataSource
        .loadDefinitions(sys)
        .then((file) => {
          set((s) => {
            const definitions = { ...s.definitions };
            for (const [key, def] of Object.entries(file.definitions))
              definitions[definitionStoreKey(systemId, key)] = def;
            return { definitions, definitionsStatus: { ...s.definitionsStatus, [systemId]: 'loaded' } };
          });
        })
        .catch(() => {
          set((s) => ({ definitionsStatus: { ...s.definitionsStatus, [systemId]: 'error' } }));
        })
        .finally(() => defsInFlight.delete(systemId));
      defsInFlight.set(systemId, p);
      return p;
    },

    setGeometryStatus(systemId, status, progress, error) {
      set((s) => {
        const prev = s.systemLoad[systemId] ?? idleLoad();
        const next: SystemLoadState = {
          ...prev,
          geometry: status,
          progress: progress ?? (status === 'loaded' ? 1 : prev.progress),
        };
        if (error !== undefined) next.error = error;
        return { systemLoad: { ...s.systemLoad, [systemId]: next } };
      });
    },

    // ------------------------------------------------------------------ layers
    setLayerVisible(systemId, visible) {
      set((s) => ({
        layers: { ...s.layers, [systemId]: { ...(s.layers[systemId] ?? { opacity: 1 }), visible } },
      }));
      if (visible) void get().ensureSystemMeta(systemId);
    },

    setLayerOpacity(systemId, opacity) {
      set((s) => ({
        layers: {
          ...s.layers,
          [systemId]: { ...(s.layers[systemId] ?? { visible: true }), opacity: clamp01(opacity) },
        },
      }));
    },

    applyLayerPreset(preset) {
      const { manifest } = get();
      const layers: BySystem<LayerState> = {};
      for (const sys of manifest?.systems ?? []) {
        const p = preset[sys.id];
        layers[sys.id] = {
          visible: p?.visible ?? Boolean(p),
          opacity: clamp01(p?.opacity ?? sys.defaultOpacity),
        };
      }
      set({ layers });
      for (const [id, l] of Object.entries(layers)) if (l.visible) void get().ensureSystemMeta(id);
    },

    resetLayers() {
      set({ layers: defaultLayers(get().manifest), hiddenIds: {}, xray: false });
    },

    setNodeHidden(id, hidden) {
      set((s) => {
        const hiddenIds = { ...s.hiddenIds };
        if (hidden) hiddenIds[id] = true;
        else delete hiddenIds[id];
        return { hiddenIds };
      });
    },

    showAllNodes() {
      set({ hiddenIds: {} });
    },

    setXray(on) {
      set({ xray: on });
    },

    // ------------------------------------------------------------------ selection
    select(id) {
      set({ selectedId: id });
      if (id) void get().ensureNodeMeta(id);
    },

    async selectAndFocus(id) {
      const node = await get().ensureNodeMeta(id);
      if (!node) return;
      const system = node.system;
      if (!get().layers[system]?.visible && get().isolate.mode === 'none')
        get().setLayerVisible(system, true);
      if (get().hiddenIds[id]) get().setNodeHidden(id, false);
      set({ selectedId: id });
      await get().requestViewer({ type: 'focus', ids: [id], animate: !get().reducedMotion });
    },

    setHovered(id) {
      if (get().hoveredId !== id) set({ hoveredId: id });
    },

    pickStructure(id) {
      if (get().mode === 'quiz') {
        set((s) => ({ quizPick: { id, seq: s.quizPick.seq + 1 } }));
      } else {
        get().select(id);
      }
    },

    togglePinned(id) {
      set((s) => ({
        pinnedIds: s.pinnedIds.includes(id) ? s.pinnedIds.filter((p) => p !== id) : [...s.pinnedIds, id],
      }));
    },

    clearPinned() {
      set({ pinnedIds: [] });
    },

    setIsolate(mode, ids) {
      const target = ids ?? (get().selectedId ? [get().selectedId!] : []);
      if (target.length === 0) return;
      set((s) => ({
        isolate: {
          mode,
          ids: target,
          cameraBefore: s.isolate.mode === 'none' ? s.camera : s.isolate.cameraBefore,
        },
      }));
      for (const id of target) void get().ensureNodeMeta(id);
    },

    exitIsolate() {
      const before = get().isolate.cameraBefore;
      set({ isolate: { mode: 'none', ids: [], cameraBefore: null } });
      if (before)
        void get().requestViewer({ type: 'setCameraPose', pose: before, animate: !get().reducedMotion });
    },

    setHighlights(highlights) {
      set({ highlights });
    },

    // ------------------------------------------------------------------ tools
    setClipPlane(axis, patch) {
      set((s) => {
        const next = { ...s.clipping[axis], ...patch };
        next.position = clamp01(next.position);
        return { clipping: { ...s.clipping, [axis]: next } };
      });
    },

    resetClipping() {
      set({ clipping: defaultClipping() });
    },

    setExplode(value) {
      set({ explode: clamp01(value) });
    },

    setLabelsVisible(on) {
      set({ labelsVisible: on });
    },

    // ------------------------------------------------------------------ viewer bridge
    requestViewer(command) {
      const id = ++viewerSeq;
      return new Promise<ViewerCommandResult>((resolve) => {
        pendingViewer.set(id, resolve);
        set((s) => ({ viewerQueue: [...s.viewerQueue, { id, command }] }));
      });
    },

    completeViewerCommand(id, result) {
      pendingViewer.get(id)?.(result);
      pendingViewer.delete(id);
      set((s) => ({ viewerQueue: s.viewerQueue.filter((c) => c.id !== id) }));
    },

    cancelViewerCommands(reason) {
      for (const { id, command } of get().viewerQueue) {
        pendingViewer.get(id)?.({ ok: false, type: command.type, error: reason });
        pendingViewer.delete(id);
      }
      set({ viewerQueue: [] });
    },

    setViewerReady(ready) {
      set({ viewerReady: ready });
    },

    setCamera(pose) {
      set({ camera: pose });
    },

    setViewerStats(stats) {
      set({ viewerStats: stats });
    },

    // ------------------------------------------------------------------ app / ui
    setMode(mode) {
      set({ mode, hoveredId: null, quizPick: { id: null, seq: get().quizPick.seq } });
    },
    setUiLang(uiLang) {
      set({ uiLang });
    },
    setNameLang(nameLang) {
      set({ nameLang });
    },
    setTheme(theme) {
      set({ theme });
    },
    setReducedMotion(reducedMotion) {
      set({ reducedMotion });
    },

    // ------------------------------------------------------------------ URL state
    getShareableState(): ShareableState {
      const s = get();
      return {
        selectedId: s.selectedId,
        layers: s.layers,
        hiddenIds: Object.keys(s.hiddenIds),
        isolate: { mode: s.isolate.mode, ids: s.isolate.ids },
        clipping: s.clipping,
        explode: s.explode,
        xray: s.xray,
        camera: s.camera,
        nameLang: s.nameLang,
        pinnedIds: s.pinnedIds,
      };
    },

    async applyShareableState(u) {
      const s = get();
      const patch: Partial<AtlasState> = {};
      if (u.layers) {
        const layers = { ...defaultLayers(s.manifest) };
        for (const [id, l] of Object.entries(u.layers)) {
          if (layers[id]) layers[id] = { visible: Boolean(l.visible), opacity: clamp01(l.opacity) };
        }
        patch.layers = layers;
      }
      if (u.hiddenIds) patch.hiddenIds = Object.fromEntries(u.hiddenIds.map((id) => [id, true as const]));
      if (u.clipping) {
        const clipping = defaultClipping();
        for (const axis of AXES) {
          const c = u.clipping[axis];
          if (c)
            clipping[axis] = {
              enabled: Boolean(c.enabled),
              position: clamp01(c.position),
              flipped: Boolean(c.flipped),
            };
        }
        patch.clipping = clipping;
      }
      if (u.explode !== undefined) patch.explode = clamp01(u.explode);
      if (u.xray !== undefined) patch.xray = u.xray;
      if (u.nameLang) patch.nameLang = u.nameLang;
      if (u.pinnedIds) patch.pinnedIds = u.pinnedIds;
      if (u.selectedId !== undefined) patch.selectedId = u.selectedId;
      if (u.isolate) {
        patch.isolate =
          u.isolate.mode === 'none' || u.isolate.ids.length === 0
            ? { mode: 'none', ids: [], cameraBefore: null }
            : { mode: u.isolate.mode, ids: u.isolate.ids, cameraBefore: null };
      }
      set(patch);

      const st = get();
      const systems = new Set<SystemId>();
      for (const [id, l] of Object.entries(st.layers)) if (l.visible) systems.add(id);
      const ids = [st.selectedId, ...st.isolate.ids, ...st.pinnedIds, ...Object.keys(st.hiddenIds)].filter(
        (x): x is string => Boolean(x),
      );
      for (const id of ids) {
        const sys = systemOfNode(st, id);
        if (sys) systems.add(sys);
      }
      await Promise.all([...systems].map((id) => get().ensureSystemMeta(id)));
      if (u.camera) await get().requestViewer({ type: 'setCameraPose', pose: u.camera, animate: false });
    },
  })),
);

/** Reset to the initial state (tests only). Keeps the action functions. */
export function resetAtlasStore(): void {
  metaInFlight.clear();
  defsInFlight.clear();
  pendingViewer.clear();
  useAtlasStore.setState(initialState());
}
