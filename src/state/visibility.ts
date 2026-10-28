/**
 * Pure rules that turn the store state into "what is drawn, how transparent, and what can be picked".
 * The viewer calls `buildVisibilityContext` once per relevant state change and then queries per structure.
 * Keep this the single source of truth (unit tested in visibility.test.ts).
 *
 * Rules (ARCHITECTURE.md §Visibility):
 *  1. A structure is drawn when its system layer is visible and neither it nor an ancestor is in hiddenIds.
 *  2. Isolate: only the isolated set (ids + descendants; landmark → its structure) is drawn, opaque,
 *     regardless of layer visibility or hiddenIds.
 *  3. Isolate with context: the isolated set is drawn opaque; everything that would be drawn under rule 1
 *     is drawn as a ghost (GHOST_OPACITY, desaturated, not pickable).
 *  4. X-ray: every visible system except the innermost visible one (lowest layerOrder) is capped at XRAY_OPACITY.
 *  5. Structures with rendered opacity < PICK_MIN_OPACITY are not pickable; ghosts are never pickable.
 */
import { GHOST_OPACITY, PICK_MIN_OPACITY, XRAY_OPACITY } from '@/contract';
import type { AtlasState, BySystem, Structure, SystemId } from '@/contract';
import { structureIdsOfNode } from './selectors';

export type RenderMode = 'hidden' | 'normal' | 'ghost';

export interface StructureRender {
  mode: RenderMode;
  /** Rendered opacity 0..1 (0 when hidden). */
  opacity: number;
  pickable: boolean;
}

export interface SystemRender {
  /** Layer visible (structures may still be drawn while isolated even if false). */
  layerVisible: boolean;
  /** Rendered opacity for 'normal' structures of this system. */
  opacity: number;
}

type VisState = Pick<
  AtlasState,
  | 'manifest'
  | 'layers'
  | 'hiddenIds'
  | 'isolate'
  | 'xray'
  | 'structures'
  | 'groups'
  | 'landmarks'
  | 'childrenOf'
>;

export interface VisibilityContext {
  systems: BySystem<SystemRender>;
  /** All structure ids hidden through hiddenIds (incl. descendants of hidden groups/structures). */
  hidden: Set<string>;
  /** Structure ids in the isolated set (empty when not isolating). */
  isolated: Set<string>;
  isolateMode: AtlasState['isolate']['mode'];
}

export function buildVisibilityContext(s: VisState): VisibilityContext {
  const systems: BySystem<SystemRender> = {};
  const manifestSystems = s.manifest?.systems ?? [];
  const visibleOrders = manifestSystems
    .filter((sys) => s.layers[sys.id]?.visible)
    .map((sys) => sys.layerOrder);
  const innermost = visibleOrders.length ? Math.min(...visibleOrders) : Infinity;
  for (const sys of manifestSystems) {
    const layer = s.layers[sys.id] ?? { visible: false, opacity: sys.defaultOpacity };
    let opacity = layer.opacity;
    if (s.xray && layer.visible && sys.layerOrder > innermost) opacity = Math.min(opacity, XRAY_OPACITY);
    systems[sys.id] = { layerVisible: layer.visible, opacity };
  }

  const hidden = new Set<string>();
  for (const id of Object.keys(s.hiddenIds)) {
    for (const sid of structureIdsOfNode(s, id)) hidden.add(sid);
  }

  const isolated = new Set<string>();
  if (s.isolate.mode !== 'none') {
    for (const id of s.isolate.ids) {
      for (const sid of structureIdsOfNode(s, id)) isolated.add(sid);
    }
  }
  return { systems, hidden, isolated, isolateMode: s.isolate.mode };
}

const HIDDEN: StructureRender = { mode: 'hidden', opacity: 0, pickable: false };

export function structureRender(
  ctx: VisibilityContext,
  st: Pick<Structure, 'id' | 'system'>,
): StructureRender {
  const sys = ctx.systems[st.system];
  if (!sys) return HIDDEN;
  const normallyVisible = sys.layerVisible && !ctx.hidden.has(st.id);

  if (ctx.isolateMode !== 'none') {
    if (ctx.isolated.has(st.id)) return { mode: 'normal', opacity: 1, pickable: true };
    if (ctx.isolateMode === 'isolate' || !normallyVisible) return HIDDEN;
    return { mode: 'ghost', opacity: GHOST_OPACITY, pickable: false };
  }

  if (!normallyVisible || sys.opacity <= 0) return HIDDEN;
  return { mode: 'normal', opacity: sys.opacity, pickable: sys.opacity >= PICK_MIN_OPACITY };
}

/**
 * Systems whose geometry the viewer must have loaded: visible layers, plus systems that contain
 * isolated structures (isolate shows them even when their layer is hidden).
 */
export function systemsNeedingGeometry(s: VisState): SystemId[] {
  const out = new Set<SystemId>();
  for (const sys of s.manifest?.systems ?? []) if (s.layers[sys.id]?.visible) out.add(sys.id);
  if (s.isolate.mode === 'none') return [...out];
  for (const id of s.isolate.ids) {
    for (const sid of structureIdsOfNode(s, id)) {
      const st = s.structures[sid];
      if (st) out.add(st.system);
    }
  }
  return [...out];
}
