/**
 * Orientation gizmo (DOM/SVG overlay, no extra WebGL pass): the six body directions projected with the camera
 * rotation, labelled with the PATIENT's anatomical directions — L/R on ±X (L = patient's left = +X),
 * S/I on ±Y, A/P on ±Z. Clicking a letter shows the standard view from that side.
 *
 * Position is overridable by the UI with CSS custom properties on an ancestor:
 *   --atlas-gizmo-right (default 16px), --atlas-gizmo-bottom (default 96px)
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Quaternion, Vector3 } from 'three';
import type { StandardView } from '@/contract';
import { useAtlasStore } from '@/state';
import { GIZMO_AXES } from '../core/views';
import type { ViewerBus } from '../core/ViewerBus';
import { useViewerStrings } from './strings';

const SIZE = 104;
const C = SIZE / 2;
const R = 34;
const AXIS_COLOR: Record<string, string> = {
  L: '#e5484d',
  R: '#e5484d',
  S: '#2f9e64',
  I: '#2f9e64',
  A: '#3e63dd',
  P: '#3e63dd',
};

const _q = new Quaternion();
const _v = new Vector3();

export function OrientationGizmo({ bus }: { bus: ViewerBus }) {
  const { t } = useTranslation();
  const strings = useViewerStrings();
  const groups = useRef<(SVGGElement | null)[]>([]);
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const container = useRef<SVGGElement>(null);

  useEffect(() => {
    const update = (q: Quaternion) => {
      _q.copy(q).invert();
      const order: { i: number; z: number }[] = [];
      GIZMO_AXES.forEach((axis, i) => {
        _v.set(...axis.dir).applyQuaternion(_q); // body direction in camera space
        const x = C + _v.x * R;
        const y = C - _v.y * R;
        const g = groups.current[i];
        const l = lines.current[i];
        const front = _v.z > -0.15;
        if (g) {
          g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
          g.style.opacity = front ? '1' : '0.55';
        }
        if (l) {
          l.setAttribute('x2', x.toFixed(2));
          l.setAttribute('y2', y.toFixed(2));
          l.style.opacity = front ? '0.9' : '0.4';
        }
        order.push({ i, z: _v.z });
      });
      // Paint back-to-front so the letters facing the viewer stay on top.
      const parent = container.current;
      if (parent) {
        order.sort((a, b) => a.z - b.z);
        for (const { i } of order) {
          const g = groups.current[i];
          if (g) parent.appendChild(g);
        }
      }
    };
    update(bus.camera.last);
    return bus.camera.on(update);
  }, [bus]);

  const label = (view: StandardView) => t(`views.${view}`);
  const go = (view: StandardView) =>
    void useAtlasStore.getState().requestViewer({ type: 'setView', view, animate: true });

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        right: 'var(--atlas-gizmo-right, 16px)',
        bottom: 'var(--atlas-gizmo-bottom, 96px)',
        width: SIZE,
        height: SIZE,
      }}
      data-testid="orientation-gizmo"
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="group"
        aria-label={strings.orientation}
        className="overflow-visible"
      >
        <circle
          cx={C}
          cy={C}
          r={R + 14}
          className="fill-white/55 stroke-neutral-300/70 dark:fill-neutral-900/55 dark:stroke-neutral-600/70"
        />
        {GIZMO_AXES.map((axis, i) => (
          <line
            key={`l-${axis.letter}`}
            ref={(el) => {
              lines.current[i] = el;
            }}
            x1={C}
            y1={C}
            x2={C}
            y2={C}
            stroke={AXIS_COLOR[axis.letter]}
            strokeWidth={axis.letter === 'L' || axis.letter === 'S' || axis.letter === 'A' ? 2 : 1.25}
            strokeDasharray={
              axis.letter === 'R' || axis.letter === 'I' || axis.letter === 'P' ? '3 2' : undefined
            }
          />
        ))}
        <g ref={container}>
          {GIZMO_AXES.map((axis, i) => (
            <g
              key={axis.letter}
              ref={(el) => {
                groups.current[i] = el;
              }}
              role="button"
              tabIndex={0}
              aria-label={label(axis.view)}
              data-gizmo-axis={axis.letter}
              className="pointer-events-auto cursor-pointer outline-none focus-visible:[&>circle]:stroke-sky-400"
              onClick={() => go(axis.view)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  go(axis.view);
                }
              }}
            >
              <title>{label(axis.view)}</title>
              <circle r={9.5} fill={AXIS_COLOR[axis.letter]} stroke="white" strokeWidth={1.5} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={700}
                fill="white"
                style={{ fontFamily: 'inherit' }}
              >
                {axis.letter}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
