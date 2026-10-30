import { afterEach, describe, expect, it, vi } from 'vitest';
import { Color, ShaderLib, SRGBColorSpace } from 'three';
import type { HSL, Material, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { CELLS, createDetailNoise, NOISE_SIZE } from './detailNoise';
import { AtlasMaterials, createFibreEnds } from './materials';
import { look, MUSCLE_VARIATION, resetLook, structureColor, surfaceKind, tissueLookEnabled } from './tissue';
import type { Look } from './tissue';

const MUSCLE = '#e76e57';
const muscle = (id: string, en: string) => ({ id, system: 'muscular', color: MUSCLE, names: { en } });
const hsl = (hex: string): HSL => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);
const rgb = (hex: string) => new Color(hex).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
/** HSV value and chroma (sRGB). */
const valueOf = (hex: string) => Math.max(...Object.values(rgb(hex)));
const chromaOf = (hex: string) => valueOf(hex) - Math.min(...Object.values(rgb(hex)));

const FULL: Look = { tissue: true, occlusion: true, bone: true, fibres: true };

function withLook(query: string) {
  window.history.replaceState(null, '', query);
  resetLook();
}

/** Runs a material's onBeforeCompile on the MeshStandardMaterial shader sources. */
function compiled(m: Material) {
  const shader = {
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
    uniforms: {},
  } as unknown as WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
}

