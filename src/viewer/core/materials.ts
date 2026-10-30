/**
 * The materials shared by every BatchedMesh of the atlas.
 *
 * Colour and alpha are per instance (BatchedMesh colour texture, Vector4), so one material per *pass* is enough:
 *  - opaque:      layers at 100 % — depthWrite on, drawn in three's opaque list (before anything transparent)
 *  - transparent: layers < 100 % and ghosts — depthWrite off, blended, ordered by renderOrder (= layerOrder)
 *  - depthPrepass: colorWrite off, depthWrite on. Drawn right before a transparent layer's colour pass so the
 *                 colour pass (depthFunc LessEqual) only shades the front-most surface of that layer: no
 *                 self-overlap (a muscle's back side or the muscle behind it does not darken the layer).
 *
 * All of them share ONE `clippingPlanes` array (mutated in place; three.js recompiles when the plane count changes).
 *
 * Cut surfaces: with any plane enabled the materials become DoubleSide and the fragment shader paints back faces
 * (`!gl_FrontFacing`) in a flat, unlit "cut" colour derived from the structure colour, so sections look solid
 * instead of hollow. This relies on consistent outward winding — the pipeline bakes mirrored clones with flipped
 * winding (ARCHITECTURE.md §4.4), and decodeGlb flips winding for any negative-determinant node as a safety net.
 * Without clipping we use FrontSide: cheaper, and transparent layers never show their own inside.
 *
 * Tissue look (tissue.ts): chunks whose geometry has a `tissue` attribute get an opaque/transparent pair of their
 * surface kind instead of the plain pair:
 *  - tissue: tendon and cartilage faces mixed towards the tissue colour, with lower roughness
 *  - bone:   + baked occlusion, a bone surface texture (colour variation, grain, sparse pores, as bump) and
 *            spongy bone on cut faces
 *  - muscle: + baked occlusion and fibres (or a plain texture). The fibre field needs per-instance data (the two
 *            fibre ends from the pipeline), read from a small float texture by instance id like BatchedMesh's own
 *            matrices; every muscle chunk therefore owns its pair (same program, own uniform).
 * The textures sample one small 3D noise texture (detailNoise.ts) in body space, so the pattern sticks to the
 * structure when exploding. Other chunks keep the plain shaders, so they need neither the attribute nor the math.
 */
import {
  Color,
  DataTexture,
  DoubleSide,
  FloatType,
  FrontSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RGBAFormat,
} from 'three';
import type { Data3DTexture, IUniform, Material, Plane, Side, Texture } from 'three';
import { CELLS, createDetailNoise } from './detailNoise';
import {
  BONE_SURFACE,
  CARTILAGE,
  DETAIL_FADE,
  FIBRES,
  look,
  OCCLUSION,
  SPONGY,
  TENDON,
  TISSUE_EDGE,
} from './tissue';
import type { Look, SurfaceKind } from './tissue';

/** Brightness of the flat cut colour relative to the structure colour. */
export const CUT_SHADE = 0.68;

const glslFloat = (v: number) => v.toFixed(4);
/** Lengths in metres need more digits (pore depth ≈ 6e-5). */
const glslLength = (v: number) => v.toExponential(4);
function glslColor(hex: string): string {
  const c = new Color(hex); // linear working space, like the instance colours
  return `vec3( ${glslFloat(c.r)}, ${glslFloat(c.g)}, ${glslFloat(c.b)} )`;
}

interface Features {
  tissue: boolean;
  /** Darkening at full occlusion; 0 = baked occlusion off. */
  occlusion: number;
  bone: boolean;
  fibres: boolean;
}

const OCCLUSION_OF: Partial<Record<SurfaceKind, number>> = { bone: OCCLUSION.bone, muscle: OCCLUSION.muscle };

function featuresOf(kind: SurfaceKind, l: Look): Features {
  return {
    tissue: kind !== 'plain',
    occlusion: l.occlusion ? (OCCLUSION_OF[kind] ?? 0) : 0,
    bone: kind === 'bone' && l.bone,
    fibres: kind === 'muscle' && l.fibres,
  };
}

