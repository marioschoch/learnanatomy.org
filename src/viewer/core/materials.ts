/**
 * The three materials shared by every BatchedMesh of the atlas.
 *
 * Colour and alpha are per instance (BatchedMesh colour texture, Vector4), so one material per *pass* is enough:
 *  - opaque:      layers at 100 % — depthWrite on, drawn in three's opaque list (before anything transparent)
 *  - transparent: layers < 100 % and ghosts — depthWrite off, blended, ordered by renderOrder (= layerOrder)
 *  - depthPrepass: colorWrite off, depthWrite on. Drawn right before a transparent layer's colour pass so the
 *                 colour pass (depthFunc LessEqual) only shades the front-most surface of that layer: no
 *                 self-overlap (a muscle's back side or the muscle behind it does not darken the layer).
 *
 * All three share ONE `clippingPlanes` array (mutated in place; three.js recompiles when the plane count changes).
 *
 * Cut surfaces: with any plane enabled the materials become DoubleSide and the fragment shader paints back faces
 * (`!gl_FrontFacing`) in a flat, unlit "cut" colour derived from the structure colour, so sections look solid
 * instead of hollow. This relies on consistent outward winding — the pipeline bakes mirrored clones with flipped
 * winding (ARCHITECTURE.md §4.4), and decodeGlb flips winding for any negative-determinant node as a safety net.
 * Without clipping we use FrontSide: cheaper, and transparent layers never show their own inside.
 */
import { DoubleSide, FrontSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { Material, Plane, Side } from 'three';

/** Brightness of the flat cut colour relative to the structure colour. */
export const CUT_SHADE = 0.68;

const CUT_CHUNK = /* glsl */ `#include <opaque_fragment>
	// Back face visible through a clipping plane → flat cut colour (see materials.ts).
	if ( ! gl_FrontFacing ) {
		gl_FragColor.rgb = diffuseColor.rgb * ${CUT_SHADE.toFixed(3)};
	}`;

function withCutFaces<T extends Material>(m: T): T {
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', CUT_CHUNK);
  };
  m.customProgramCacheKey = () => 'atlas-cut-v1';
  return m;
}

export class AtlasMaterials {
  /** Shared by all materials; mutate in place via `setPlanes`. */
  readonly planes: Plane[] = [];
  readonly opaque: MeshStandardMaterial;
  readonly transparent: MeshStandardMaterial;
  readonly depthPrepass: MeshBasicMaterial;

  constructor() {
    const common = { color: 0xffffff, roughness: 0.55, metalness: 0, clippingPlanes: this.planes };
    this.opaque = withCutFaces(new MeshStandardMaterial({ ...common }));
    this.opaque.name = 'atlas-opaque';
    this.transparent = withCutFaces(
      new MeshStandardMaterial({ ...common, transparent: true, depthWrite: false }),
    );
    this.transparent.name = 'atlas-transparent';
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

  get all(): Material[] {
    return [this.opaque, this.transparent, this.depthPrepass];
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
  }
}
