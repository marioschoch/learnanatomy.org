#!/usr/bin/env node
// Hard checks on public/models (ARCHITECTURE.md §4.6). Exit code 1 on any error.
//
//   node pipeline/validate.mjs [--systems skeletal]   (default: every system in the manifest)
//
// Geometry is decoded from the published GLBs (meshopt + quantization) and checked independently of the
// metadata the pipeline wrote: 1:1 nodes ↔ structures, attribute layouts, transforms, triangle counts,
// orientation (liver right; spleen, stomach, left ventricle left; head up; face +Z) and every left/right side.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { det3, nodeStats, windingAgreement } from './lib/geometry.mjs';
import { definitionHash } from './lib/reviews.mjs';
import {
  fmtBytes,
  fmtInt,
  getIO,
  isMain,
  loadConfigs,
  parseSystemsArg,
  PATHS,
  readJson,
  writeFileAtomic,
  writeJsonAtomic,
} from './lib/io.mjs';
import { baseId, isValidId, parseName } from './lib/names.mjs';

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // src/contract/constants.ts
/** PROMPT §9: startup download ≤ 5 MB (decimal). */
export const STARTUP_BUDGET = 5_000_000;
/** Side check tolerance on the vertex centroid x (metres). */
export const SIDE_TOLERANCE = 0.002;
/** Left/right pair mirror tolerance |x_l + x_r| (metres). */
export const PAIR_TOLERANCE = 0.01;
export const PAIR_WARN = 0.003;
/** Area fraction of triangles whose winding agrees with the vertex normals: error / warning thresholds. */
export const WINDING_ERROR = 0.5;
export const WINDING_WARN = 0.8;

const REPORT_PATH = join(PATHS.inventoryDir, 'PIPELINE_REPORT.md');

class Checker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.notes = [];
    this.orientation = [];
  }
  error(msg) {
    this.errors.push(msg);
  }
  warn(msg) {
    this.warnings.push(msg);
  }
  note(msg) {
    this.notes.push(msg);
  }
}

function listFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, out);
    else out.push(p);
  }
  return out;
}

function layoutKey(prim) {
  const attrs = prim
    .listSemantics()
    .map((sem) => {
      const a = prim.getAttribute(sem);
      return `${sem}:${a.getType()}:${a.getComponentType()}:${a.getNormalized() ? 'n' : ''}`;
    })
    .sort()
    .join(',');
  return `${attrs}|mode=${prim.getMode()}|indexed=${prim.getIndices() ? 1 : 0}`;
}