describe('tissue look', () => {
  afterEach(() => {
    withLook('/');
    vi.unstubAllGlobals();
  });

  it('varies muscle colours slightly and deterministically, the same on both sides', () => {
    const left = structureColor(muscle('biceps-brachii-l', 'Biceps brachii'));
    expect(structureColor(muscle('biceps-brachii-r', 'Biceps brachii'))).toBe(left);
    expect(structureColor(muscle('biceps-brachii-l', 'Biceps brachii'))).toBe(left);

    const names = ['Biceps brachii', 'Brachialis', 'Deltoid', 'Triceps brachii', 'Sartorius', 'Gracilis'];
    const colours = new Set(names.map((n) => structureColor(muscle(n, n))));
    expect(colours.size).toBe(names.length);
    const base = hsl(MUSCLE);
    for (const hex of colours) {
      const c = hsl(hex);
      const dh = Math.abs(c.h - base.h) * 360;
      // + 8-bit rounding of the hex colour
      expect(Math.min(dh, 360 - dh)).toBeLessThanOrEqual(MUSCLE_VARIATION.hueDegrees + 1);
      expect(Math.abs(valueOf(hex) / valueOf(MUSCLE) - 1)).toBeLessThanOrEqual(
        MUSCLE_VARIATION.brightness + 0.01,
      );
    }
    // Pale structures of the muscular system stay pale (no extra saturation), e.g. the linea alba (#e7fffc).
    for (const n of names) {
      const pale = structureColor({ id: n, system: 'muscular', color: '#e7fffc', names: { en: n } });
      expect(chromaOf(pale)).toBeLessThanOrEqual(chromaOf('#e7fffc') + 0.01);
    }
  });

  it('leaves other systems alone and is off with ?look=plain', () => {
    withLook('/?look=3');
    expect(
      structureColor({ id: 'femur-l', system: 'skeletal', color: '#e7c397', names: { en: 'Femur' } }),
    ).toBe('#e7c397');
    expect(tissueLookEnabled()).toBe(true);
    withLook('/?look=plain');
    expect(tissueLookEnabled()).toBe(false);
    expect(structureColor(muscle('biceps-brachii-l', 'Biceps brachii'))).toBe(MUSCLE);
  });

  it('picks the stage from ?look= and leaves the textures out on weak devices', () => {
    withLook('/?look=1');
    expect(look()).toEqual({ tissue: true, occlusion: false, bone: false, fibres: false });
    withLook('/?look=2');
    expect(look()).toEqual({ tissue: true, occlusion: true, bone: true, fibres: false });
    withLook('/?look=3');
    expect(look()).toEqual(FULL);
    // Fixed for the session: later URL changes (urlSync) do not change it.
    window.history.replaceState(null, '', '/?look=plain');
    expect(look()).toEqual(FULL);

    vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 2 });
    withLook('/');
    expect(look()).toEqual({ tissue: true, occlusion: true, bone: false, fibres: false });
    // Asking for a stage explicitly turns the textures on anyway (for review).
    withLook('/?look=3');
    expect(look()).toEqual(FULL);
    vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 8 });
    withLook('/');
    expect(look()).toEqual(FULL);
  });

  it('maps chunks to surface kinds by system and stage', () => {
    withLook('/?look=3');
    expect(surfaceKind('skeletal', true)).toBe('bone');
    expect(surfaceKind('muscular', true)).toBe('muscle');
    expect(surfaceKind('muscular', false)).toBe('plain');
    expect(surfaceKind('visceral', false)).toBe('plain');
    withLook('/?look=1');
    expect(surfaceKind('skeletal', true)).toBe('tissue');
    expect(surfaceKind('muscular', true)).toBe('tissue');
  });

  it('patches only the tissue materials: attribute, colour mix, roughness (cut faces everywhere)', () => {
    const m = new AtlasMaterials(() => FULL);
    const tissue = m.surfaces('tissue');
    expect(m.surfaces('plain')).toEqual({ opaque: m.opaque, transparent: m.transparent });
    expect(m.surfaces('tissue')).toBe(tissue);
    expect(tissue.transparent.depthWrite).toBe(false);
    expect(tissue.opaque.customProgramCacheKey()).not.toBe(m.opaque.customProgramCacheKey());

    const t = compiled(tissue.opaque);
    expect(t.vertexShader).toContain('attribute vec4 tissue;');
    expect(t.vertexShader).toContain('vTissue = tissue.xyz;');
    const f = t.fragmentShader;
    expect(f).toContain('varying vec3 vTissue;');
    // The mask is declared before the roughness step uses it, and both come after the includes they extend.
    const mask = f.indexOf('vec2 tissueMask');
    const rough = f.indexOf('roughnessFactor = mix( roughnessFactor');
    expect(mask).toBeGreaterThan(f.indexOf('#include <color_fragment>'));
    expect(rough).toBeGreaterThan(Math.max(mask, f.indexOf('#include <roughnessmap_fragment>')));
    expect(f).toContain('gl_FrontFacing');
    // stage 1 only: no occlusion, no textures
    expect(f).not.toContain('occlusion');
    expect(f).not.toContain('detailNoise');

    const plain = compiled(m.opaque);
    expect(plain.vertexShader).not.toContain('tissue');
    expect(plain.fragmentShader).not.toContain('tissue');
    expect(plain.fragmentShader).toContain('gl_FrontFacing');
    m.dispose();
  });

  it('gives bones occlusion, the surface texture and spongy cut faces', () => {
    const m = new AtlasMaterials(() => FULL);
    const bone = m.surfaces('bone');
    const s = compiled(bone.opaque);
    expect(s.uniforms.detailNoise?.value).toBeTruthy();
    expect(s.vertexShader).toContain('vDetailPos = position;');
    const f = s.fragmentShader;
    // _TISSUE B is 0..31 (pipeline/blender/shading.py OCCLUSION_STEPS)
    expect(f).toContain('float occlusion = min( vTissue.z * 8.2258, 1.0 );');
    expect(f).toContain('uniform highp sampler3D detailNoise;');
    expect(f).toContain('textureGrad( detailNoise, boneQ');
    expect(f).toContain('spongyCut( cutBase )');
    // helpers are defined before main, after the uniforms they use
    expect(f.indexOf('vec3 cutPoint()')).toBeLessThan(f.indexOf('void main() {'));
    expect(f.indexOf('vec3 cutPoint()')).toBeGreaterThan(
      f.indexOf('#include <clipping_planes_pars_fragment>'),
    );
    expect(f.indexOf('normal = detailNormal(')).toBeGreaterThan(f.indexOf('#include <normal_fragment_maps>'));
    expect(f.indexOf('reflectedLight.directSpecular *= 1.0 - occlusion')).toBeGreaterThan(
      f.indexOf('#include <aomap_fragment>'),
    );
    expect(f).not.toContain('vFibre');
    // Without the textures (weak device / ?look=2 on muscles) the same kind keeps only the occlusion.
    const shaded = compiled(new AtlasMaterials(() => ({ ...FULL, bone: false })).surfaces('bone').opaque);
    expect(shaded.fragmentShader).toContain('float occlusion');
    expect(shaded.fragmentShader).not.toContain('detailNoise');
    m.dispose();
  });

  it('gives every muscle chunk its own pair bound to its fibre ends', () => {
    const m = new AtlasMaterials(() => FULL);
    expect(m.needsFibreEnds('muscle')).toBe(true);
    expect(m.needsFibreEnds('bone')).toBe(false);
    const endsA = createFibreEnds([[0, 1, 0, 0, 1.2, 0], undefined]);
    const endsB = createFibreEnds([undefined]);
    const a = m.surfaces('muscle', endsA);
    const b = m.surfaces('muscle', endsB);
    expect(a.opaque).not.toBe(b.opaque);
    expect(a.opaque.customProgramCacheKey()).toBe(b.opaque.customProgramCacheKey()); // one program
    expect(m.all).toEqual(expect.arrayContaining([a.opaque, a.transparent, b.opaque, b.transparent]));
    const s = compiled(a.transparent);
    expect(s.uniforms.fibreEnds?.value).toBe(endsA);
    expect(s.vertexShader).toContain('getIndirectIndex( gl_DrawID )');
    expect(s.fragmentShader).toContain('varying vec4 vFibre;');
    m.release(a);
    expect(m.all).not.toContain(a.opaque);
    m.release(m.surfaces('tissue')); // shared: no-op
    expect(m.all).toContain(m.surfaces('tissue').opaque);
    m.dispose();
    endsA.dispose();
    endsB.dispose();
  });

  it('lays out fibre ends two texels per instance (w = 1 marks a muscle with ends)', () => {
    const tex = createFibreEnds([[1, 2, 3, 4, 5, 6], undefined, [7, 8, 9, 10, 11, 12]]);
    const data = tex.image.data as Float32Array;
    expect(tex.image.width * tex.image.height).toBeGreaterThanOrEqual(6);
    expect([...data.slice(0, 8)]).toEqual([1, 2, 3, 1, 4, 5, 6, 0]);
    expect([...data.slice(8, 16)]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect([...data.slice(16, 24)]).toEqual([7, 8, 9, 1, 10, 11, 12, 0]);
    tex.dispose();
  });

  it('builds a tileable, mipmapped 3D noise texture', () => {
    const tex = createDetailNoise();
    const data = tex.image.data as Uint8Array;
    expect(tex.image.width).toBe(NOISE_SIZE);
    expect(data.length).toBe(NOISE_SIZE ** 3 * 4);
    expect(tex.generateMipmaps).toBe(true);
    const mean = (c: number) =>
      data.filter((_, i) => i % 4 === c).reduce((a, b) => a + b, 0) / NOISE_SIZE ** 3;
    expect(mean(0) / 255).toBeCloseTo(0.5, 1);
    expect(mean(1) / 255).toBeCloseTo(0.5, 1);
    // Cellular F1: one point per cell → nearest point within ≈ 0.4 cells on average, sometimes very close.
    expect(mean(2) / 255).toBeGreaterThan(0.25);
    expect(mean(2) / 255).toBeLessThan(0.6);
    expect(Math.min(...data.filter((_, i) => i % 4 === 2))).toBeLessThan(0.1 * 255);
    expect(CELLS).toBe(8);
    // Deterministic
    expect(createDetailNoise().image.data).toEqual(data);
    tex.dispose();
  });
});
