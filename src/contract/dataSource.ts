/**
 * Where the app gets its data from. Two implementations exist:
 *  - HTTP (src/state/httpDataSource.ts): reads public/models/ produced by the pipeline
 *  - Mock (src/mocks/mockDataSource.ts): ~30 primitive structures generated in memory
 *
 * OWNER: lead.
 */
import type { BufferGeometry } from 'three';
import type {
  ChunkInfo,
  DefinitionsFile,
  Manifest,
  SearchIndexFile,
  SystemInfo,
  SystemStructuresFile,
} from './anatomy';

/** One GLB node, ready to be added to a BatchedMesh. Geometry is in normalized body space (identity transform). */
export interface LoadedNode {
  nodeName: string;
  geometry: BufferGeometry;
}

export interface LoadedChunk {
  file: string;
  nodes: LoadedNode[];
}

export interface LoadProgress {
  loadedBytes: number;
  totalBytes: number; // ChunkInfo.bytes when the server does not send Content-Length
}

export interface AtlasDataSource {
  readonly kind: 'http' | 'mock';
  loadManifest(): Promise<Manifest>;
  loadSearchIndex(manifest: Manifest): Promise<SearchIndexFile>;
  loadStructures(system: SystemInfo): Promise<SystemStructuresFile>;
  loadDefinitions(system: SystemInfo): Promise<DefinitionsFile>;
  /**
   * Download + decode one GLB chunk. The viewer owns the returned geometries (and must dispose them).
   * `signal` aborts the download.
   */
  loadChunk(
    system: SystemInfo,
    chunk: ChunkInfo,
    onProgress?: (p: LoadProgress) => void,
    signal?: AbortSignal,
  ): Promise<LoadedChunk>;
}

/**
 * Function that turns a GLB ArrayBuffer into LoadedNodes. Implemented by the viewer
 * (src/viewer/loading/) and injected into the HTTP data source, so that three.js loader code lives
 * with the viewer.
 */
export type GlbDecoder = (buffer: ArrayBuffer, file: string) => Promise<LoadedNode[]>;