export async function validate({ systems: requested, dir = PATHS.models } = {}) {
  const c = new Checker();
  const reviews = loadConfigs().reviews.reviews ?? {};
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    c.error(`missing ${relative(PATHS.models, manifestPath)}`);
    return c;
  }
  const manifest = readJson(manifestPath);
  if (manifest.schemaVersion !== 1) c.error(`manifest.schemaVersion ${manifest.schemaVersion} !== 1`);
  for (const k of [
    'generatedAt',
    'appDataVersion',
    'source',
    'languages',
    'units',
    'bodyBounds',
    'systems',
    'regions',
    'attributions',
    'searchIndexFile',
  ]) {
    if (manifest[k] === undefined) c.error(`manifest.${k} missing`);
  }
  if (manifest.units !== 'm') c.error(`manifest.units = ${manifest.units}`);
  const inManifest = manifest.systems.map((s) => s.id);
  const systems = requested ?? inManifest;
  for (const s of systems) if (!inManifest.includes(s)) c.error(`system ${s} is not in the manifest`);
  const checked = manifest.systems.filter((s) => systems.includes(s.id));

  // ---------------------------------------------------------------- files and sizes
  const files = listFiles(dir);
  let totalBytes = 0;
  for (const f of files) {
    const size = statSync(f).size;
    totalBytes += size;
    if (size >= MAX_FILE_BYTES)
      c.error(`${relative(dir, f)} is ${fmtBytes(size)} (limit ${fmtBytes(MAX_FILE_BYTES)})`);
  }
  const regionIds = new Set(manifest.regions.map((r) => r.id));
  for (const r of manifest.regions)
    if (r.parentId && !regionIds.has(r.parentId)) c.error(`region ${r.id}: parent ${r.parentId} unknown`);

  // ---------------------------------------------------------------- metadata files (all systems: global id uniqueness)
  const allIds = new Map(); // id -> type
  const structById = new Map();
  const groupById = new Map();
  const landmarkById = new Map();
  const perSystem = {};
  for (const sys of manifest.systems) {
    const sf = join(dir, sys.structuresFile);
    if (!existsSync(sf)) {
      c.error(`${sys.id}: missing ${sys.structuresFile}`);
      continue;
    }
    const data = readJson(sf);
    if (data.schemaVersion !== 1 || data.system !== sys.id) c.error(`${sys.structuresFile}: bad header`);
    const defs =
      sys.definitionsFile && existsSync(join(dir, sys.definitionsFile))
        ? readJson(join(dir, sys.definitionsFile))
        : null;
    if (sys.definitionsFile && !defs) c.error(`${sys.id}: missing ${sys.definitionsFile}`);
    perSystem[sys.id] = { data, defs };
    for (const [list, type, map] of [
      [data.structures, 'structure', structById],
      [data.groups, 'group', groupById],
      [data.landmarks, 'landmark', landmarkById],
    ]) {
      for (const n of list) {
        if (!isValidId(n.id)) c.error(`${type} id not URL-safe: ${JSON.stringify(n.id)}`);
        if (allIds.has(n.id)) c.error(`duplicate id ${n.id} (${allIds.get(n.id)} and ${type})`);
        allIds.set(n.id, type);
        map.set(n.id, n);
        if (n.system !== sys.id) c.error(`${n.id}: system ${n.system} in ${sys.structuresFile}`);
        if (!n.names || typeof n.names.en !== 'string' || !n.names.en.trim())
          c.error(`${n.id}: names.en missing`);
        if (!(n.names?.la || n.names?.en)) c.error(`${n.id}: neither la nor en name`);
      }
    }
  }

  // ---------------------------------------------------------------- references
  for (const sys of checked) {
    const { data, defs } = perSystem[sys.id] ?? {};
    if (!data) continue;
    const defKeys = new Set(Object.keys(defs?.definitions ?? {}));
    const chunkFiles = new Set(sys.chunks.map((ch) => ch.file));
    if (data.structures.length !== sys.structureCount)
      c.error(`${sys.id}: structureCount ${sys.structureCount} ≠ ${data.structures.length}`);
    for (const s of data.structures) {
      if (!['structure', 'origin', 'insertion'].includes(s.kind)) c.error(`${s.id}: bad kind ${s.kind}`);
      if (s.nodeName !== s.id) c.error(`${s.id}: nodeName ${s.nodeName} ≠ id`);
      if (!chunkFiles.has(s.chunk)) c.error(`${s.id}: chunk ${s.chunk} not in ${sys.id}.chunks`);
      if (!/^#[0-9a-f]{6}$/.test(s.color)) c.error(`${s.id}: bad colour ${s.color}`);
      for (const r of s.regions) if (!regionIds.has(r)) c.error(`${s.id}: unknown region ${r}`);
      if (s.side && !['left', 'right'].includes(s.side)) c.error(`${s.id}: bad side ${s.side}`);
      if (s.side && !['suffix', 'override', 'name'].includes(s.sideSource))
        c.error(`${s.id}: bad sideSource ${s.sideSource}`);
      if (s.parentId) {
        const p = groupById.get(s.parentId) ?? structById.get(s.parentId);
        if (!p) c.error(`${s.id}: parentId ${s.parentId} does not resolve`);
        else if (p.system !== s.system) c.error(`${s.id}: parentId ${s.parentId} in another system`);
      }
      if (s.pairId) {
        const p = structById.get(s.pairId);
        if (!p) c.error(`${s.id}: pairId ${s.pairId} does not resolve`);
        else if (p.pairId !== s.id) c.error(`${s.id}: pairId ${s.pairId} not reciprocal (${p.pairId})`);
        else if (!s.side || !p.side || s.side === p.side)
          c.error(`${s.id}: pair ${s.pairId} sides ${s.side}/${p.side}`);
      }
      for (const key of ['muscleId', 'boneId']) {
        const ref = s[key];
        if (!ref) continue;
        const t = structById.get(ref);
        if (!t) {
          const targetSystem = key === 'muscleId' ? 'muscular' : 'skeletal';
          if (inManifest.includes(targetSystem)) c.error(`${s.id}: ${key} ${ref} does not resolve`);
          else c.warn(`${s.id}: ${key} ${ref} (system ${targetSystem} not built yet)`);
        } else if (key === 'muscleId' && t.system !== 'muscular')
          c.error(`${s.id}: muscleId ${ref} is not a muscle`);
      }
      if (s.definitionKey && !defKeys.has(s.definitionKey))
        c.error(`${s.id}: definitionKey ${s.definitionKey} missing in ${sys.definitionsFile}`);
      if (!manifest.attributions[s.attribution]) c.error(`${s.id}: attribution ${s.attribution} unknown`);
      else if (!!manifest.attributions[s.attribution].nonCommercial !== !!s.nonCommercial)
        c.error(`${s.id}: nonCommercial flag ≠ attribution`);
      for (const v of [...s.centroid, ...s.bbox.min, ...s.bbox.max, ...(s.labelAnchor ?? [])]) {
        if (!Number.isFinite(v)) c.error(`${s.id}: non-finite coordinate`);
      }
    }
    for (const g of data.groups) {
      if (g.parentId) {
        const p = groupById.get(g.parentId) ?? structById.get(g.parentId);
        if (!p) c.error(`${g.id}: parentId ${g.parentId} does not resolve`);
        else if (p.system !== g.system) c.error(`${g.id}: parentId in another system`);
      }
      if (g.definitionKey && !defKeys.has(g.definitionKey))
        c.error(`${g.id}: definitionKey ${g.definitionKey} missing`);
    }
    // parent cycles
    for (const n of [...data.structures, ...data.groups]) {
      const seen = new Set([n.id]);
      let cur = n.parentId;
      while (cur) {
        if (seen.has(cur)) {
          c.error(`${n.id}: parent cycle via ${cur}`);
          break;
        }
        seen.add(cur);
        cur = (groupById.get(cur) ?? structById.get(cur))?.parentId;
      }
    }
    for (const m of data.landmarks) {
      const s = structById.get(m.structureId);
      if (!s) c.error(`${m.id}: structureId ${m.structureId} does not resolve`);
      else if (s.system !== m.system) c.error(`${m.id}: structure in another system`);
      if (!Array.isArray(m.anchor) || m.anchor.length !== 3 || !m.anchor.every(Number.isFinite))
        c.error(`${m.id}: bad anchor`);
      if (m.definitionKey && !defKeys.has(m.definitionKey))
        c.error(`${m.id}: definitionKey ${m.definitionKey} missing`);
      if (s && m.side && s.side !== m.side) c.error(`${m.id}: side ${m.side} ≠ structure side ${s.side}`);
    }
    for (const [k, d] of Object.entries(defs?.definitions ?? {})) {
      const review = reviews[`${sys.id}/${k}`];
      const reviewOk = Boolean(review) && review.sha256 === definitionHash(d);
      if (d.reviewed === true && !reviewOk)
        c.error(
          `${sys.id}: definition ${k} is marked reviewed without a review of this text (definition-reviews.json)`,
        );
      else if (review && !reviewOk)
        c.warn(`stale review: ${sys.id}/${k} (text changed since ${review.date}; shown as not reviewed)`);
      if (
        typeof d.reviewed !== 'boolean' ||
        !d.source ||
        !d.license ||
        !d.text ||
        !Object.values(d.text).some((t) => t)
      ) {
        c.error(`${sys.id}: definition ${k} incomplete`);
      }
    }
  }

  // ---------------------------------------------------------------- one numbered collection per object (export dump)
  if (existsSync(PATHS.scene)) {
    const scene = readJson(PATHS.scene);
    for (const [name, a, b] of scene.duplicatesAcrossSystems ?? [])
      c.error(`${name} is in two system collections (${a}, ${b})`);
  } else {
    c.warn('data/export/scene.json not found: collection membership not checked');
  }

  // ---------------------------------------------------------------- search index
  const sip = join(dir, manifest.searchIndexFile ?? 'search-index.json');
  if (!existsSync(sip)) c.error('missing search index');
  else {
    const si = readJson(sip);
    if (si.schemaVersion !== 1) c.error('search index schemaVersion');
    const seen = new Set();
    for (const e of si.entries) {
      const type = allIds.get(e.id);
      if (!type) c.error(`search index: ${e.id} does not resolve`);
      else if (type !== e.type) c.error(`search index: ${e.id} type ${e.type} ≠ ${type}`);
      if (seen.has(e.id)) c.error(`search index: duplicate ${e.id}`);
      seen.add(e.id);
      for (const k of Object.keys(e.names ?? {}))
        if (!['la', 'en', 'de'].includes(k)) c.error(`search index: ${e.id} has ${k} name`);
    }
    for (const [id, type] of allIds) if (!seen.has(id)) c.error(`search index: ${type} ${id} missing`);
  }

  // ---------------------------------------------------------------- geometry
  const io = await getIO();
  const centroidOf = new Map();
  const windingOf = new Map();
  const sysStats = {};
  for (const sys of checked) {
    const { data } = perSystem[sys.id] ?? {};
    if (!data) continue;
    const expected = new Map(data.structures.map((s) => [s.id, s]));
    const foundNode = new Map();
    let tris = 0;
    let bytes = 0;
    for (const ch of sys.chunks) {
      const p = join(dir, ch.file);
      if (!existsSync(p)) {
        c.error(`${sys.id}: missing chunk ${ch.file}`);
        continue;
      }
      const size = statSync(p).size;
      bytes += size;
      if (size !== ch.bytes) c.error(`${ch.file}: bytes ${ch.bytes} in manifest, ${size} on disk`);
      const doc = await io.read(p);
      const root = doc.getRoot();
      const layouts = new Set();
      let matrixKey;
      let chunkTris = 0;
      let count = 0;
      for (const node of root.listNodes()) {
        const name = node.getName();
        const mesh = node.getMesh();
        if (!mesh) {
          if (node.listChildren().length === 0) c.error(`${ch.file}: node ${name} without mesh`);
          continue;
        }
        count++;
        const m = node.getWorldMatrix();
        if (det3(m) <= 0) c.error(`${ch.file}: node ${name} has a non-positive determinant`);
        const mk = m.map((v) => v.toPrecision(9)).join(',');
        if (matrixKey === undefined) matrixKey = mk;
        else if (mk !== matrixKey)
          c.error(
            `${ch.file}: node ${name} has a different transform (expected one shared dequantization transform)`,
          );
        if (node.getParentNode()) c.error(`${ch.file}: node ${name} is not a root node`);
        for (const prim of mesh.listPrimitives()) {
          layouts.add(layoutKey(prim));
          if (prim.getMode() !== 4) c.error(`${ch.file}: ${name} is not TRIANGLES`);
          if (prim.getMaterial()?.listTextureInfo?.().length) c.error(`${ch.file}: ${name} has textures`);
        }
        if (foundNode.has(name))
          c.error(`${sys.id}: node ${name} appears twice (${foundNode.get(name)}, ${ch.file})`);
        foundNode.set(name, ch.file);
        const s = expected.get(name);
        if (!s) {
          c.error(`${ch.file}: node ${name} has no structure`);
          continue;
        }
        if (s.chunk !== ch.file) c.error(`${name}: in ${ch.file}, metadata says ${s.chunk}`);
        const st = nodeStats(node);
        if (st.triangles !== s.triangles)
          c.error(`${name}: ${st.triangles} triangles in GLB, ${s.triangles} in metadata`);
        if (st.triangles === 0) c.error(`${name}: no triangles`);
        chunkTris += st.triangles;
        centroidOf.set(name, st.centroid);
        const wa = windingAgreement(node);
        windingOf.set(name, wa);
        if (wa < WINDING_ERROR)
          c.error(
            `WINDING: ${name}: only ${(wa * 100).toFixed(1)} % of the surface is wound consistently with its normals (inverted?)`,
          );
        else if (wa < WINDING_WARN)
          c.warn(`winding: ${name}: ${(wa * 100).toFixed(1)} % consistent with normals`);
        for (let k = 0; k < 3; k++) {
          if (
            Math.abs(st.bbox.min[k] - s.bbox.min[k]) > 0.001 ||
            Math.abs(st.bbox.max[k] - s.bbox.max[k]) > 0.001
          ) {
            c.error(`${name}: bbox in metadata differs from GLB by > 1 mm`);
            break;
          }
        }
      }
      if (layouts.size > 1)
        c.error(`${ch.file}: ${layouts.size} different attribute layouts: ${[...layouts].join(' / ')}`);
      if (count !== ch.structureCount)
        c.error(`${ch.file}: ${count} nodes, manifest says ${ch.structureCount}`);
      if (chunkTris !== ch.triangleCount)
        c.error(`${ch.file}: ${chunkTris} triangles, manifest says ${ch.triangleCount}`);
      tris += chunkTris;
      c.note(
        `${ch.file}: ${count} nodes, ${fmtInt(chunkTris)} triangles, ${fmtBytes(size)}, layout ${[...layouts][0]}`,
      );
    }
    for (const id of expected.keys())
      if (!foundNode.has(id)) c.error(`${sys.id}: structure ${id} has no GLB node`);
    if (tris !== sys.triangleCount) c.error(`${sys.id}: triangleCount ${sys.triangleCount} ≠ ${tris}`);
    sysStats[sys.id] = { structures: data.structures.length, triangles: tris, bytes };
  }

  // ---------------------------------------------------------------- orientation (critical)
  const { overrides } = loadConfigs();
  const openReview = new Set(
    (overrides.toReview ?? []).filter((r) => ['open', 'accepted'].includes(r.status)).map((r) => r.source),
  );
  const findStruct = (en, system) =>
    [...structById.values()].filter(
      (s) => s.names.en === en && (!system || s.system === system) && centroidOf.has(s.id),
    );
  const orient = (label, ok, detail) => {
    c.orientation.push({ check: label, ok, detail });
    if (!ok) c.error(`ORIENTATION: ${label} failed (${detail})`);
  };
  const needSystem = (system, what) => {
    if (!systems.includes(system)) {
      c.orientation.push({ check: what, ok: null, detail: `skipped: ${system} not in this build` });
      return false;
    }
    return true;
  };
  const centroidCheck = (en, system, expectLeft) => {
    const label = `${en} centroid on the patient's ${expectLeft ? 'left (x > 0)' : 'right (x < 0)'}`;
    if (!needSystem(system, label)) return;
    const found = findStruct(en, system);
    if (!found.length) return orient(label, false, `"${en}" not found in ${system}`);
    for (const s of found) {
      const x = centroidOf.get(s.id)[0];
      orient(`${label} [${s.id}]`, expectLeft ? x > 0 : x < 0, `x = ${x.toFixed(4)}`);
    }
  };
  centroidCheck('Liver', 'visceral', false);
  centroidCheck('Stomach', 'visceral', true);
  const spleenSystem = [...structById.values()].find((s) => s.names.en === 'Spleen')?.system ?? 'lymphoid';
  centroidCheck('Spleen', spleenSystem, true);
  centroidCheck('Left ventricle', 'cardiovascular', true);
  const apex = [...landmarkById.values()].filter((m) => m.names.en === 'Apex of heart');
  for (const m of apex)
    orient(`Apex of heart landmark on the left [${m.id}]`, m.anchor[0] > 0, `x = ${m.anchor[0].toFixed(4)}`);
  if (needSystem('skeletal', 'head above feet / face towards +Z')) {
    const one = (en) => findStruct(en, 'skeletal')[0];
    const occ = one('Occipital bone');
    const frontal = one('Frontal bone');
    const nasal = findStruct('Nasal bone', 'skeletal');
    const calc = findStruct('Calcaneus', 'skeletal');
    if (!occ || !frontal || !nasal.length || !calc.length)
      orient('head/face landmarks present', false, 'occipital/frontal/nasal/calcaneus missing');
    else {
      const head = centroidOf.get(frontal.id)[1];
      const feet = Math.max(...calc.map((s) => centroidOf.get(s.id)[1]));
      orient(
        'head above feet (frontal bone y > calcaneus y + 1 m)',
        head > feet + 1,
        `frontal y = ${head.toFixed(3)}, calcaneus y = ${feet.toFixed(3)}`,
      );
      const nz = Math.min(...nasal.map((s) => centroidOf.get(s.id)[2]));
      const oz = centroidOf.get(occ.id)[2];
      orient(
        'face towards +Z (nasal bone z > occipital bone z)',
        nz > oz,
        `nasal z = ${nz.toFixed(3)}, occipital z = ${oz.toFixed(3)}`,
      );
      const feetMin = Math.min(...calc.map((s) => structById.get(s.id).bbox.min[1]));
      orient(
        'feet near y = 0 (calcaneus bbox min y < 0.05)',
        feetMin < 0.05 && feetMin > -0.01,
        `min y = ${feetMin.toFixed(4)}`,
      );
    }
  }

  // every sided structure on its side; pairs mirror each other.
  // Strict (error) for sides from the .l/.r suffix. Warnings only for
  //  - sides read from the English name ("Right ventricle", "Left medial segment of liver (IV)"): these are
  //    organ-internal designations, the geometry is anatomically right even when the centroid crosses x = 0;
  //  - open review items in overrides.json (toReview, status 'open'), which are reported, not decided here.
  const reviewIds = new Set();
  for (const src of openReview) {
    const p = parseName(src);
    for (const side of ['left', 'right']) {
      reviewIds.add(
        baseId(p.kind === 'structure' ? 'structure' : p.kind, p.base, {
          side,
          sideFromSuffix: true,
          patch: p.patch,
        }),
      );
    }
  }
  let sided = 0;
  let worstPair = { d: 0 };
  const sideFailures = [];
  const softSide = [];
  for (const s of structById.values()) {
    if (!s.side || !centroidOf.has(s.id)) continue;
    sided++;
    const x = centroidOf.get(s.id)[0];
    const ok = s.side === 'left' ? x > -SIDE_TOLERANCE : x < SIDE_TOLERANCE;
    if (!ok) {
      const f = { id: s.id, side: s.side, sideSource: s.sideSource, x };
      if (reviewIds.has(s.id)) softSide.push({ ...f, why: 'open review item (overrides.json)' });
      else sideFailures.push(f);
    }
    if (s.pairId && s.side === 'left' && centroidOf.has(s.pairId)) {
      const xr = centroidOf.get(s.pairId)[0];
      const d = Math.abs(x + xr);
      if (d > worstPair.d && !reviewIds.has(s.id)) worstPair = { d, id: s.id, pair: s.pairId };
      if (d > PAIR_TOLERANCE && reviewIds.has(s.id))
        c.warn(`REVIEW pair ${s.id} / ${s.pairId}: |x_l + x_r| = ${d.toFixed(4)} m (open review item)`);
      else if (d > PAIR_TOLERANCE)
        c.error(`PAIR: ${s.id} / ${s.pairId} do not mirror (|x_l + x_r| = ${d.toFixed(4)} m)`);
      else if (d > PAIR_WARN) c.warn(`pair ${s.id} / ${s.pairId}: |x_l + x_r| = ${d.toFixed(4)} m`);
    }
  }
  for (const f of sideFailures)
    c.error(
      `SIDE: ${f.id} is '${f.side}' (${f.sideSource}) but its vertex centroid is at x = ${f.x.toFixed(4)}`,
    );
  for (const f of softSide)
    c.warn(`side: ${f.id} is '${f.side}' but its vertex centroid is at x = ${f.x.toFixed(4)} — ${f.why}`);
  c.orientation.push({
    check: `side of ${sided} sided structures (vertex centroid, tolerance ${SIDE_TOLERANCE} m; strict for every published side, only open review items are warnings)`,
    ok: sideFailures.length === 0,
    detail: `${sideFailures.length} failures; ${softSide.length} reported as warnings (${softSide.map((f) => f.id).join(', ') || '–'})`,
  });
  c.orientation.push({
    check: `left/right pairs mirror (|x_l + x_r| ≤ ${PAIR_TOLERANCE} m; review items excluded)`,
    ok: worstPair.d <= PAIR_TOLERANCE,
    detail: worstPair.id
      ? `worst ${worstPair.id}/${worstPair.pair}: ${worstPair.d.toFixed(4)} m`
      : 'no pairs',
  });
  if (windingOf.size) {
    const vals = [...windingOf.values()];
    const low = vals.filter((v) => v < WINDING_WARN).length;
    c.orientation.push({
      check: `triangle winding agrees with normals (≥ ${WINDING_ERROR * 100} % of surface per structure)`,
      ok: vals.every((v) => v >= WINDING_ERROR),
      detail: `min ${(Math.min(...vals) * 100).toFixed(1)} %, mean ${((vals.reduce((x, y) => x + y, 0) / vals.length) * 100).toFixed(1)} %, ${low} below ${WINDING_WARN * 100} %`,
    });
  }
  // review items
  for (const id of reviewIds) {
    if (!centroidOf.has(id)) continue;
    const x = centroidOf.get(id)[0];
    c.note(
      `open review item ${id}: vertex centroid x = ${x.toFixed(4)} (${x < 0 ? "patient's right" : "patient's left"})`,
    );
  }

  // startup budget: manifest, search index, metadata and geometry of the default-visible systems, as served
  // (JSON gzip-compressed by the host, GLB as is). The app's JS is not included (checked on the build).
  const startupSystems = manifest.systems.filter((s) => s.defaultVisible);
  const gzSize = (p) => (existsSync(p) ? gzipSync(readFileSync(p)).length : 0);
  const startup =
    gzSize(manifestPath) +
    gzSize(sip) +
    startupSystems.reduce(
      (a, s) => a + gzSize(join(dir, s.structuresFile)) + s.chunks.reduce((b, ch) => b + ch.bytes, 0),
      0,
    );
  c.budget = {
    startupBytes: startup,
    startupSystems: startupSystems.map((s) => s.id),
    ok: startup <= STARTUP_BUDGET,
    totalBytes,
    files: files.length,
  };
  if (!c.budget.ok) c.warn(`startup download ${fmtBytes(startup)} exceeds the 5 MB budget`);
  c.sysStats = sysStats;
  c.systems = systems;
  return c;
}

