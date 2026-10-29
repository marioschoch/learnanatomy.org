// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { baseId, isValidId, parseName, resolveIds, sideFromName, slug } from './names.mjs';

describe('slug', () => {
  it('follows ARCHITECTURE.md §4.3', () => {
    expect(slug('Femur')).toBe('femur');
    expect(slug('Vagus nerve (X)')).toBe('vagus-nerve-x');
    expect(slug('Atlas (C1)')).toBe('atlas-c1');
    expect(slug("Central canal'")).toBe('central-canal');
    expect(slug('[Trochlear spine]')).toBe('trochlear-spine');
    expect(slug(' Posterior transverse collateral sulcus')).toBe('posterior-transverse-collateral-sulcus');
    expect(slug('Fémur')).toBe('femur');
    expect(slug('Nervus vagus — ramus/ cardiacus')).toBe('nervus-vagus-ramus-cardiacus');
    expect(slug("Langerhans' islets")).toBe('langerhans-islets');
  });
  it('produces URL-safe ids', () => {
    for (const s of ['(Accessory parotid gland)', 'Muscles of left upper limb', 'Ligament – 2', 'Sehne_ä']) {
      expect(isValidId(slug(s))).toBe(true);
    }
    expect(isValidId('femur-l')).toBe(true);
    expect(isValidId('Femur')).toBe(false);
    expect(isValidId('femur--l')).toBe(false);
    expect(isValidId('-femur')).toBe(false);
    expect(isValidId('')).toBe(false);
  });
});

describe('parseName', () => {
  it('reads side suffixes', () => {
    expect(parseName('Femur.l')).toMatchObject({
      base: 'Femur',
      side: 'left',
      kind: 'structure',
      suffix: '.l',
    });
    expect(parseName('Femur.r')).toMatchObject({ base: 'Femur', side: 'right' });
    expect(parseName('Liver')).toMatchObject({ base: 'Liver', suffix: '', kind: 'structure' });
    expect(parseName('Liver').side).toBeUndefined();
  });
  it('reads origin / insertion patches with optional number', () => {
    expect(parseName('Biceps brachii muscle.el')).toMatchObject({
      base: 'Biceps brachii muscle',
      kind: 'insertion',
      side: 'left',
    });
    expect(parseName('Deltoid muscle.or')).toMatchObject({ kind: 'origin', side: 'right', patch: undefined });
    expect(parseName('Diaphragm.o2r')).toMatchObject({
      base: 'Diaphragm',
      kind: 'origin',
      patch: 2,
      side: 'right',
    });
    expect(parseName('Flexor digitorum brevis.e10l')).toMatchObject({
      kind: 'insertion',
      patch: 10,
      side: 'left',
    });
  });
  it('reads helper suffixes', () => {
    expect(parseName('Bones of lower limb.g')).toMatchObject({ base: 'Bones of lower limb', kind: 'group' });
    expect(parseName('Acetabular fossa.s')).toMatchObject({ base: 'Acetabular fossa', kind: 'label' });
    expect(parseName('Femur.t')).toMatchObject({ kind: 'label' });
    expect(parseName('Femur.j')).toMatchObject({ kind: 'line' });
  });
  it('trims a leading space and keeps parentheses', () => {
    expect(parseName(' Posterior transverse collateral sulcus.l').base).toBe(
      'Posterior transverse collateral sulcus',
    );
    expect(parseName('(Accessory parotid gland).l').base).toBe('(Accessory parotid gland)');
  });
});

describe('sideFromName', () => {
  it('detects leading Left/Right and "of left/right"', () => {
    expect(sideFromName('Left ventricle')).toBe('left');
    expect(sideFromName('Right atrium')).toBe('right');
    expect(sideFromName('Intrarenal arteries of left kidney')).toBe('left');
    expect(sideFromName('Anterior segment of the right lung')).toBe('right');
  });
  it('ignores names without a side or with both sides', () => {
    expect(sideFromName('Liver')).toBeUndefined();
    expect(sideFromName('Leftover')).toBeUndefined();
    expect(sideFromName('Brightness')).toBeUndefined();
    expect(sideFromName('Left ventricle of right heart')).toBeUndefined();
    expect(sideFromName('Upright muscle')).toBeUndefined();
  });
});

describe('baseId', () => {
  it('builds ids per kind', () => {
    expect(baseId('structure', 'Femur', { side: 'left', sideFromSuffix: true })).toBe('femur-l');
    expect(baseId('structure', 'Left ventricle', { side: 'left', sideFromSuffix: false })).toBe(
      'left-ventricle',
    );
    expect(baseId('structure', 'Liver')).toBe('liver');
    expect(baseId('origin', 'Biceps brachii muscle', { side: 'left' })).toBe(
      'biceps-brachii-muscle-origin-l',
    );
    expect(baseId('insertion', 'Diaphragm', { side: 'right', patch: 2 })).toBe('diaphragm-insertion-2-r');
    expect(baseId('group', 'Bones of lower limb')).toBe('g-bones-of-lower-limb');
    expect(baseId('landmark', 'Acetabular fossa', { side: 'left' })).toBe('lm-acetabular-fossa-l');
    expect(baseId('landmark', 'Linea aspera')).toBe('lm-linea-aspera');
  });
});

describe('resolveIds', () => {
  it('keeps unique stems and resolves collisions deterministically', () => {
    const items = [
      { key: 'b', stem: 'central-canal', sourceName: "Central canal'", system: 'nervous', systemOrder: 6 },
      { key: 'a', stem: 'central-canal', sourceName: 'Central canal', system: 'nervous', systemOrder: 6 },
      { key: 'c', stem: 'femur-l', sourceName: 'Femur.l', system: 'skeletal', systemOrder: 0 },
      {
        key: 'd',
        stem: 'central-canal',
        sourceName: 'Central canal (x)',
        system: 'skeletal',
        systemOrder: 0,
      },
    ];
    const { ids, collisions } = resolveIds(items);
    expect(ids.get('c')).toBe('femur-l');
    expect(ids.get('a')).toBe('central-canal');
    expect(ids.get('d')).toBe('central-canal-skeletal');
    expect(ids.get('b')).toBe('central-canal-nervous');
    expect(collisions).toHaveLength(1);
    // order of input does not matter
    const again = resolveIds([...items].reverse());
    expect([...again.ids.entries()].sort()).toEqual([...ids.entries()].sort());
  });
  it('appends -2, -3 within the same system', () => {
    const items = ['X.1', 'X.2', 'X.3'].map((n, i) => ({
      key: n,
      stem: 'x',
      sourceName: n,
      system: 'joints',
      systemOrder: i,
    }));
    const { ids } = resolveIds(items);
    expect(ids.get('X.1')).toBe('x');
    expect(ids.get('X.2')).toBe('x-joints');
    expect(ids.get('X.3')).toBe('x-joints-2');
    expect(new Set(ids.values()).size).toBe(3);
  });
  it('never reuses an id that is another stem', () => {
    const items = [
      { key: 'a', stem: 'x', sourceName: 'A', system: 'joints' },
      { key: 'b', stem: 'x', sourceName: 'B', system: 'joints' },
      { key: 'c', stem: 'x-joints', sourceName: 'C', system: 'skeletal' },
    ];
    const { ids } = resolveIds(items);
    expect(new Set(ids.values()).size).toBe(3);
    expect(ids.get('c')).toBe('x-joints');
    expect(ids.get('b')).toBe('x-joints-2');
  });
});
