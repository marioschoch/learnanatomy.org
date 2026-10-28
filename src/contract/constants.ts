/**
 * Shared constants. OWNER: lead.
 */

/** Rendered opacity of outer layers while X-ray is on (the innermost visible layer stays as set). */
export const XRAY_OPACITY = 0.25;

/** Rendered opacity of non-isolated structures in "isolate with context". */
export const GHOST_OPACITY = 0.08;

/** Structures rendered below this opacity are not pickable. */
export const PICK_MIN_OPACITY = 0.05;

/** Every published file must stay below this size (Cloudflare Pages limit is 25 MiB). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Key of a system's root entries in `AtlasState.childrenOf`. */
export function systemRootKey(systemId: string): string {
  return `@${systemId}`;
}

/** Key of a definition in `AtlasState.definitions`. */
export function definitionStoreKey(systemId: string, definitionKey: string): string {
  return `${systemId}/${definitionKey}`;
}
