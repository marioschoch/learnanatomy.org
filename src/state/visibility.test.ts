import { beforeEach, describe, expect, it } from 'vitest';
import { GHOST_OPACITY, XRAY_OPACITY } from '@/contract';
import { createMockDataSource } from '@/mocks';
import { resetAtlasStore, useAtlasStore } from './store';
import { buildVisibilityContext, structureRender, systemsNeedingGeometry } from './visibility';

const s = () => useAtlasStore.getState();
const render = (id: string) => structureRender(buildVisibilityContext(s()), s().structures[id]!);

describe('visibility rules', () => {
  beforeEach(async () => {
    resetAtlasStore();
    await s().init(createMockDataSource());
    await s().ensureSystemMeta('muscular');
  });

  it('follows layer visibility and opacity', () => {
    expect(render('femur-l')).toEqual({ mode: 'normal', opacity: 1, pickable: true });
    expect(render('biceps-brachii-l').mode).toBe('hidden');
    s().setLayerOpacity('skeletal', 0.03);
    expect(render('femur-l')).toMatchObject({ mode: 'normal', pickable: false });
    s().setLayerOpacity('skeletal', 0);
    expect(render('femur-l').mode).toBe('hidden');
  });

  it('hides descendants of hidden groups', () => {
    s().setNodeHidden('g-appendicular-skeleton', true);
    expect(render('femur-l').mode).toBe('hidden');
    expect(render('cranium').mode).toBe('normal');
  });

  it('caps outer layers in x-ray but keeps the innermost layer', () => {
    s().setLayerVisible('muscular', true);
    s().setXray(true);
    expect(render('femur-l').opacity).toBe(1);
    expect(render('biceps-brachii-l').opacity).toBe(XRAY_OPACITY);
    expect(render('heart').opacity).toBe(XRAY_OPACITY);
  });

  it('isolate shows only the set, even from hidden layers; context ghosts the rest', () => {
    s().setIsolate('isolate', ['g-muscles-of-upper-limb']);
    expect(render('biceps-brachii-l')).toEqual({ mode: 'normal', opacity: 1, pickable: true });
    expect(render('femur-l').mode).toBe('hidden');
    expect(systemsNeedingGeometry(s())).toContain('muscular');
    s().setIsolate('context', ['heart']);
    expect(render('heart').mode).toBe('normal');
    expect(render('femur-l')).toEqual({ mode: 'ghost', opacity: GHOST_OPACITY, pickable: false });
    expect(render('biceps-brachii-l').mode).toBe('hidden');
  });

  it('isolating a landmark isolates its structure', () => {
    s().setIsolate('isolate', ['lm-greater-trochanter-l']);
    expect(render('femur-l').mode).toBe('normal');
    expect(render('femur-r').mode).toBe('hidden');
  });
});
