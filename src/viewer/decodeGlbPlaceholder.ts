import type { GlbDecoder } from '@/contract';

/** Phase 0 placeholder. Agent B implements GLB decoding (GLTFLoader + MeshoptDecoder). */
export const decodeGlb: GlbDecoder = async (_buffer, file) => {
  throw new Error(`decodeGlb not implemented yet (${file})`);
};
