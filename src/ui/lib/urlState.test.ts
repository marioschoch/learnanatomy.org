import type { BySystem, LayerState, PlaneAxis, ShareableState, ClipPlaneState } from '@/contract';
import {
  camerasEqual,
  decodeShareableState,
  encodeShareableState,
  hasUrlState,
  mergeSearch,
  type UrlDecodeContext,
} from './urlState';

const defaultsLayers: BySystem<LayerState> = {
  skeletal: { visible: true, opacity: 1 },
  visceral: { visible: true, opacity: 1 },
  muscular: { visible: false, opacity: 1 },
};

function clip(
  patch: Partial<Record<PlaneAxis, Partial<ClipPlaneState>>> = {},
): Record<PlaneAxis, ClipPlaneState> {
  const base = { enabled: false, position: 0.5, flipped: false };
  return {
    sagittal: { ...base, ...patch.sagittal },
    coronal: { ...base, ...patch.coronal },
    transverse: { ...base, ...patch.transverse },
  };
}

function baseState(): ShareableState {
  return {
    selectedId: null,
    layers: structuredClone(defaultsLayers),
    hiddenIds: [],
    isolate: { mode: 'none', ids: [] },
    clipping: clip(),
    explode: 0,
    xray: false,
    camera: null,
    nameLang: 'la',
    pinnedIds: [],
  };
}

const ctx: UrlDecodeContext = { layers: defaultsLayers, nameLangs: ['la', 'en'] };
const toSearch = (s: ShareableState) => mergeSearch('', encodeShareableState(s, ctx));

