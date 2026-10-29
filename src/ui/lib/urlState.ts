/**
 * URL state codec (ARCHITECTURE.md §7). Pure functions, no store access.
 *
 *   s   selected id                         s=femur-l
 *   l   visible layers + opacity %          l=skeletal.100,muscular.40   (authoritative when present)
 *   h   hidden node ids                     h=g-ribs,sternum
 *   i   isolate (i) / with context (c)      i=c:heart
 *   c   clip planes s/c/t + % [+ f]         c=s50,t32.5f
 *   e   explode %                           e=40
 *   x   X-ray on                            x=1
 *   cam camera position + target in mm     cam=0,1100,3200,0,1000,0
 *   n   name language                       n=en
 *   p   pinned ids                          p=femur-l,tibia-l
 *
 * Only non-default values are written. Unknown ids / systems / malformed values are ignored.
 * `u` is reserved for a future incompatible format (u=2); this version is 1 (no `u`).
 */
import type {
  BySystem,
  CameraPose,
  ClipPlaneState,
  LayerState,
  NameLang,
  PlaneAxis,
  ShareableState,
  Vec3,
} from '@/contract';

export const URL_KEYS = ['s', 'l', 'h', 'i', 'c', 'e', 'x', 'cam', 'n', 'p', 'u'] as const;
export const URL_FORMAT_VERSION = 1;

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const AXIS_LETTER: Record<PlaneAxis, string> = { sagittal: 's', coronal: 'c', transverse: 't' };
const LETTER_AXIS: Record<string, PlaneAxis> = { s: 'sagittal', c: 'coronal', t: 'transverse' };
const AXES: PlaneAxis[] = ['sagittal', 'coronal', 'transverse'];

export interface UrlDefaults {
  /** Default layers from the manifest (visible + opacity per system). */
  layers: BySystem<LayerState>;
  /** Camera pose that counts as "default" (not written). */
  camera?: CameraPose | null;
}

export interface UrlDecodeContext extends UrlDefaults {
  /** Name languages that may be selected. */
  nameLangs: readonly NameLang[];
  /** Returns false for node ids that do not exist (e.g. not in the search index). Optional. */
  isKnownId?: (id: string) => boolean;
}

const pct = (v: number) => Math.round(v * 100);
const pct1 = (v: number) => Math.round(v * 1000) / 10; // one decimal
const fmt = (n: number) => String(Number.isInteger(n) ? n : Number(n.toFixed(1)));

export function camerasEqual(a: CameraPose | null | undefined, b: CameraPose | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  const near = (x: Vec3, y: Vec3) => x.every((v, i) => Math.abs(v - y[i]!) < 0.0015);
  return near(a.position, b.position) && near(a.target, b.target);
}

function layersEqual(a: BySystem<LayerState>, b: BySystem<LayerState>): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const x = a[id];
    const y = b[id];
    const xv = Boolean(x?.visible);
    const yv = Boolean(y?.visible);
    if (xv !== yv) return false;
    if (xv && pct(x!.opacity) !== pct(y!.opacity)) return false;
  }
  return true;
}

/** Encode the shareable state into ordered [key, value] pairs (non-default values only). */
export function encodeShareableState(state: ShareableState, defaults: UrlDefaults): [string, string][] {
  const out: [string, string][] = [];
  if (state.selectedId) out.push(['s', state.selectedId]);

  if (!layersEqual(state.layers, defaults.layers)) {
    const parts = Object.entries(state.layers)
      .filter(([, l]) => l.visible)
      .map(([id, l]) => `${id}.${pct(l.opacity)}`);
    out.push(['l', parts.join(',')]);
  }

  if (state.hiddenIds.length) out.push(['h', state.hiddenIds.join(',')]);

  if (state.isolate.mode !== 'none' && state.isolate.ids.length)
    out.push(['i', `${state.isolate.mode === 'context' ? 'c' : 'i'}:${state.isolate.ids.join(',')}`]);

  const clip = AXES.filter((a) => state.clipping[a].enabled).map((a) => {
    const c = state.clipping[a];
    return `${AXIS_LETTER[a]}${fmt(pct1(c.position))}${c.flipped ? 'f' : ''}`;
  });
  if (clip.length) out.push(['c', clip.join(',')]);

  if (pct(state.explode) > 0) out.push(['e', String(pct(state.explode))]);
  if (state.xray) out.push(['x', '1']);

  if (state.camera && !camerasEqual(state.camera, defaults.camera)) {
    const mm = [...state.camera.position, ...state.camera.target].map((v) => Math.round(v * 1000));
    out.push(['cam', mm.join(',')]);
  }

  if (state.nameLang !== 'la') out.push(['n', state.nameLang]);
  if (state.pinnedIds.length) out.push(['p', state.pinnedIds.join(',')]);
  return out;
}