function writeReportSection(c) {
  if (!existsSync(REPORT_PATH)) return;
  const text = readFileSync(REPORT_PATH, 'utf8');
  const marker = '<!-- validation -->';
  const head = text.includes(marker) ? text.slice(0, text.indexOf(marker)) : `${text}\n`;
  const L = [marker, '', '## Validation', ''];
  L.push(
    `_\`node pipeline/validate.mjs\` at ${new Date().toISOString()} — systems: ${c.systems.join(', ')} — ` +
      `**${c.errors.length ? 'FAILED' : 'passed'}** (${c.errors.length} errors, ${c.warnings.length} warnings)._`,
  );
  L.push('');
  L.push('| orientation / side check | result | detail |');
  L.push('|---|---|---|');
  for (const o of c.orientation)
    L.push(`| ${o.check} | ${o.ok === null ? 'skipped' : o.ok ? 'ok' : '**FAIL**'} | ${o.detail} |`);
  L.push('');
  L.push('| system | structures | triangles | bytes |');
  L.push('|---|---|---|---|');
  for (const [k, v] of Object.entries(c.sysStats))
    L.push(`| ${k} | ${v.structures} | ${fmtInt(v.triangles)} | ${fmtBytes(v.bytes)} |`);
  L.push('');
  L.push(
    `Startup download (manifest, search index, default systems ${c.budget.startupSystems.join(' + ')}; JSON gzip, ` +
      'GLB as is, without JS): ' +
      `${fmtBytes(c.budget.startupBytes)} (budget 5 MB: ${c.budget.ok ? 'met' : '**missed**'}); ` +
      `public/models total ${fmtBytes(c.budget.totalBytes)} in ${c.budget.files} files.`,
  );
  L.push('');
  if (c.notes.length) L.push(...c.notes.map((n) => `- ${n}`), '');
  if (c.errors.length) L.push('### Errors', '', ...c.errors.slice(0, 200).map((e) => `- ${e}`), '');
  if (c.warnings.length)
    L.push(
      '### Warnings',
      '',
      ...c.warnings.slice(0, 100).map((e) => `- ${e}`),
      c.warnings.length > 100 ? `- … ${c.warnings.length - 100} more` : '',
      '',
    );
  writeFileAtomic(REPORT_PATH, head + L.join('\n') + '\n');
}

