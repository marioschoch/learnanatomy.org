#!/usr/bin/env node
// Asset processing (ARCHITECTURE.md §4.4): raw Blender GLB per system → web-ready chunks.
//
//   node pipeline/process.mjs [--systems skeletal,visceral]     (default: every system with a raw export)
//
// Per system: rename nodes to structure ids → dedup → weld → careful simplify (absolute error, borders locked,
// no pruning) → prune → quantize (quantizationVolume 'scene') + EXT_meshopt_compression → split by region when a
// chunk would exceed 20 MB. Writes data/export/processed/<chunk>.glb and data/export/processed/<system>.json
// (chunk list + per-structure stats used by manifest.mjs).
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cloneDocument, dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { nodeStats, roundVec, simplifyPrimitiveAbsolute } from './lib/geometry.mjs';
import {
  fmtBytes,
  fmtInt,
  getIO,
  isMain,
  loadConfigs,
  loadExport,
  loadTa2,
  MeshoptEncoder,
  MeshoptSimplifier,
  parseSystemsArg,
  PATHS,
  writeFileAtomic,
  writeJsonAtomic,
} from './lib/io.mjs';
import { buildModel } from './lib/model.mjs';

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // mirrors src/contract/constants.ts

/** Processing settings. Errors are absolute (metres). Curves (vessels, nerves) get half the error. */
export const PROCESS_SETTINGS = {
  simplifyError: 0.00005, // 0.05 mm
  curveErrorFactor: 0.5,
  minTrianglesToSimplify: 64,
  quantizePosition: 16, // 0.027 mm steps over the 1.74 m body; same size as 14 bit after meshopt
  /** Systems with thin tubes (≈ 1 mm vessels/nerves) get finer position quantization. */
  quantizePositionBySystem: {},
  meshoptLevel: 'high', // normals: octahedral filter (8 bit)
};

/** Settings for one system; `--quantize-position N` overrides the bits (for experiments). */
export function settingsFor(systemId, argv = []) {
  const i = argv.indexOf('--quantize-position');
  const forced = i >= 0 ? Number(argv[i + 1]) : undefined;
  const { quantizePositionBySystem, ...rest } = PROCESS_SETTINGS;
  return { ...rest, quantizePosition: forced ?? quantizePositionBySystem[systemId] ?? rest.quantizePosition };
}

// Region groups used only when a system chunk is > 20 MB (side-agnostic, ARCHITECTURE.md §4.4).
const SPLIT_GROUPS = [
  ['head', ['head']],
  ['neck', ['neck']],
  ['trunk', ['thorax', 'abdomen', 'pelvis', 'back', 'trunk']],
  ['upper-limb', ['upper-limb', 'hand']],
  ['lower-limb', ['lower-limb', 'foot']],
];

function splitGroupOf(regions) {
  for (const [name, members] of SPLIT_GROUPS) if (regions.some((r) => members.includes(r))) return name;
  return 'other';
}

function log(msg) {
  console.log(`[process] ${msg}`);
}

// glTF asset.copyright, so a downloaded GLB names its source and licence.
const ASSET_COPYRIGHT =
  'Derived from Z-Anatomy (CC BY-SA 4.0) and BodyParts3D (CC BY-SA 2.1 JP); some structures are CC BY-NC(-SA) 4.0. ' +
  'Full attribution: ATTRIBUTION.md / licenses/ATTRIBUTION.txt of the Open Anatomy Atlas.';

async function encode(io, doc, settings) {
  doc.getRoot().getAsset().copyright = ASSET_COPYRIGHT;
  await doc.transform(
    meshopt({
      encoder: MeshoptEncoder,
      level: settings.meshoptLevel,
      quantizationVolume: 'scene',
      quantizePosition: settings.quantizePosition,
    }),
  );
  return io.writeBinary(doc);
}