function idList(raw: string | null, ctx: UrlDecodeContext): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (ID_RE.test(id) && (ctx.isKnownId?.(id) ?? true)) seen.add(id);
  }
  return [...seen];
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Decode a query string into a partial shareable state. Only keys present in the URL are returned. */
export function decodeShareableState(search: string, ctx: UrlDecodeContext): Partial<ShareableState> {
  const q = new URLSearchParams(search);
  const out: Partial<ShareableState> = {};
  const u = q.get('u');
  if (u !== null && u !== String(URL_FORMAT_VERSION)) return out; // unknown future format

  const s = q.get('s');
  if (s !== null) {
    const [id] = idList(s, ctx);
    if (id) out.selectedId = id;
  }

  const l = q.get('l');
  if (l !== null) {
    const layers: BySystem<LayerState> = {};
    for (const [id, d] of Object.entries(ctx.layers)) layers[id] = { visible: false, opacity: d.opacity };
    for (const part of l.split(',')) {
      const m = /^([a-z0-9-]+)(?:\.(\d{1,3}))?$/.exec(part.trim());
      if (!m || !layers[m[1]!]) continue;
      const opacity = m[2] === undefined ? 1 : clamp(Number(m[2]), 0, 100) / 100;
      layers[m[1]!] = { visible: true, opacity };
    }
    out.layers = layers;
  }

  if (q.has('h')) out.hiddenIds = idList(q.get('h'), ctx);

  const i = q.get('i');
  if (i !== null) {
    const m = /^([ic]):(.+)$/.exec(i);
    const ids = m ? idList(m[2]!, ctx) : [];
    out.isolate = ids.length
      ? { mode: m![1] === 'c' ? 'context' : 'isolate', ids }
      : { mode: 'none', ids: [] };
  }

  const c = q.get('c');
  if (c !== null) {
    const clipping = {} as Record<PlaneAxis, ClipPlaneState>;
    for (const a of AXES) clipping[a] = { enabled: false, position: 0.5, flipped: false };
    for (const part of c.split(',')) {
      const m = /^([sct])(\d{1,3}(?:\.\d+)?)(f?)$/.exec(part.trim());
      if (!m) continue;
      clipping[LETTER_AXIS[m[1]!]!] = {
        enabled: true,
        position: clamp(Number(m[2]), 0, 100) / 100,
        flipped: m[3] === 'f',
      };
    }
    out.clipping = clipping;
  }

  const e = q.get('e');
  if (e !== null && /^\d{1,3}$/.test(e)) out.explode = clamp(Number(e), 0, 100) / 100;

  const x = q.get('x');
  if (x !== null) out.xray = x === '1';

  const cam = q.get('cam');
  if (cam !== null) {
    const nums = cam.split(',').map(Number);
    if (nums.length === 6 && nums.every((n) => Number.isFinite(n) && Math.abs(n) < 1e6)) {
      const m = nums.map((n) => n / 1000);
      out.camera = { position: [m[0]!, m[1]!, m[2]!], target: [m[3]!, m[4]!, m[5]!] };
    }
  }

  const n = q.get('n');
  if (n !== null && (ctx.nameLangs as readonly string[]).includes(n)) out.nameLang = n as NameLang;

  if (q.has('p')) out.pinnedIds = idList(q.get('p'), ctx);
  return out;
}

const encodeValue = (v: string) =>
  encodeURIComponent(v).replace(/%2C/gi, ',').replace(/%3A/gi, ':').replace(/%2E/gi, '.');

/**
 * Replace the atlas keys in an existing query string, keeping unrelated parameters (data=mock, testHooks …)
 * first and in their original order. Returns '' or '?…'.
 */
export function mergeSearch(currentSearch: string, encoded: [string, string][]): string {
  const keep = new URLSearchParams(currentSearch);
  for (const k of URL_KEYS) keep.delete(k);
  const parts: string[] = [];
  for (const [k, v] of keep) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  for (const [k, v] of encoded) parts.push(`${k}=${encodeValue(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** True when the query string contains any atlas state key. */
export function hasUrlState(search: string): boolean {
  const q = new URLSearchParams(search);
  return URL_KEYS.some((k) => q.has(k));
}