const programKey = (f: Features) =>
  f.tissue
    ? `atlas-tissue-v2${f.occlusion ? '-occlusion' : ''}${f.bone ? '-bone' : ''}${f.fibres ? '-fibres' : ''}`
    : 'atlas-cut-v1';

// ------------------------------------------------------------------------------------------------ vertex

function vertexPars(f: Features): string {
  return [
    '#include <common>',
    'attribute vec4 tissue;',
    'varying vec3 vTissue;',
    ...(f.bone ? ['varying vec3 vDetailPos;', 'varying vec3 vDetailOffset;'] : []),
    ...(f.fibres ? ['uniform highp sampler2D fibreEnds;', 'varying vec4 vFibre;'] : []),
  ].join('\n');
}

const BONE_VERTEX = /* glsl */ `
	vDetailPos = position;
	#ifdef USE_BATCHING
		vDetailOffset = batchingMatrix[ 3 ].xyz;
	#else
		vDetailOffset = vec3( 0.0 );
	#endif`;

/**
 * Fibre field (tissue.ts FIBRES): the fibre through a point is the circular arc through both ends a and b in the
 * plane of the a–b axis and the point. With x along the axis from the midpoint, rho the distance from the axis and
 * h half the a–b distance, that arc's bulge m (largest distance from the axis) is the same all along it, so
 * r̂·m identifies the fibre. Scaling the radial vector to m and compressing x gives a coordinate in which the noise
 * is constant along fibres and stretched along them. w = 0 (no ends): plain texture in body space.
 */
const FIBRE_VERTEX = /* glsl */ `
	vFibre = vec4( position, 0.0 );
	#ifdef USE_BATCHING
		int fibreTexel = int( getIndirectIndex( gl_DrawID ) ) * 2;
		int fibreSize = textureSize( fibreEnds, 0 ).x;
		vec4 fibreA = texelFetch( fibreEnds, ivec2( fibreTexel % fibreSize, fibreTexel / fibreSize ), 0 );
		fibreTexel += 1;
		vec4 fibreB = texelFetch( fibreEnds, ivec2( fibreTexel % fibreSize, fibreTexel / fibreSize ), 0 );
		if ( fibreA.w > 0.5 ) {
			float fibreH = 0.5 * distance( fibreA.xyz, fibreB.xyz );
			vec3 fibreAxis = ( fibreB.xyz - fibreA.xyz ) / max( 2.0 * fibreH, 1e-6 );
			vec3 fibreRel = position - 0.5 * ( fibreA.xyz + fibreB.xyz );
			float fibreX = dot( fibreRel, fibreAxis );
			vec3 fibreR = fibreRel - fibreX * fibreAxis;
			float fibreRho = max( length( fibreR ), 1e-5 );
			float fibreC = ( fibreX * fibreX + fibreRho * fibreRho - fibreH * fibreH ) / ( 2.0 * fibreRho );
			float fibreS = sqrt( fibreH * fibreH + fibreC * fibreC );
			float fibreM = fibreC > 0.0 ? fibreC + fibreS : fibreH * fibreH / ( fibreS - fibreC );
			vFibre = vec4( fibreR * min( fibreM / fibreRho, ${glslFloat(FIBRES.converge)} ) + fibreAxis * ( fibreX * ${glslFloat(FIBRES.stretch)} ), 1.0 );
		}
	#endif`;

function vertexMain(f: Features): string {
  return `#include <begin_vertex>
	vTissue = tissue.xyz;${f.bone ? BONE_VERTEX : ''}${f.fibres ? FIBRE_VERTEX : ''}`;
}

// ------------------------------------------------------------------------------------------------ fragment

function fragmentPars(f: Features): string {
  return [
    '#include <common>',
    'varying vec3 vTissue;',
    ...(f.bone || f.fibres ? ['uniform highp sampler3D detailNoise;'] : []),
    ...(f.bone ? ['varying vec3 vDetailPos;', 'varying vec3 vDetailOffset;'] : []),
    ...(f.fibres ? ['varying vec4 vFibre;'] : []),
  ].join('\n');
}

