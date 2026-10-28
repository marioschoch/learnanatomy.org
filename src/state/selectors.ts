import type { AtlasNode, AtlasState, BBox, Structure, SystemId, Vec3 } from '@/contract';

/** Any loaded node (structure, group or landmark) by id. */
export function selectNode(
  s: Pick<AtlasState, 'structures' | 'groups' | 'landmarks'>,
  id: string | null,
): AtlasNode | null {
  if (!id) return null;
  const st = s.structures[id];
  if (st) return { nodeType: 'structure', ...st };
  const g = s.groups[id];
  if (g) return { nodeType: 'group', ...g };
  const l = s.landmarks[id];
  if (l) return { nodeType: 'landmark', ...l };
  return null;
}

/** System of a node; falls back to the search index for nodes whose system is not loaded yet. */
export function systemOfNode(
  s: Pick<AtlasState, 'structures' | 'groups' | 'landmarks' | 'searchIndex'>,
  id: string,
): SystemId | null {
  const n = selectNode(s, id);
  if (n) return n.system;
  return s.searchIndex.find((e) => e.id === id)?.system ?? null;
}

/**
 * Structure ids a node stands for: a structure → itself + descendant structures; a group → all descendant
 * structures; a landmark → the structure it belongs to.
 */
export function structureIdsOfNode(
  s: Pick<AtlasState, 'structures' | 'groups' | 'landmarks' | 'childrenOf'>,
  id: string,
): string[] {
  const landmark = s.landmarks[id];
  if (landmark) return s.structures[landmark.structureId] ? [landmark.structureId] : [];
  const out: string[] = [];
  const stack = [id];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (s.structures[cur]) out.push(cur);
    const kids = s.childrenOf[cur];
    if (kids) stack.push(...kids);
  }
  return out;
}

/** Union bbox of structures (null when none are loaded). */
export function unionBBox(structures: Structure[]): BBox | null {
  if (structures.length === 0) return null;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const st of structures) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, st.bbox.min[i]!);
      max[i] = Math.max(max[i]!, st.bbox.max[i]!);
    }
  }
  return { min, max };
}

/** Ancestor chain of a node (nearest parent first). */
export function ancestorsOf(s: Pick<AtlasState, 'structures' | 'groups'>, id: string): string[] {
  const out: string[] = [];
  let cur = s.structures[id]?.parentId ?? s.groups[id]?.parentId;
  while (cur && !out.includes(cur)) {
    out.push(cur);
    cur = s.structures[cur]?.parentId ?? s.groups[cur]?.parentId;
  }
  return out;
}
