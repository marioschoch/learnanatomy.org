/**
 * Keeps the URL in sync with the shareable state (ARCHITECTURE.md §7):
 *  1. once the manifest + search index are loaded, the URL is decoded and applied
 *     (camera via a viewer command; a selection without camera is focused),
 *  2. afterwards every change is written back with history.replaceState, debounced 300 ms,
 *     only non-default values, and never during a quiz.
 */
import type { BySystem, CameraPose, LayerState, Manifest, ShareableState } from '@/contract';
import { useAtlasStore } from '@/state';
import { nameLangOptions } from './labels';
import {
  camerasEqual,
  decodeShareableState,
  encodeShareableState,
  hasUrlState,
  mergeSearch,
  type UrlDecodeContext,
} from './urlState';

const DEBOUNCE_MS = 300;

let started = false;
let writing = false;
/** Camera from the URL until the viewer has applied it (the store only learns it when the camera rests). */
let pendingCamera: CameraPose | null = null;
/** First camera pose reported without a camera in the URL — treated as the default (not written). */
let homeCamera: CameraPose | null = null;
let urlHadCamera = false;

export function defaultLayersOf(manifest: Manifest | null): BySystem<LayerState> {
  const out: BySystem<LayerState> = {};
  for (const s of manifest?.systems ?? [])
    out[s.id] = { visible: s.defaultVisible, opacity: s.defaultOpacity };
  return out;
}

function decodeContext(): UrlDecodeContext {
  const s = useAtlasStore.getState();
  const known = new Set(s.searchIndex.map((e) => e.id));
  return {
    layers: defaultLayersOf(s.manifest),
    hiddenIds: s.manifest?.defaultHiddenIds ?? [],
    nameLangs: nameLangOptions(s.manifest),
    isKnownId: (id) => known.has(id) || id in s.structures || id in s.groups || id in s.landmarks,
  };
}

function shareableNow(): ShareableState {
  const state = useAtlasStore.getState().getShareableState();
  return pendingCamera ? { ...state, camera: pendingCamera } : state;
}

/** Search string for the current state, keeping unrelated parameters. */
export function currentSearch(): string {
  const manifest = useAtlasStore.getState().manifest;
  const encoded = encodeShareableState(shareableNow(), {
    layers: defaultLayersOf(manifest),
    hiddenIds: manifest?.defaultHiddenIds ?? [],
    camera: urlHadCamera ? null : homeCamera,
  });
  return mergeSearch(window.location.search, encoded);
}

/** Absolute link that reproduces the current view (used by "Copy link"). */
export function currentShareUrl(): string {
  return `${window.location.origin}${window.location.pathname}${currentSearch()}${window.location.hash}`;
}

function writeUrl() {
  if (!writing || useAtlasStore.getState().mode === 'quiz') return;
  const next = currentSearch();
  if (next !== window.location.search) {
    try {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${next}${window.location.hash}`,
      );
    } catch {
      // ignore (e.g. sandboxed iframes)
    }
  }
}

async function applyFromUrl(): Promise<void> {
  const search = window.location.search;
  if (!hasUrlState(search)) return;
  const decoded = decodeShareableState(search, decodeContext());
  const { camera, ...rest } = decoded;
  const s = useAtlasStore.getState();
  await s.applyShareableState(rest);
  if (camera) {
    urlHadCamera = true;
    pendingCamera = camera;
    void s.requestViewer({ type: 'setCameraPose', pose: camera, animate: false }).then(() => {
      pendingCamera = null;
    });
  } else if (decoded.selectedId) {
    void s.requestViewer({ type: 'focus', ids: [decoded.selectedId], animate: false });
  }
}

/**
 * Start URL sync once per page (idempotent; safe under StrictMode). Returns a stop function for tests.
 */
export function startUrlSync(): () => void {
  if (started) return () => {};
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubs: (() => void)[] = [];

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(writeUrl, DEBOUNCE_MS);
  };

  const begin = async () => {
    try {
      await applyFromUrl();
    } finally {
      writing = true;
      unsubs.push(
        useAtlasStore.subscribe(
          (s) =>
            [
              s.selectedId,
              s.layers,
              s.hiddenIds,
              s.isolate,
              s.clipping,
              s.explode,
              s.xray,
              s.camera,
              s.nameLang,
              s.pinnedIds,
              s.mode,
            ] as const,
          schedule,
          { equalityFn: (a, b) => a.every((v, i) => v === b[i]) },
        ),
        useAtlasStore.subscribe(
          (s) => s.camera,
          (cam) => {
            if (cam && !homeCamera && !urlHadCamera) homeCamera = cam;
            if (cam && pendingCamera && camerasEqual(cam, pendingCamera)) pendingCamera = null;
          },
        ),
      );
      schedule();
    }
  };

  if (useAtlasStore.getState().dataStatus === 'loaded') void begin();
  else {
    const unsub = useAtlasStore.subscribe(
      (s) => s.dataStatus,
      (status) => {
        if (status === 'loaded') {
          unsub();
          void begin();
        }
      },
    );
    unsubs.push(unsub);
  }

  return () => {
    clearTimeout(timer);
    unsubs.forEach((u) => u());
    started = false;
    writing = false;
    pendingCamera = null;
    homeCamera = null;
    urlHadCamera = false;
  };
}
