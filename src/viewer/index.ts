/**
 * Public API of the viewer. OWNER: Agent B.
 *   - Viewer: the full-screen 3D view (no props, driven only by the store; canvas code is lazy-loaded)
 *   - decodeGlb: GlbDecoder injected into the HTTP data source (GLTFLoader + MeshoptDecoder, lazy-loaded)
 */
export { Viewer } from './Viewer';
export { decodeGlb } from './decodeGlb';
