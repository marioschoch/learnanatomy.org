/**
 * Layer presets. Only systems present in the manifest are used; systems not mentioned are hidden
 * (applyLayerPreset semantics). Context bones are shown semi-transparent for orientation.
 */
import type { BySystem, LayerState, Manifest } from '@/contract';

export type PresetId =
  'skeleton' | 'bonesMuscles' | 'circulation' | 'nervous' | 'organs' | 'fullXray' | 'reset';

export const PRESET_IDS: PresetId[] = [
  'skeleton',
  'bonesMuscles',
  'circulation',
  'nervous',
  'organs',
  'fullXray',
  'reset',
];

const CONTEXT_BONES = 0.35;

type PresetLayers = Partial<BySystem<Partial<LayerState>>>;

const PRESETS: Record<Exclude<PresetId, 'fullXray' | 'reset'>, PresetLayers> = {
  skeleton: { skeletal: { visible: true, opacity: 1 } },
  bonesMuscles: { skeletal: { visible: true, opacity: 1 }, muscular: { visible: true, opacity: 1 } },
  circulation: {
    cardiovascular: { visible: true, opacity: 1 },
    skeletal: { visible: true, opacity: CONTEXT_BONES },
  },
  nervous: { nervous: { visible: true, opacity: 1 }, skeletal: { visible: true, opacity: CONTEXT_BONES } },
  organs: {
    visceral: { visible: true, opacity: 1 },
    lymphoid: { visible: true, opacity: 1 },
    skeletal: { visible: true, opacity: CONTEXT_BONES },
  },
};

/** Layers for a preset, restricted to the systems of this manifest. `null` for "reset". */
export function presetLayers(
  id: PresetId,
  manifest: Manifest | null,
): { layers: PresetLayers; xray: boolean } | null {
  if (id === 'reset') return null;
  const systems = new Set(manifest?.systems.map((s) => s.id) ?? []);
  if (id === 'fullXray') {
    const layers: PresetLayers = {};
    for (const s of manifest?.systems ?? []) layers[s.id] = { visible: true, opacity: 1 };
    return { layers, xray: true };
  }
  const layers: PresetLayers = {};
  for (const [sys, l] of Object.entries(PRESETS[id])) if (systems.has(sys) && l) layers[sys] = l;
  return { layers, xray: false };
}

/** Whether a preset can do anything with this manifest (e.g. no nervous system in the mock data). */
export function presetAvailable(id: PresetId, manifest: Manifest | null): boolean {
  if (id === 'reset' || id === 'fullXray') return Boolean(manifest);
  const main: Record<string, string> = {
    skeleton: 'skeletal',
    bonesMuscles: 'muscular',
    circulation: 'cardiovascular',
    nervous: 'nervous',
    organs: 'visceral',
  };
  return Boolean(manifest?.systems.some((s) => s.id === main[id]));
}
