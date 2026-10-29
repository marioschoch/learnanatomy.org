/**
 * Labels for the selected and pinned nodes: drei <Html> at the anchor, a leader line to a label box that is
 * placed by `layoutLabels` (outwards, de-overlapped). Positions follow the explode animation; a label hides when
 * its structure is not drawn (hidden, isolated away, ghosted) or its anchor is clipped away.
 *
 * Per frame we only touch DOM styles through refs (no React re-render): read sizes first, then write.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
import type { AtlasState, Vec3 } from '@/contract';
import { useAtlasStore } from '@/state';
import type { AtlasScene } from '../core/AtlasScene';
import { resolveLabelItems } from '../core/labelItems';
import type { LabelItem } from '../core/labelItems';
import { layoutLabels } from '../core/labelLayout';
import type { LabelInput } from '../core/labelLayout';
import { useViewerStrings } from './strings';

interface LabelRefs {
  group: Group;
  root: HTMLDivElement;
  box: HTMLButtonElement;
  line: SVGLineElement;
}

const _v = new Vector3();

const itemsKey = (items: LabelItem[]) =>
  items
    .map((i) => `${i.key}|${i.structureId}|${i.text}|${i.selected ? 1 : 0}|${i.anchor?.join(',') ?? ''}`)
    .join(';');

const relevant = (a: AtlasState, b: AtlasState) =>
  a.selectedId !== b.selectedId ||
  a.pinnedIds !== b.pinnedIds ||
  a.labelsVisible !== b.labelsVisible ||
  a.mode !== b.mode ||
  a.nameLang !== b.nameLang ||
  a.structures !== b.structures ||
  a.groups !== b.groups ||
  a.landmarks !== b.landmarks ||
  a.childrenOf !== b.childrenOf ||
  a.layers !== b.layers ||
  a.hiddenIds !== b.hiddenIds ||
  a.isolate !== b.isolate ||
  a.systemLoad !== b.systemLoad;

export function Labels({ scene }: { scene: AtlasScene }) {
  const invalidate = useThree((s) => s.invalidate);
  const [items, setItems] = useState<LabelItem[]>([]);
  // Registry of label DOM/group refs; a state-held Map (stable identity) so it can be passed during render.
  const [registry] = useState(() => new Map<string, LabelRefs>());
  const surfaceCache = useRef(new Map<string, Vec3>());

  useEffect(() => {
    let key = '';
    const update = (st: AtlasState) => {
      const next = resolveLabelItems(st, (id) => scene.isVisible(id));
      const k = itemsKey(next);
      if (k !== key) {
        key = k;
        setItems(next);
      }
    };
    update(useAtlasStore.getState());
    return useAtlasStore.subscribe((st, prev) => {
      if (relevant(st, prev)) update(st);
    });
  }, [scene]);

  useEffect(() => {
    invalidate();
  }, [items, invalidate]);

  // Runs after CameraControls (-1) and before drei Html (0) positions its wrapper.
  useFrame(({ camera, size }) => {
    const inputs: (LabelInput & { refs: LabelRefs })[] = [];
    for (const item of items) {
      const r = registry.get(item.key);
      if (!r) continue;
      let visible = scene.isVisible(item.structureId);
      let body: Vec3 | null = item.anchor;
      if (visible && !body) {
        const ck = `${item.structureId}`;
        body = surfaceCache.current.get(ck) ?? null;
        if (!body) {
          body = scene.bodySurfacePoint(item.structureId, item.centroid);
          if (body) surfaceCache.current.set(ck, body);
        }
      }
      if (!body) visible = false;
      let x = 0;
      let y = 0;
      if (visible && body) {
        const o = scene.offsetOf(item.structureId);
        const world: Vec3 = [body[0] + o[0], body[1] + o[1], body[2] + o[2]];
        r.group.position.set(world[0], world[1], world[2]);
        if (scene.isClipped(world)) visible = false;
        _v.set(world[0], world[1], world[2]).project(camera);
        if (_v.z > 1 || _v.z < -1) visible = false;
        x = (_v.x * 0.5 + 0.5) * size.width;
        y = (-_v.y * 0.5 + 0.5) * size.height;
      }
      r.root.style.visibility = visible ? 'visible' : 'hidden';
      if (visible)
        inputs.push({ key: item.key, x, y, width: r.box.offsetWidth, height: r.box.offsetHeight, refs: r });
    }
    const placed = layoutLabels(inputs, size.width);
    placed.forEach((p, i) => {
      const { refs: r, width, height } = inputs[i]!;
      r.line.setAttribute('x2', String(p.dx));
      r.line.setAttribute('y2', String(p.dy));
      const left = p.side === 'right' ? p.dx : p.dx - width;
      r.box.style.transform = `translate(${left}px, ${p.dy - height / 2}px)`;
    });
  }, -0.5);

  return (
    <>
      {items.map((item) => (
        <LabelNode key={item.key} item={item} registry={registry} />
      ))}
    </>
  );
}

const LabelNode = memo(function LabelNode({
  item,
  registry,
}: {
  item: LabelItem;
  registry: Map<string, LabelRefs>;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<Group>(null);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLButtonElement>(null);
  const line = useRef<SVGLineElement>(null);
  const [mounted, setMounted] = useState(false);

  // drei Html renders its children in its own React root, so refs are attached a tick later.
  useEffect(() => {
    if (!mounted || !group.current || !root.current || !box.current || !line.current) return;
    const key = item.key;
    registry.set(key, { group: group.current, root: root.current, box: box.current, line: line.current });
    invalidate();
    return () => {
      registry.delete(key);
    };
  }, [mounted, registry, item.key, invalidate]);

  const strings = useViewerStrings();
  const sideBadge = item.side === 'left' ? 'L' : item.side === 'right' ? 'R' : null;
  return (
    <group ref={group}>
      <Html zIndexRange={[40, 10]} pointerEvents="none" style={{ pointerEvents: 'none' }}>
        <div
          ref={(el) => {
            root.current = el;
            if (el && !mounted) setMounted(true);
          }}
          className="pointer-events-none absolute top-0 left-0 select-none"
          style={{ visibility: 'hidden' }}
          aria-hidden="true"
          data-testid="viewer-label"
          data-label-id={item.key}
        >
          <svg className="absolute top-0 left-0 overflow-visible" width="1" height="1">
            <line
              ref={line}
              x1="0"
              y1="0"
              x2="0"
              y2="0"
              className={item.selected ? 'stroke-sky-500' : 'stroke-neutral-500 dark:stroke-neutral-300'}
              strokeWidth="1.25"
            />
            <circle
              r="2.5"
              className={item.selected ? 'fill-sky-500' : 'fill-neutral-500 dark:fill-neutral-300'}
            />
          </svg>
          <button
            ref={box}
            type="button"
            tabIndex={-1}
            onClick={() => useAtlasStore.getState().select(item.key)}
            className={
              'pointer-events-auto absolute top-0 left-0 rounded-md border px-2 py-0.5 text-xs leading-5 font-medium whitespace-nowrap shadow-sm backdrop-blur-sm ' +
              (item.selected
                ? 'border-sky-500/70 bg-white/95 text-neutral-900 dark:bg-neutral-900/90 dark:text-white'
                : 'border-neutral-300/80 bg-white/85 text-neutral-800 dark:border-neutral-600/80 dark:bg-neutral-900/80 dark:text-neutral-100')
            }
          >
            {item.text}
            {item.patchKind ? (
              <span className="font-normal opacity-75"> · {strings.kind[item.patchKind]}</span>
            ) : null}
            {sideBadge && (
              <span className="ml-1.5 rounded bg-neutral-200 px-1 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                {sideBadge}
              </span>
            )}
          </button>
        </div>
      </Html>
    </group>
  );
});
