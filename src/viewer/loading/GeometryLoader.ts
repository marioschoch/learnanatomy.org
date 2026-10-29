/**
 * Loads geometry for the systems the store needs (systemsNeedingGeometry) and hands chunks to the AtlasScene.
 *
 *  - lazy: a system is fetched the first time it is needed, then stays cached in the scene (toggling a layer
 *    only flips instance visibility; GPU resources are never re-created → no leaks)
 *  - progress per system (bytes across all its chunks) is reported with setGeometryStatus, throttled
 *  - structure metadata is loaded first (ensureSystemMeta): colours, centroids and ids come from it
 *  - failures are reported as 'error' and retried at most every RETRY_MS when the system is needed again
 */
import type { LoadedChunk, SystemId } from '@/contract';
import { useAtlasStore } from '@/state';
import type { AtlasScene } from '../core/AtlasScene';
import type { ChunkBatch } from '../core/ChunkBatch';

const RETRY_MS = 5000;
const PROGRESS_INTERVAL_MS = 120;
/** Share of the progress bar used by the download; the rest is decode + batch build. */
const DOWNLOAD_SHARE = 0.95;

export class GeometryLoader {
  private readonly requested = new Set<SystemId>();
  private readonly failedAt = new Map<SystemId, number>();
  private readonly controller = new AbortController();

  constructor(
    private readonly scene: AtlasScene,
    private readonly onBatch: (batch: ChunkBatch) => void,
  ) {}

  /** Systems requested so far (loaded, loading or failed-and-waiting). */
  get systems(): SystemId[] {
    return [...this.requested];
  }

  ensure(systemIds: readonly SystemId[]): void {
    const now = Date.now();
    for (const id of systemIds) {
      if (this.requested.has(id)) continue;
      const failed = this.failedAt.get(id);
      if (failed !== undefined && now - failed < RETRY_MS) continue;
      this.requested.add(id);
      void this.load(id);
    }
  }

  abort(): void {
    this.controller.abort();
  }

  private async load(systemId: SystemId): Promise<void> {
    const store = useAtlasStore.getState();
    store.setGeometryStatus(systemId, 'loading', 0);
    let lastReport = 0;
    try {
      await store.ensureSystemMeta(systemId);
      const st = useAtlasStore.getState();
      const sys = st.manifest?.systems.find((s) => s.id === systemId);
      const ds = st.dataSource;
      if (!sys || !ds) throw new Error(`unknown system ${systemId}`);
      const metaState = st.systemLoad[systemId];
      if (metaState?.meta === 'error') throw new Error(metaState.error ?? 'metadata failed to load');

      const totalBytes = sys.chunks.reduce((a, c) => a + Math.max(1, c.bytes), 0);
      const fraction = new Map<string, number>();
      const report = (force = false) => {
        const now = performance.now();
        if (!force && now - lastReport < PROGRESS_INTERVAL_MS) return;
        lastReport = now;
        let done = 0;
        for (const c of sys.chunks) done += (fraction.get(c.file) ?? 0) * Math.max(1, c.bytes);
        useAtlasStore.getState().setGeometryStatus(systemId, 'loading', (done / totalBytes) * DOWNLOAD_SHARE);
      };

      const signal = this.controller.signal;
      const chunks: LoadedChunk[] = await Promise.all(
        sys.chunks.map((chunk) =>
          ds.loadChunk(
            sys,
            chunk,
            (p) => {
              fraction.set(chunk.file, p.totalBytes > 0 ? Math.min(1, p.loadedBytes / p.totalBytes) : 0);
              report();
            },
            signal,
          ),
        ),
      );
      if (this.scene.isDisposed || signal.aborted) {
        for (const c of chunks) for (const n of c.nodes) n.geometry.dispose();
        return;
      }
      const latest = useAtlasStore.getState();
      const systemStructures = (latest.structureIdsBySystem[systemId] ?? [])
        .map((id) => latest.structures[id])
        .filter((s) => s !== undefined);
      for (const chunk of chunks) {
        if (this.scene.hasChunk(chunk.file)) continue;
        const batch = this.scene.addChunk(
          sys,
          chunk,
          latest.structures,
          systemStructures,
          latest.manifest?.regions ?? [],
        );
        this.onBatch(batch);
      }
      useAtlasStore.getState().setGeometryStatus(systemId, 'loaded', 1);
    } catch (e) {
      if (this.controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[viewer] loading ${systemId} failed:`, e);
      this.requested.delete(systemId);
      this.failedAt.set(systemId, Date.now());
      useAtlasStore.getState().setGeometryStatus(systemId, 'error', 0, message);
    }
  }
}
