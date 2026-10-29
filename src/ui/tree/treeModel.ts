/**
 * Flattens system → group → structure into the visible rows of the virtualized tree.
 * Pure (no React, no store) so it can be tested with thousands of nodes.
 */
import { systemRootKey } from '@/contract';
import type { AtlasState, NameLang, PatchKind, Side, SystemInfo } from '@/contract';
import { displayName, patchKindOf } from '@/state';
import { normalizeText } from '../lib/labels';

export type TreeRowKind = 'system' | 'group' | 'structure';

export interface TreeRow {
  /** Node id, or `@<systemId>` for a system row. */
  key: string;
  /** Node id (structure/group) or system id. */
  id: string;
  kind: TreeRowKind;
  systemId: string;
  depth: number;
  label: string;
  side?: Side;
  /** Origin/insertion patch: the label is the muscle name, the row shows this kind next to it. */
  patchKind?: PatchKind;
  hasChildren: boolean;
  expanded: boolean;
  /** Own visibility (layer visible for systems; not in hiddenIds for nodes); 'mixed' when descendants are hidden. */
  checked: boolean | 'mixed';
  /** Not drawn because the layer or an ancestor is hidden. */
  hiddenByParent: boolean;
  /** System rows only: metadata status. */
  loadStatus?: AtlasState['systemLoad'][string]['meta'];
  /** Filter active and this node itself matches. */
  match?: boolean;
}

export type TreeInput = Pick<
  AtlasState,
  'childrenOf' | 'structures' | 'groups' | 'layers' | 'hiddenIds' | 'systemLoad'
> & {
  systems: SystemInfo[];
  nameLang: NameLang;
  systemLabel: (sys: SystemInfo) => string;
};

function parentOf(input: TreeInput, id: string): string | undefined {
  return input.structures[id]?.parentId ?? input.groups[id]?.parentId;
}

function systemOf(input: TreeInput, id: string): string | undefined {
  return input.structures[id]?.system ?? input.groups[id]?.system;
}

/** Node keys (incl. system root keys) that have a hidden descendant. */
export function keysWithHiddenDescendants(input: TreeInput): Set<string> {
  const out = new Set<string>();
  for (const id of Object.keys(input.hiddenIds)) {
    const sys = systemOf(input, id);
    if (sys) out.add(systemRootKey(sys));
    let cur = parentOf(input, id);
    let guard = 0;
    while (cur && !out.has(cur) && guard++ < 256) {
      out.add(cur);
      cur = parentOf(input, cur);
    }
  }
  return out;
}

export interface FilterResult {
  /** Node keys that are shown while filtering (matches + their ancestors). */
  include: Set<string>;
  /** Node ids that match themselves. */
  matches: Set<string>;
  /** Systems that are not loaded (their nodes could not be searched). */
  unloadedSystems: string[];
}

export function filterTree(input: TreeInput, filter: string): FilterResult {
  const q = normalizeText(filter);
  const include = new Set<string>();
  const matches = new Set<string>();
  const unloadedSystems: string[] = [];
  const nodeMatches = (id: string) => {
    const names = input.structures[id]?.names ?? input.groups[id]?.names;
    if (!names) return false;
    for (const v of Object.values(names)) if (v && normalizeText(v).includes(q)) return true;
    return false;
  };
  const visit = (key: string, depth: number): boolean => {
    if (depth > 64) return false;
    let any = false;
    if (!key.startsWith('@') && nodeMatches(key)) {
      matches.add(key);
      any = true;
    }
    for (const child of input.childrenOf[key] ?? []) if (visit(child, depth + 1)) any = true;
    if (any) include.add(key);
    return any;
  };
  for (const sys of input.systems) {
    if (input.systemLoad[sys.id]?.meta !== 'loaded') {
      unloadedSystems.push(sys.id);
      continue;
    }
    visit(systemRootKey(sys.id), 0);
  }
  return { include, matches, unloadedSystems };
}

/**
 * Visible rows. Without a filter only expanded nodes are descended into; with a filter every matching
 * branch is shown expanded.
 */
export function buildTreeRows(input: TreeInput, expanded: ReadonlySet<string>, filter = ''): TreeRow[] {
  const rows: TreeRow[] = [];
  const mixed = keysWithHiddenDescendants(input);
  const filtering = normalizeText(filter).length > 0;
  const fr = filtering ? filterTree(input, filter) : null;

  const pushChildren = (parentKey: string, sysId: string, depth: number, parentHidden: boolean) => {
    if (depth > 64) return;
    for (const id of input.childrenOf[parentKey] ?? []) {
      if (fr && !fr.include.has(id)) continue;
      const st = input.structures[id];
      const g = st ? undefined : input.groups[id];
      if (!st && !g) continue;
      const kids = input.childrenOf[id];
      const hasChildren = Boolean(kids && kids.length);
      const isExpanded = hasChildren && (fr ? true : expanded.has(id));
      const ownHidden = Boolean(input.hiddenIds[id]);
      const row: TreeRow = {
        key: id,
        id,
        kind: st ? 'structure' : 'group',
        systemId: sysId,
        depth,
        label: displayName((st ?? g)!.names, input.nameLang),
        hasChildren,
        expanded: isExpanded,
        checked: ownHidden ? false : mixed.has(id) ? 'mixed' : true,
        hiddenByParent: parentHidden,
      };
      if (st?.side) row.side = st.side;
      const patchKind = patchKindOf(st);
      if (patchKind) row.patchKind = patchKind;
      if (fr?.matches.has(id)) row.match = true;
      rows.push(row);
      if (isExpanded) pushChildren(id, sysId, depth + 1, parentHidden || ownHidden);
    }
  };

  for (const sys of input.systems) {
    const key = systemRootKey(sys.id);
    const meta = input.systemLoad[sys.id]?.meta ?? 'idle';
    if (fr && meta === 'loaded' && !fr.include.has(key)) continue;
    const loaded = meta === 'loaded';
    const kids = input.childrenOf[key];
    const hasChildren = loaded ? Boolean(kids && kids.length) : true;
    const isExpanded = loaded && hasChildren && (fr ? true : expanded.has(key));
    const layerVisible = Boolean(input.layers[sys.id]?.visible);
    rows.push({
      key,
      id: sys.id,
      kind: 'system',
      systemId: sys.id,
      depth: 0,
      label: input.systemLabel(sys),
      hasChildren,
      expanded: isExpanded || (!loaded && expanded.has(key)),
      checked: !layerVisible ? false : mixed.has(key) ? 'mixed' : true,
      hiddenByParent: false,
      loadStatus: meta,
    });
    if (isExpanded) pushChildren(key, sys.id, 1, !layerVisible);
  }
  return rows;
}

/** Keys to expand so that `id` becomes visible (system root key first, nearest parent last). */
export function expansionPathFor(input: Pick<TreeInput, 'structures' | 'groups'>, id: string): string[] {
  const sys = input.structures[id]?.system ?? input.groups[id]?.system;
  if (!sys) return [];
  const chain: string[] = [];
  let cur = input.structures[id]?.parentId ?? input.groups[id]?.parentId;
  let guard = 0;
  while (cur && !chain.includes(cur) && guard++ < 256) {
    chain.unshift(cur);
    cur = input.structures[cur]?.parentId ?? input.groups[cur]?.parentId;
  }
  return [systemRootKey(sys), ...chain];
}
