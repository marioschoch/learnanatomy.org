/**
 * Which structures get which highlight tint, derived from the store (pure, unit tested).
 * Groups and landmarks expand to their structures (structureIdsOfNode).
 * An isolated selection (plain isolate) keeps its own colours: it is all that is drawn besides its bones.
 */
import type { AtlasState } from '@/contract';
import { structureIdsOfNode } from '@/state';
import type { Tint } from './colors';

type TintState = Pick<
  AtlasState,
  'selectedId' | 'hoveredId' | 'highlights' | 'isolate' | 'structures' | 'groups' | 'landmarks' | 'childrenOf'
>;

export function computeTints(s: TintState): Map<string, Tint> {
  const out = new Map<string, Tint>();
  // Lowest priority first; later writes win: hover < selected < quiz/preview highlights.
  if (s.hoveredId) for (const id of structureIdsOfNode(s, s.hoveredId)) out.set(id, 'hover');
  const isolatedSelection = s.isolate.mode === 'isolate' && s.isolate.ids.includes(s.selectedId ?? '');
  if (s.selectedId && !isolatedSelection)
    for (const id of structureIdsOfNode(s, s.selectedId)) out.set(id, 'selected');
  for (const [id, kind] of Object.entries(s.highlights)) {
    for (const sid of structureIdsOfNode(s, id)) out.set(sid, kind);
  }
  return out;
}
