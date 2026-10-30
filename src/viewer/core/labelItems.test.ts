import { beforeEach, describe, expect, it } from 'vitest';
import { createMockDataSource } from '@/mocks';
import { resetAtlasStore, useAtlasStore } from '@/state';
import { resolveLabelItems } from './labelItems';
import { computeTints } from './tints';

const s = () => useAtlasStore.getState();
const all = () => true;

describe('label items', () => {
  beforeEach(async () => {
    resetAtlasStore();
    await s().init(createMockDataSource());
  });

  it('selected first, then pinned, without duplicates', () => {
    s().select('femur-l');
    s().togglePinned('liver');
    s().togglePinned('femur-l');
    const items = resolveLabelItems(s(), all);
    expect(items.map((i) => i.key)).toEqual(['femur-l', 'liver']);
    expect(items[0]!.selected).toBe(true);
    expect(items[0]!.side).toBe('left');
    expect(items[0]!.anchor).toEqual(s().structures['femur-l']!.labelAnchor);
  });

  it('uses the name language with Latin → English fallback', () => {
    s().select('liver');
    expect(resolveLabelItems(s(), all)[0]!.text).toBe('Hepar');
    s().setNameLang('en');
    expect(resolveLabelItems(s(), all)[0]!.text).toBe('Liver');
  });

  it('is empty in quiz mode or with labels off', () => {
    s().select('liver');
    s().setMode('quiz');
    expect(resolveLabelItems(s(), all)).toEqual([]);
    s().setMode('explore');
    s().setLabelsVisible(false);
    expect(resolveLabelItems(s(), all)).toEqual([]);
  });

  it('landmarks follow their structure and use their own anchor', () => {
    s().select('lm-greater-trochanter-r');
    const [item] = resolveLabelItems(s(), all);
    expect(item!.structureId).toBe('femur-r');
    expect(item!.anchor).toEqual([-0.115, 0.86, 0]);
    expect(item!.side).toBe('right');
  });

  it('groups point at a member structure, preferring visible ones', () => {
    s().select('g-appendicular-skeleton');
    const [item] = resolveLabelItems(s(), all);
    expect(s().structures[item!.structureId]!.parentId).toBe('g-appendicular-skeleton');
    const onlyRight = (id: string) => id.endsWith('-r');
    const [r] = resolveLabelItems(s(), onlyRight);
    expect(r!.structureId.endsWith('-r')).toBe(true);
  });

  it('tints: hover < selected < quiz highlights, groups expand', () => {
    s().setHovered('femur-l');
    s().select('g-appendicular-skeleton');
    s().setHighlights({ 'tibia-r': 'quiz-wrong' });
    const t = computeTints(s());
    expect(t.get('femur-l')).toBe('selected');
    expect(t.get('humerus-r')).toBe('selected');
    expect(t.get('tibia-r')).toBe('quiz-wrong');
    expect(t.has('cranium')).toBe(false);
  });

  it('tints: an isolated selection keeps its colours; other selections and context isolate do not', () => {
    s().select('femur-l');
    s().setIsolate('isolate');
    expect(computeTints(s()).has('femur-l')).toBe(false);
    s().select('tibia-l');
    expect(computeTints(s()).get('tibia-l')).toBe('selected');
    s().select('femur-l');
    s().setIsolate('context');
    expect(computeTints(s()).get('femur-l')).toBe('selected');
  });
});
