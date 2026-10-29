/**
 * Greedy label placement (pure, unit tested).
 *
 * Every label points at an anchor on screen. Labels are pushed outwards (left of the anchor when the anchor is on
 * the left half of the screen, right otherwise) and slightly up; then, in order of priority, each label tries a
 * list of vertical offsets until it overlaps no label placed before it. If nothing fits it keeps the default spot
 * (overlap is avoided "where feasible", never by hiding a label).
 */
export interface LabelInput {
  key: string;
  /** Anchor in CSS pixels relative to the canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelPlacement {
  key: string;
  /** Offset of the label box's anchor-facing edge from the anchor, in CSS px. */
  dx: number;
  dy: number;
  /** Box in canvas px (left, top, right, bottom) after placement. */
  box: [number, number, number, number];
  side: 'left' | 'right';
}

export const LABEL_GAP_X = 36;
export const LABEL_GAP_Y = -28;
const STEP = 6;
const PAD = 3;

function overlaps(a: readonly number[], b: readonly number[]): boolean {
  return a[0]! < b[2]! + PAD && a[2]! + PAD > b[0]! && a[1]! < b[3]! + PAD && a[3]! + PAD > b[1]!;
}

function boxFor(l: LabelInput, side: 'left' | 'right', dy: number): [number, number, number, number] {
  const top = l.y + dy - l.height / 2;
  if (side === 'right') return [l.x + LABEL_GAP_X, top, l.x + LABEL_GAP_X + l.width, top + l.height];
  return [l.x - LABEL_GAP_X - l.width, top, l.x - LABEL_GAP_X, top + l.height];
}

/** Labels earlier in `labels` get priority (pass the selected label first). */
export function layoutLabels(labels: readonly LabelInput[], viewportWidth: number): LabelPlacement[] {
  const placed: LabelPlacement[] = [];
  for (const l of labels) {
    const side: 'left' | 'right' = l.x < viewportWidth / 2 ? 'left' : 'right';
    const candidates: number[] = [LABEL_GAP_Y];
    const step = l.height + STEP;
    for (let k = 1; k <= 8; k++) candidates.push(LABEL_GAP_Y - k * step, LABEL_GAP_Y + k * step);
    let chosen: LabelPlacement | null = null;
    for (const dy of candidates) {
      for (const s of [side, side === 'left' ? 'right' : 'left'] as const) {
        const box = boxFor(l, s, dy);
        if (!placed.some((p) => overlaps(p.box, box))) {
          chosen = { key: l.key, dx: s === 'right' ? LABEL_GAP_X : -LABEL_GAP_X, dy, box, side: s };
          break;
        }
      }
      if (chosen) break;
    }
    chosen ??= {
      key: l.key,
      dx: side === 'right' ? LABEL_GAP_X : -LABEL_GAP_X,
      dy: LABEL_GAP_Y,
      box: boxFor(l, side, LABEL_GAP_Y),
      side,
    };
    placed.push(chosen);
  }
  return placed;
}
