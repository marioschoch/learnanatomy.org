import { describe, expect, it } from 'vitest';
import { MOCK_STRUCTURES, mockManifest, mockSearchEntries, mockStructuresFile } from './mockData';
import { buildMockGeometry } from './mockGeometry';

const centerX = (id: string) => MOCK_STRUCTURES.find((m) => m.id === id)!.center[0];

describe('mock data', () => {
  it('has 3 systems and ~30 structures with unique, URL-safe ids', () => {
    const m = mockManifest();
    expect(m.systems).toHaveLength(3);
    expect(MOCK_STRUCTURES.length).toBeGreaterThanOrEqual(30);
    const ids = mockSearchEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('respects the orientation convention (+X = patient left)', () => {
    expect(centerX('liver')).toBeLessThan(0);
    expect(centerX('heart')).toBeGreaterThan(0);
    expect(centerX('stomach')).toBeGreaterThan(0);
    expect(centerX('spleen')).toBeGreaterThan(0);
    for (const m of MOCK_STRUCTURES) {
      if (m.side === 'left') expect(m.center[0]).toBeGreaterThan(0);
      if (m.side === 'right') expect(m.center[0]).toBeLessThan(0);
    }
    const cranium = MOCK_STRUCTURES.find((m) => m.id === 'cranium')!;
    const tibia = MOCK_STRUCTURES.find((m) => m.id === 'tibia-l')!;
    expect(cranium.center[1]).toBeGreaterThan(tibia.center[1]);
  });

  it('links left/right pairs and parents', () => {
    const sk = mockStructuresFile('skeletal');
    const femurL = sk.structures.find((s) => s.id === 'femur-l')!;
    expect(femurL.pairId).toBe('femur-r');
    expect(femurL.side).toBe('left');
    const groupIds = new Set(sk.groups.map((g) => g.id));
    for (const s of sk.structures) if (s.parentId) expect(groupIds.has(s.parentId)).toBe(true);
  });

  it('builds indexed geometry with position + normal only, inside the declared bbox', () => {
    for (const spec of MOCK_STRUCTURES) {
      const g = buildMockGeometry(spec);
      expect(g.index).not.toBeNull();
      expect(Object.keys(g.attributes).sort()).toEqual(['normal', 'position']);
      const st = mockStructuresFile(spec.system).structures.find((s) => s.id === spec.id)!;
      const bb = g.boundingBox!;
      expect(bb.min.x).toBeGreaterThanOrEqual(st.bbox.min[0] - 1e-6);
      expect(bb.max.y).toBeLessThanOrEqual(st.bbox.max[1] + 1e-6);
    }
  });
});