/**
 * The detail is computed only where it is visible: the texture lookups sit in a branch on the fade, so they take
 * explicit gradients (implicit ones are undefined inside non-uniform control flow), and the derivatives the bump
 * and the fade need are taken outside it.
 */
const DETAIL_FUNCTIONS = /* glsl */ `
// Noise cells per pixel for coordinate q with screen derivatives dqx, dqy.
float detailCells( vec3 dqx, vec3 dqy ) {
	return length( abs( dqx ) + abs( dqy ) ) * ${glslFloat(CELLS)};
}
// 1 while the noise cells span a few pixels, 0 once they would only shimmer (zoomed out).
float detailFade( float cells ) {
	return 1.0 - smoothstep( ${glslFloat(DETAIL_FADE[0])}, ${glslFloat(DETAIL_FADE[1])}, cells );
}
// three's perturbNormalArb with a procedural height (view-space metres).
vec3 detailNormal( vec3 surfPos, vec3 surfNorm, float height, float faceDir ) {
	vec3 sx = dFdx( surfPos );
	vec3 sy = dFdy( surfPos );
	vec3 r1 = cross( sy, surfNorm );
	vec3 r2 = cross( surfNorm, sx );
	float det = dot( sx, r1 ) * faceDir;
	vec3 grad = sign( det ) * ( dFdx( height ) * r1 + dFdy( height ) * r2 );
	return normalize( abs( det ) * surfNorm - grad );
}
`;

/**
 * Spongy bone (tissue.ts SPONGY) on the cut face. A back face seen through a cut lies behind the cutting plane,
 * so the pattern is sampled where the view ray crosses the plane: the last plane it crosses before the fragment
 * (perspective camera at the view-space origin), in body space without the explode offset.
 */
const SPONGY_FUNCTIONS = /* glsl */ `
#if NUM_CLIPPING_PLANES > 0
vec3 cutPoint() {
	vec3 frag = - vViewPosition;
	float best = 0.0;
	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
		vec4 plane = clippingPlanes[ i ];
		float t = - plane.w / dot( frag, plane.xyz );
		if ( t > best && t < 1.0 ) best = t;
	}
	vec3 view = frag * ( best > 0.0 ? best : 1.0 );
	return transpose( mat3( viewMatrix ) ) * ( view - viewMatrix[ 3 ].xyz ) - vDetailOffset;
}
vec3 spongyCut( vec3 base ) {
	vec3 q = cutPoint() / ${glslLength(SPONGY.period)};
	float walls = 1.0 - smoothstep( ${glslFloat(SPONGY.wall)}, ${glslFloat(SPONGY.wall + SPONGY.soft)}, texture( detailNoise, q ).a );
	vec3 marrow = mix( base, ${glslColor(SPONGY.marrow)}, ${glslFloat(SPONGY.marrowMix)} ) * ${glslFloat(SPONGY.marrowShade)};
	vec3 spongy = mix( marrow, base * 0.92, walls );
	return mix( base * ${glslFloat(CUT_SHADE)}, spongy, detailFade( detailCells( dFdx( q ), dFdy( q ) ) ) );
}
#endif
`;

const TISSUE_COLOR = /* glsl */ `
	// Cut faces show the structure colour: the tissue under this pixel is the far side's, not the cut's.
	vec3 cutBase = diffuseColor.rgb;
	// Tendon (x) and cartilage (y) faces of the source → pale tissue colour (see tissue.ts).
	vec2 tissueMask = smoothstep( ${glslFloat(TISSUE_EDGE[0])}, ${glslFloat(TISSUE_EDGE[1])}, vTissue.xy );
	diffuseColor.rgb = mix( diffuseColor.rgb, ${glslColor(TENDON.color)}, tissueMask.x * ${glslFloat(TENDON.mix)} );
	diffuseColor.rgb = mix( diffuseColor.rgb, ${glslColor(CARTILAGE.color)}, tissueMask.y * ${glslFloat(CARTILAGE.mix)} );
	float detailHeight = 0.0;`;