describe('URL state codec', () => {
  it('writes nothing for the default state', () => {
    expect(encodeShareableState(baseState(), ctx)).toEqual([]);
    expect(toSearch(baseState())).toBe('');
  });

  it('encodes the documented compact format', () => {
    const s = baseState();
    s.selectedId = 'femur-l';
    s.layers.muscular = { visible: true, opacity: 0.4 };
    s.hiddenIds = ['g-ribs', 'sternum'];
    s.isolate = { mode: 'context', ids: ['heart'] };
    s.clipping = clip({
      sagittal: { enabled: true, position: 0.5 },
      transverse: { enabled: true, position: 0.325, flipped: true },
    });
    s.explode = 0.4;
    s.xray = true;
    s.camera = { position: [0, 1.1, 3.2], target: [0, 1, 0] };
    s.nameLang = 'en';
    s.pinnedIds = ['femur-l', 'tibia-l'];
    expect(toSearch(s)).toBe(
      '?s=femur-l&l=skeletal.100,visceral.100,muscular.40&h=g-ribs,sternum&i=c:heart&c=s50,t32.5f&e=40&x=1' +
        '&cam=0,1100,3200,0,1000,0&n=en&p=femur-l,tibia-l',
    );
  });

  it('round-trips encode → decode', () => {
    const s = baseState();
    s.selectedId = 'liver';
    s.layers.visceral = { visible: false, opacity: 1 };
    s.layers.skeletal = { visible: true, opacity: 0.35 };
    s.layers.muscular = { visible: true, opacity: 0.6 };
    s.hiddenIds = ['g-axial-skeleton'];
    s.isolate = { mode: 'isolate', ids: ['heart', 'lung-l'] };
    s.clipping = clip({ coronal: { enabled: true, position: 0.123, flipped: true } });
    s.explode = 0.75;
    s.xray = true;
    s.camera = { position: [0.25, 1.5, 2.75], target: [-0.01, 1.05, 0] };
    s.nameLang = 'en';
    s.pinnedIds = ['heart'];

    const decoded = decodeShareableState(toSearch(s), ctx);
    expect(decoded.selectedId).toBe('liver');
    expect(decoded.layers).toEqual(s.layers);
    expect(decoded.hiddenIds).toEqual(s.hiddenIds);
    expect(decoded.isolate).toEqual(s.isolate);
    expect(decoded.clipping!.coronal.enabled).toBe(true);
    expect(decoded.clipping!.coronal.flipped).toBe(true);
    expect(decoded.clipping!.coronal.position).toBeCloseTo(0.123, 3);
    expect(decoded.clipping!.sagittal.enabled).toBe(false);
    expect(decoded.explode).toBeCloseTo(0.75);
    expect(decoded.xray).toBe(true);
    expect(camerasEqual(decoded.camera, s.camera)).toBe(true);
    expect(decoded.nameLang).toBe('en');
    expect(decoded.pinnedIds).toEqual(['heart']);
    // Re-encoding the decoded state gives the same URL.
    expect(toSearch({ ...baseState(), ...decoded })).toBe(toSearch(s));
  });

  it('encodes "all layers hidden" as an empty l', () => {
    const s = baseState();
    for (const l of Object.values(s.layers)) l.visible = false;
    expect(toSearch(s)).toBe('?l=');
    const d = decodeShareableState('?l=', ctx);
    expect(Object.values(d.layers!).every((l) => !l.visible)).toBe(true);
  });

  it('ignores unknown systems, unknown ids, bad values and unknown languages', () => {
    const d = decodeShareableState(
      '?s=NOT_AN_ID&l=skeletal.50,bogus.20,muscular&h=sternum,gone,Bad!&i=z:heart&c=q50,s200,t10&e=abc&cam=1,2,3&n=xx&p=heart',
      { ...ctx, isKnownId: (id) => id !== 'gone' },
    );
    expect(d.selectedId).toBeUndefined();
    expect(d.layers).toEqual({
      skeletal: { visible: true, opacity: 0.5 },
      visceral: { visible: false, opacity: 1 },
      muscular: { visible: true, opacity: 1 },
    });
    expect(d.hiddenIds).toEqual(['sternum']);
    expect(d.isolate).toEqual({ mode: 'none', ids: [] });
    expect(d.clipping!.sagittal).toEqual({ enabled: true, position: 1, flipped: false });
    expect(d.clipping!.transverse.position).toBeCloseTo(0.1);
    expect(d.explode).toBeUndefined();
    expect(d.camera).toBeUndefined();
    expect(d.nameLang).toBeUndefined();
    expect(d.pinnedIds).toEqual(['heart']);
  });

  it('encodes hidden nodes as differences from the default-hidden set', () => {
    const defaults = { layers: defaultsLayers, hiddenIds: ['fascia-lata-l', 'fascia-lata-r'] };
    const dctx: UrlDecodeContext = { ...ctx, hiddenIds: defaults.hiddenIds };
    const atDefault = { ...baseState(), hiddenIds: ['fascia-lata-l', 'fascia-lata-r'] };
    expect(encodeShareableState(atDefault, defaults)).toEqual([]);

    const changed = { ...baseState(), hiddenIds: ['fascia-lata-r', 'femur-l'] };
    const enc = encodeShareableState(changed, defaults);
    expect(enc).toEqual([
      ['h', 'femur-l'],
      ['v', 'fascia-lata-l'],
    ]);
    const search = '?' + new URLSearchParams(enc).toString();
    expect(decodeShareableState(search, dctx).hiddenIds?.sort()).toEqual(['fascia-lata-r', 'femur-l']);
    // A link without h/v keeps the defaults (nothing decoded → the store keeps its default-hidden set).
    expect(decodeShareableState('?s=femur-l', dctx).hiddenIds).toBeUndefined();
  });

  it('refuses a future incompatible format', () => {
    expect(decodeShareableState('?u=2&s=heart', ctx)).toEqual({});
  });

  it('keeps unrelated parameters and drops stale atlas keys', () => {
    const search = mergeSearch('?data=mock&s=old&testHooks=1&x=1', [['s', 'heart']]);
    expect(search).toBe('?data=mock&testHooks=1&s=heart');
    expect(mergeSearch('?s=old', [])).toBe('');
    expect(hasUrlState('?data=mock')).toBe(false);
    expect(hasUrlState('?data=mock&e=10')).toBe(true);
  });

  it('skips the camera when it equals the default pose', () => {
    const s = baseState();
    s.camera = { position: [0, 1, 3], target: [0, 1, 0] };
    expect(
      encodeShareableState(s, { ...ctx, camera: { position: [0, 1.0004, 3], target: [0, 1, 0] } }),
    ).toEqual([]);
  });
});
