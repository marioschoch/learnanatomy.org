/**
 * Data source that reads the pipeline output from public/models/.
 * GLB decoding is injected by the viewer (src/viewer/loading/), so three.js loader code stays there.
 */
import type {
  AtlasDataSource,
  DefinitionsFile,
  GlbDecoder,
  Manifest,
  SearchIndexFile,
  SystemStructuresFile,
} from '@/contract';

export interface HttpDataSourceOptions {
  /** Directory URL that contains manifest.json, with trailing slash. */
  baseUrl: string;
  decodeGlb: GlbDecoder;
  fetchImpl?: typeof fetch;
}

export function createHttpDataSource(opts: HttpDataSourceOptions): AtlasDataSource {
  const doFetch = opts.fetchImpl ?? fetch.bind(globalThis);
  let version = '';
  const url = (file: string) => `${opts.baseUrl}${file}${version ? `?v=${encodeURIComponent(version)}` : ''}`;

  async function getJson<T>(file: string): Promise<T> {
    const res = await doFetch(url(file));
    if (!res.ok) throw new Error(`Failed to load ${file}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    kind: 'http',
    async loadManifest() {
      const res = await doFetch(`${opts.baseUrl}manifest.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Failed to load manifest.json: HTTP ${res.status}`);
      const manifest = (await res.json()) as Manifest;
      if (manifest.schemaVersion !== 1)
        throw new Error(`Unsupported manifest schemaVersion ${manifest.schemaVersion}`);
      version = manifest.appDataVersion;
      return manifest;
    },
    loadSearchIndex(manifest) {
      return getJson<SearchIndexFile>(manifest.searchIndexFile);
    },
    loadStructures(system) {
      return getJson<SystemStructuresFile>(system.structuresFile);
    },
    loadDefinitions(system) {
      if (!system.definitionsFile)
        return Promise.resolve({ schemaVersion: 1, system: system.id, definitions: {} });
      return getJson<DefinitionsFile>(system.definitionsFile);
    },
    async loadChunk(_system, chunk, onProgress, signal) {
      const init: RequestInit = signal ? { signal } : {};
      const res = await doFetch(url(chunk.file), init);
      if (!res.ok) throw new Error(`Failed to load ${chunk.file}: HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || chunk.bytes;
      let buffer: ArrayBuffer;
      if (res.body && onProgress) {
        const reader = res.body.getReader();
        const parts: Uint8Array[] = [];
        let loaded = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          loaded += value.byteLength;
          onProgress({ loadedBytes: loaded, totalBytes: Math.max(total, loaded) });
        }
        const out = new Uint8Array(loaded);
        let offset = 0;
        for (const p of parts) {
          out.set(p, offset);
          offset += p.byteLength;
        }
        buffer = out.buffer;
      } else {
        buffer = await res.arrayBuffer();
      }
      const nodes = await opts.decodeGlb(buffer, chunk.file);
      return { file: chunk.file, nodes };
    },
  };
}