const occlusionColor = (strength: number) => /* glsl */ `
	// Baked creases and hollows (_TISSUE B).
	float occlusion = min( vTissue.z * ${glslFloat(255 / OCCLUSION.steps)}, 1.0 );
	diffuseColor.rgb *= 1.0 - occlusion * ${glslFloat(strength)};`;

const BONE_COLOR = /* glsl */ `
	{
		// Bone surface (tissue.ts BONE_SURFACE): soft colour variation, fine grain and sparse pores (cartilage stays smooth).
		vec4 coarse = texture( detailNoise, vDetailPos / ${glslLength(BONE_SURFACE.blotchPeriod)} + vec3( 0.31, 0.47, 0.13 ) );
		float warm = ( coarse.g - 0.5 ) * ${glslFloat(2 * BONE_SURFACE.warmth)};
		diffuseColor.rgb *= ( 1.0 + ( coarse.r - 0.5 ) * ${glslFloat(2 * BONE_SURFACE.blotch)} ) * vec3( 1.0 + 0.5 * warm, 1.0, 1.0 - warm );
		vec3 boneQ = vDetailPos / ${glslLength(BONE_SURFACE.period)};
		vec3 boneQx = dFdx( boneQ );
		vec3 boneQy = dFdy( boneQ );
		float boneDetail = detailFade( detailCells( boneQx, boneQy ) ) * ( 1.0 - tissueMask.y );
		if ( boneDetail > 0.0 ) {
			vec4 fine = textureGrad( detailNoise, boneQ, boneQx, boneQy );
			float pore = ( 1.0 - smoothstep( ${glslFloat(BONE_SURFACE.pores * 0.5)}, ${glslFloat(BONE_SURFACE.pores)}, fine.b ) ) * boneDetail;
			float grain = ( fine.r - 0.5 ) * boneDetail;
			diffuseColor.rgb *= ( 1.0 - pore * ${glslFloat(BONE_SURFACE.poreDarken)} ) * ( 1.0 + grain * ${glslFloat(2 * BONE_SURFACE.grain)} );
			detailHeight = ( grain - pore ) * ${glslLength(BONE_SURFACE.depth)};
		}
	}`;

const FIBRE_COLOR = /* glsl */ `
	{
		// Muscle fibres along the field from the vertex shader (tissue.ts FIBRES); w = 0: plain texture.
		float fibreW = vFibre.w;
		vec3 fibreQ = vFibre.xyz / mix( ${glslLength(FIBRES.plain.period)}, ${glslLength(FIBRES.period)}, fibreW );
		vec3 fibreQx = dFdx( fibreQ );
		vec3 fibreQy = dFdy( fibreQ );
		float fibreCells = detailCells( fibreQx, fibreQy );
		float fibreDetail = detailFade( fibreCells ) * ( 1.0 - 0.5 * tissueMask.x );
		if ( fibreDetail > 0.0 ) {
			float n1 = textureGrad( detailNoise, fibreQ, fibreQx, fibreQy ).r;
			float n2 = textureGrad( detailNoise, fibreQ * 2.0 + vec3( 0.37, 0.11, 0.73 ), fibreQx * 2.0, fibreQy * 2.0 ).g;
			float streak = mix( n1, 0.7 * n1 + 0.3 * n2, fibreW ) - 0.5;
			// Seams: the noise's 0.5 contour, about a pixel wide (the noise changes ≈ 0.6 per cell).
			float seam = fibreW * ( 1.0 - smoothstep( 0.0, fibreCells, abs( n1 - 0.5 ) ) );
			float contrast = mix( ${glslFloat(FIBRES.plain.contrast)}, ${glslFloat(FIBRES.contrast)}, fibreW );
			diffuseColor.rgb *= 1.0 + fibreDetail * ( streak * 2.0 * contrast - seam * ${glslFloat(FIBRES.seams)} );
			detailHeight = fibreDetail * fibreW * ( streak - 0.5 * seam ) * ${glslLength(FIBRES.depth)};
		}
	}`;

