import { beforeEach, describe, expect, it } from 'vitest';
import { createMockDataSource } from '@/mocks';
import { resetAtlasStore, useAtlasStore } from './store';

const s = () => useAtlasStore.getState();

describe('atlas store', () => {
  beforeEach(async () => {
    resetAtlasStore();
    await s().init(createMockDataSource());
  });

  it('loads manifest, search index and default-visible systems', () => {
    expect(s().dataStatus).toBe('loaded');
    expect(s().searchIndex.length).toBeGreaterThan(30);
    expect(s().layers.skeletal).toEqual({ visible: true, opacity: 1 });
    expect(s().layers.muscular?.visible).toBe(false);
    expect(s().systemLoad.skeletal?.meta).toBe('loaded');
    expect(s().structures['femur-l']?.system).toBe('skeletal');
    expect(s().childrenOf['@skeletal']).toContain('g-axial-skeleton');
  });

  it('loads a hidden system on demand via ensureNodeMeta', async () => {
    expect(s().structures['biceps-brachii-l']).toBeUndefined();
    const node = await s().ensureNodeMeta('biceps-brachii-l');
    expect(node?.nodeType).toBe('structure');
    expect(s().systemLoad.muscular?.meta).toBe('loaded');
  });

  it('routes picks to selection in explore mode and to quizPick in quiz mode', () => {
    s().pickStructure('femur-l');
    expect(s().selectedId).toBe('femur-l');
    s().setMode('quiz');
    s().pickStructure('tibia-r');
    s().pickStructure('tibia-r');
    expect(s().selectedId).toBe('femur-l');
    expect(s().quizPick).toEqual({ id: 'tibia-r', seq: 2 });
  });

  it('isolate never mutates layers/hiddenIds and restores the camera on exit', async () => {
    s().setNodeHidden('cranium', true);
    s().setCamera({ position: [0, 1, 3], target: [0, 1, 0] });
    const layersBefore = s().layers;
    s().select('femur-l');
    s().setIsolate('context');
    expect(s().isolate).toMatchObject({ mode: 'context', ids: ['femur-l'] });
    const pending = s().viewerQueue.length;
    s().exitIsolate();
    expect(s().isolate.mode).toBe('none');
    expect(s().layers).toBe(layersBefore);
    expect(s().hiddenIds).toEqual({ cranium: true });
    expect(s().viewerQueue.length).toBe(pending + 1);
    expect(s().viewerQueue.at(-1)?.command).toMatchObject({ type: 'setCameraPose' });
  });

  it('resolves viewer commands through the queue', async () => {
    const p = s().requestViewer({ type: 'screenshot' });
    const [cmd] = s().viewerQueue;
    expect(cmd?.command.type).toBe('screenshot');
    s().completeViewerCommand(cmd!.id, {
      ok: true,
      type: 'screenshot',
      dataUrl: 'data:',
      width: 1,
      height: 1,
    });
    await expect(p).resolves.toMatchObject({ ok: true, width: 1 });
    expect(s().viewerQueue).toHaveLength(0);
  });

  it('round-trips the shareable state', async () => {
    s().setLayerOpacity('skeletal', 0.4);
    s().setClipPlane('sagittal', { enabled: true, position: 0.3 });
    s().setExplode(0.5);
    s().select('liver');
    const shared = s().getShareableState();
    resetAtlasStore();
    await s().init(createMockDataSource());
    await s().applyShareableState({ ...shared, camera: null });
    expect(s().getShareableState()).toEqual({ ...shared, camera: null });
    expect(s().systemLoad.visceral?.meta).toBe('loaded');
  });

  it('clamps opacity, explode and clip positions', () => {
    s().setLayerOpacity('skeletal', 3);
    s().setExplode(-1);
    s().setClipPlane('coronal', { position: 9 });
    expect(s().layers.skeletal?.opacity).toBe(1);
    expect(s().explode).toBe(0);
    expect(s().clipping.coronal.position).toBe(1);
  });
});