async function main() {
  const { config } = loadConfigs();
  const systems = parseSystemsArg(
    process.argv.slice(2),
    config.systems.map((s) => s.id),
  );
  const t0 = Date.now();
  const c = await validate({ systems });
  for (const o of c.orientation)
    console.log(`[validate] ${o.ok === null ? 'SKIP' : o.ok ? ' OK ' : 'FAIL'} ${o.check}: ${o.detail}`);
  for (const n of c.notes) console.log(`[validate] ${n}`);
  for (const w of c.warnings.slice(0, 30)) console.log(`[validate] warning: ${w}`);
  if (c.warnings.length > 30) console.log(`[validate] … ${c.warnings.length - 30} more warnings`);
  for (const e of c.errors.slice(0, 100)) console.error(`[validate] ERROR: ${e}`);
  if (c.budget) {
    console.log(
      `[validate] startup download ${fmtBytes(c.budget.startupBytes)} (budget 5 MB ${c.budget.ok ? 'met' : 'MISSED'}), total ${fmtBytes(c.budget.totalBytes)}`,
    );
  }
  console.log(
    `[validate] ${c.errors.length ? 'FAILED' : 'passed'}: ${c.errors.length} errors, ${c.warnings.length} warnings (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
  if (c.sysStats) {
    writeReportSection(c);
    writeJsonAtomic(
      join(PATHS.inventoryDir, 'validation.json'),
      {
        at: new Date().toISOString(),
        systems: c.systems,
        ok: c.errors.length === 0,
        errors: c.errors,
        warnings: c.warnings,
        orientation: c.orientation,
        notes: c.notes,
        budget: c.budget,
        stats: c.sysStats,
      },
      true,
    );
  }
  process.exit(c.errors.length ? 1 : 0);
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