function colorChunk(f: Features): string {
  return `#include <color_fragment>${TISSUE_COLOR}${f.occlusion ? occlusionColor(f.occlusion) : ''}${
    f.bone ? BONE_COLOR : ''
  }${f.fibres ? FIBRE_COLOR : ''}`;
}

const TISSUE_ROUGHNESS = /* glsl */ `#include <roughnessmap_fragment>
	roughnessFactor = mix( roughnessFactor, ${glslFloat(TENDON.roughness)}, tissueMask.x );
	roughnessFactor = mix( roughnessFactor, ${glslFloat(CARTILAGE.roughness)}, tissueMask.y );`;

const DETAIL_NORMAL = /* glsl */ `#include <normal_fragment_maps>
	normal = detailNormal( - vViewPosition, normal, detailHeight, faceDirection );`;

const occlusionSpecular = /* glsl */ `#include <aomap_fragment>
	reflectedLight.directSpecular *= 1.0 - occlusion * ${glslFloat(OCCLUSION.specular)};
	reflectedLight.indirectSpecular *= 1.0 - occlusion * ${glslFloat(OCCLUSION.specular)};`;

function cutChunk(f: Features): string {
  if (f.bone) {
    return /* glsl */ `#include <opaque_fragment>
	// Back face visible through a clipping plane → cut colour, spongy bone (see materials.ts).
	#if NUM_CLIPPING_PLANES > 0
		vec3 cutColor = spongyCut( cutBase );
	#else
		vec3 cutColor = cutBase * ${glslFloat(CUT_SHADE)};
	#endif
	if ( ! gl_FrontFacing ) gl_FragColor.rgb = cutColor;`;
  }
  return /* glsl */ `#include <opaque_fragment>
	// Back face visible through a clipping plane → flat cut colour (see materials.ts).
	if ( ! gl_FrontFacing ) {
		gl_FragColor.rgb = ${f.tissue ? 'cutBase' : 'diffuseColor.rgb'} * ${glslFloat(CUT_SHADE)};
	}`;
}

function atlasShader<T extends Material>(m: T, f: Features, uniforms: Record<string, IUniform>): T {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (f.tissue) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', vertexPars(f))
        .replace('#include <begin_vertex>', vertexMain(f));
      let frag = shader.fragmentShader
        .replace('#include <common>', fragmentPars(f))
        .replace('#include <color_fragment>', colorChunk(f))
        .replace('#include <roughnessmap_fragment>', TISSUE_ROUGHNESS);
      if (f.bone || f.fibres) {
        frag = frag
          .replace('void main() {', `${DETAIL_FUNCTIONS}${f.bone ? SPONGY_FUNCTIONS : ''}void main() {`)
          .replace('#include <normal_fragment_maps>', DETAIL_NORMAL);
      }
      if (f.occlusion) frag = frag.replace('#include <aomap_fragment>', occlusionSpecular);
      shader.fragmentShader = frag;
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', cutChunk(f));
  };
  const key = programKey(f);
  m.customProgramCacheKey = () => key;
  return m;
}

/**
 * Per-instance fibre ends of a muscle chunk, read by the vertex shader by instance id: texel 2i = (a, 1),
 * texel 2i + 1 = (b, 0); zeros for instances without ends (plain texture).
 */
export function createFibreEnds(ends: readonly (readonly number[] | undefined)[]): DataTexture {
  const size = Math.max(1, Math.ceil(Math.sqrt(ends.length * 2)));
  const data = new Float32Array(size * size * 4);
  ends.forEach((e, i) => {
    if (e?.length === 6) data.set([e[0]!, e[1]!, e[2]!, 1, e[3]!, e[4]!, e[5]!, 0], i * 8);
  });
  const tex = new DataTexture(data, size, size, RGBAFormat, FloatType);
  tex.name = 'atlas-fibre-ends';
  tex.needsUpdate = true;
  return tex;
}

/** Colour-pass materials of one surface kind. */
export interface SurfacePair {
  readonly opaque: MeshStandardMaterial;
  readonly transparent: MeshStandardMaterial;
}

