import type { GlbDecoder } from '@/contract';

/**
 * GlbDecoder injected into the HTTP data source (src/state/bootstrap.ts). The implementation (GLTFLoader +
 * MeshoptDecoder) is imported on first use, keeping loader code out of the main bundle.
 */
export const decodeGlb: GlbDecoder = async (buffer, file) => {
  const { decodeGlbImpl } = await import('./loading/decodeGlbImpl');
  return decodeGlbImpl(buffer, file);
};
