import type { AtlasDataSource } from '@/contract';
import {
  MOCK_STRUCTURES,
  mockDefinitionsFile,
  mockManifest,
  mockSearchEntries,
  mockStructuresFile,
} from './mockData';
import { buildMockGeometry } from './mockGeometry';

export interface MockDataSourceOptions {
  /** Artificial latency per request in ms (to exercise loading states). Default 0. */
  latencyMs?: number;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

export function createMockDataSource(opts: MockDataSourceOptions = {}): AtlasDataSource {
  const latency = opts.latencyMs ?? 0;
  return {
    kind: 'mock',
    async loadManifest() {
      await wait(latency);
      return mockManifest();
    },
    async loadSearchIndex() {
      await wait(latency);
      return { schemaVersion: 1, entries: mockSearchEntries() };
    },
    async loadStructures(system) {
      await wait(latency);
      return mockStructuresFile(system.id);
    },
    async loadDefinitions(system) {
      await wait(latency);
      return mockDefinitionsFile(system.id);
    },
    async loadChunk(system, chunk, onProgress, signal) {
      const specs = MOCK_STRUCTURES.filter((m) => m.system === system.id);
      const steps = 4;
      for (let i = 1; i <= steps; i++) {
        await wait(latency / steps, signal);
        onProgress?.({ loadedBytes: i, totalBytes: steps });
      }
      return {
        file: chunk.file,
        nodes: specs.map((spec) => ({ nodeName: spec.id, geometry: buildMockGeometry(spec) })),
      };
    },
  };
}
