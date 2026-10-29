/**
 * Which labels to show and where they point (pure, unit tested).
 *
 *  - selected node first (layout priority), then pinned nodes; none in quiz mode or with labels off
 *  - structure → its `labelAnchor`, else the nearest surface point to its centroid (resolved by the viewer)
 *  - landmark  → its `anchor`, following its structure
 *  - group     → the label of the descendant structure closest to the group's centre (preferring visible ones),
 *                so the leader line ends on real geometry, never in empty space between left and right
 */
import type { AtlasState, Side, Structure, Vec3 } from '@/contract';
import { displayName, structureIdsOfNode, unionBBox } from '@/state';

export interface LabelItem {
  /** Node id (structure, group or landmark). */
  key: string;
  text: string;
  side?: Side;
  selected: boolean;
  /** Structure the label follows (explode offset, visibility). */
  structureId: string;
  /** Body-space anchor; null → nearest surface point to `centroid`. */
  anchor: Vec3 | null;
  centroid: Vec3;
}

type LabelState = Pick<
  AtlasState,
  | 'selectedId'
  | 'pinnedIds'
  | 'labelsVisible'
  | 'mode'
  | 'nameLang'
  | 'structures'
  | 'groups'
  | 'landmarks'
  | 'childrenOf'
>;

function representative(structures: Structure[], isVisible: (id: string) => boolean): Structure | null {
  if (structures.length === 0) return null;
  const visible = structures.filter((s) => isVisible(s.id));
  const pool = visible.length ? visible : structures;
  const box = unionBBox(pool)!;
  const c: Vec3 = [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
  let best = pool[0]!;
  let bestD = Infinity;
  for (const s of pool) {
    const d = Math.hypot(s.centroid[0] - c[0], s.centroid[1] - c[1], s.centroid[2] - c[2]);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function resolveLabelItems(s: LabelState, isVisible: (structureId: string) => boolean): LabelItem[] {
  if (!s.labelsVisible || s.mode === 'quiz') return [];
  const ids: string[] = [];
  if (s.selectedId) ids.push(s.selectedId);
  for (const id of s.pinnedIds) if (!ids.includes(id)) ids.push(id);

  const out: LabelItem[] = [];
  for (const id of ids) {
    const selected = id === s.selectedId;
    const st = s.structures[id];
    if (st) {
      const item: LabelItem = {
        key: id,
        text: displayName(st.names, s.nameLang),
        selected,
        structureId: id,
        anchor: st.labelAnchor ?? null,
        centroid: st.centroid,
      };
      if (st.side) item.side = st.side;
      out.push(item);
      continue;
    }
    const lm = s.landmarks[id];
    if (lm) {
      const owner = s.structures[lm.structureId];
      if (!owner) continue;
      const item: LabelItem = {
        key: id,
        text: displayName(lm.names, s.nameLang),
        selected,
        structureId: lm.structureId,
        anchor: lm.anchor,
        centroid: lm.anchor,
      };
      if (lm.side) item.side = lm.side;
      out.push(item);
      continue;
    }
    const g = s.groups[id];
    if (g) {
      const members = structureIdsOfNode(s, id)
        .map((sid) => s.structures[sid])
        .filter((x): x is Structure => x !== undefined);
      const rep = representative(members, isVisible);
      if (!rep) continue;
      out.push({
        key: id,
        text: displayName(g.names, s.nameLang),
        selected,
        structureId: rep.id,
        anchor: rep.labelAnchor ?? null,
        centroid: rep.centroid,
      });
    }
  }
  return out;
}