export async function processSystem(io, model, systemId, settings = settingsFor(systemId)) {
  const t0 = Date.now();
  const rawPath = join(PATHS.raw, `${systemId}.glb`);
  const doc = await io.read(rawPath);
  doc.setLogger({ debug() {}, info() {}, warn: (m) => log(`warn: ${m}`), error: (m) => log(`error: ${m}`) });
  const root = doc.getRoot();
  const byName = model.structByName;

  // ---------------------------------------------------------------- rename nodes to ids
  const unknown = [];
  const seen = new Set();
  for (const node of root.listNodes()) {
    const s = byName.get(node.getName());
    if (!s || s.system !== systemId) {
      unknown.push(node.getName());
      node.dispose();
      continue;
    }
    if (seen.has(s.id)) throw new Error(`${systemId}: duplicate node for ${s.id}`);
    seen.add(s.id);
    node.setName(s.id);
    node.getMesh()?.setName(s.id);
  }
  if (unknown.length)
    log(`${systemId}: dropped ${unknown.length} nodes without a structure: ${unknown.slice(0, 5)}`);
  for (const scene of root.listScenes()) scene.setName(systemId);

  // ---------------------------------------------------------------- weld + simplify
  const before = new Map(root.listNodes().map((n) => [n.getName(), nodeStats(n).triangles]));
  await doc.transform(dedup(), weld());
  const structById = new Map(model.structures.map((s) => [s.id, s]));
  const simp = { applied: 0, skipped: {} };
  for (const node of root.listNodes()) {
    const s = structById.get(node.getName());
    const error = settings.simplifyError * (s.isCurve ? settings.curveErrorFactor : 1);
    for (const prim of node.getMesh().listPrimitives()) {
      const r = simplifyPrimitiveAbsolute(prim, MeshoptSimplifier, {
        error,
        minTriangles: settings.minTrianglesToSimplify,
      });
      if (r.applied) simp.applied++;
      else simp.skipped[r.reason ?? 'none'] = (simp.skipped[r.reason ?? 'none'] ?? 0) + 1;
    }
  }
  await doc.transform(prune());

  // ---------------------------------------------------------------- per-structure stats (float, pre-quantization)
  const structures = {};
  let trisBefore = 0;
  let trisAfter = 0;
  for (const node of root.listNodes()) {
    const st = nodeStats(node);
    const id = node.getName();
    structures[id] = {
      trianglesBefore: before.get(id),
      triangles: st.triangles,
      centroid: roundVec(st.centroid),
      bbox: { min: roundVec(st.bbox.min), max: roundVec(st.bbox.max) },
    };
    trisBefore += before.get(id);
    trisAfter += st.triangles;
  }

  // ---------------------------------------------------------------- encode, split by region if needed
  mkdirSync(PATHS.processed, { recursive: true });
  for (const f of readdirSync(PATHS.processed)) {
    if (f === `${systemId}.glb` || (f.startsWith(`${systemId}-`) && f.endsWith('.glb')))
      rmSync(join(PATHS.processed, f));
  }
  const chunks = [];
  const whole = await encode(io, cloneDocument(doc), settings);
  if (whole.byteLength <= MAX_FILE_BYTES) {
    const file = `${systemId}.glb`;
    writeFileAtomic(join(PATHS.processed, file), whole);
    chunks.push({ file, bytes: whole.byteLength, nodes: Object.keys(structures) });
  } else {
    log(`${systemId}: ${fmtBytes(whole.byteLength)} > 20 MB → splitting by region`);
    const groupOf = new Map(
      Object.keys(structures).map((id) => [id, splitGroupOf(structById.get(id).regions)]),
    );
    const names = [...new Set(groupOf.values())];
    for (const g of names) {
      const part = cloneDocument(doc);
      for (const node of part.getRoot().listNodes()) if (groupOf.get(node.getName()) !== g) node.dispose();
      await part.transform(prune());
      const bin = await encode(io, part, settings);
      const file = `${systemId}-${g}.glb`;
      if (bin.byteLength > MAX_FILE_BYTES)
        throw new Error(`${file} is still ${fmtBytes(bin.byteLength)} after the region split`);
      writeFileAtomic(join(PATHS.processed, file), bin);
      chunks.push({
        file,
        region: g,
        bytes: bin.byteLength,
        nodes: [...groupOf].filter(([, v]) => v === g).map(([k]) => k),
      });
    }
  }
  const out = {
    system: systemId,
    generatedAt: new Date().toISOString(),
    settings,
    trianglesBefore: trisBefore,
    triangles: trisAfter,
    simplify: simp,
    chunks,
    structures,
    seconds: (Date.now() - t0) / 1000,
  };
  writeJsonAtomic(join(PATHS.processed, `${systemId}.json`), out);
  const bytes = chunks.reduce((a, c) => a + c.bytes, 0);
  log(
    `${systemId}: ${Object.keys(structures).length} structures, triangles ${fmtInt(trisBefore)} → ${fmtInt(trisAfter)} ` +
      `(${((1 - trisAfter / trisBefore) * 100).toFixed(1)} % less), ${chunks.length} chunk(s), ${fmtBytes(bytes)}, ${out.seconds.toFixed(1)} s`,
  );
  return out;
}

async function main() {
  const { config, nc, overrides } = loadConfigs();
  const ids = config.systems.map((s) => s.id);
  const requested = parseSystemsArg(process.argv.slice(2), ids);
  const available = ids.filter((id) => existsSync(join(PATHS.raw, `${id}.glb`)));
  const systems = requested ?? available;
  const missing = systems.filter((id) => !available.includes(id));
  if (missing.length)
    throw new Error(`No raw export for: ${missing.join(', ')} — run \`npm run assets:export\` first.`);
  if (systems.length === 0)
    throw new Error('No raw exports found in data/export/raw — run `npm run assets:export` first.');
  // stale raw exports (older than scene.json) would carry ids from another run: refuse
  const sceneTime = statSync(PATHS.scene).mtimeMs;
  for (const id of systems) {
    if (statSync(join(PATHS.raw, `${id}.glb`)).mtimeMs > sceneTime + 1000) {
      throw new Error(`data/export/raw/${id}.glb is newer than scene.json — re-run the export.`);
    }
  }
  const { scene, texts } = loadExport();
  const model = buildModel({ scene, texts, config, nc, overrides, ta2: loadTa2() });
  const io = await getIO();
  for (const id of systems) await processSystem(io, model, id, settingsFor(id, process.argv.slice(2)));
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