export class AtlasMaterials {
  /** Shared by all materials; mutate in place via `setPlanes`. */
  readonly planes: Plane[] = [];
  /** The plain pair (chunks without `tissue`). */
  readonly opaque: MeshStandardMaterial;
  readonly transparent: MeshStandardMaterial;
  readonly depthPrepass: MeshBasicMaterial;
  private readonly shared = new Map<SurfaceKind, SurfacePair>();
  /** Pairs owned by one chunk (muscle chunks with fibres), freed by `release`. */
  private readonly owned = new Set<SurfacePair>();
  private noise: Data3DTexture | null = null;

  constructor(private readonly lookOf: () => Look = look) {
    const plain = this.createPair('plain');
    this.shared.set('plain', plain);
    this.opaque = plain.opaque;
    this.transparent = plain.transparent;
    this.depthPrepass = new MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      // In the transparent list, so it is ordered between layers by renderOrder (an opaque pre-pass would run
      // before the inner transparent layers and hide them).
      transparent: true,
      clippingPlanes: this.planes,
      // Push the pre-pass depth back a hair so the colour pass of the same surface reliably passes LessEqual.
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.depthPrepass.name = 'atlas-depth-prepass';
  }

  private createPair(kind: SurfaceKind, fibreEnds?: Texture): SurfacePair {
    const f = featuresOf(kind, this.lookOf());
    const uniforms: Record<string, IUniform> = {};
    if (f.bone || f.fibres) uniforms.detailNoise = { value: (this.noise ??= createDetailNoise()) };
    if (f.fibres) uniforms.fibreEnds = { value: fibreEnds ?? null };
    const side = this.planes.length > 0 ? DoubleSide : FrontSide;
    const common = { color: 0xffffff, roughness: 0.55, metalness: 0, clippingPlanes: this.planes, side };
    const suffix = kind === 'plain' ? '' : `-${kind}`;
    const opaque = atlasShader(new MeshStandardMaterial(common), f, uniforms);
    opaque.name = `atlas-opaque${suffix}`;
    const transparent = atlasShader(
      new MeshStandardMaterial({ ...common, transparent: true, depthWrite: false }),
      f,
      uniforms,
    );
    transparent.name = `atlas-transparent${suffix}`;
    return { opaque, transparent };
  }

  /** Whether chunks of this kind need their own fibre-ends texture (createFibreEnds) for `surfaces`. */
  needsFibreEnds(kind: SurfaceKind): boolean {
    return featuresOf(kind, this.lookOf()).fibres;
  }

  /**
   * Colour-pass materials for a chunk. Kinds with fibres get a new pair bound to the chunk's `fibreEnds`; the chunk
   * owns it and frees it with `release`. Every other kind shares one pair.
   */
  surfaces(kind: SurfaceKind, fibreEnds?: Texture): SurfacePair {
    if (this.needsFibreEnds(kind)) {
      const pair = this.createPair(kind, fibreEnds);
      this.owned.add(pair);
      return pair;
    }
    let pair = this.shared.get(kind);
    if (!pair) {
      pair = this.createPair(kind);
      this.shared.set(kind, pair);
    }
    return pair;
  }

  /** Free a chunk's own pair (no-op for shared pairs). */
  release(pair: SurfacePair): void {
    if (!this.owned.delete(pair)) return;
    pair.opaque.dispose();
    pair.transparent.dispose();
  }

  get all(): Material[] {
    const out: Material[] = [];
    for (const p of [...this.shared.values(), ...this.owned]) out.push(p.opaque, p.transparent);
    out.push(this.depthPrepass);
    return out;
  }

  get side(): Side {
    return this.opaque.side;
  }

  /** Replace the active clipping planes (keeps the shared array identity). */
  setPlanes(planes: readonly Plane[]): void {
    this.planes.length = 0;
    this.planes.push(...planes);
    const side = planes.length > 0 ? DoubleSide : FrontSide;
    for (const m of this.all) {
      if (m.side !== side) {
        m.side = side;
        m.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    for (const m of this.all) m.dispose();
    this.noise?.dispose();
  }
}
