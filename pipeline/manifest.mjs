#!/usr/bin/env node
// Writes public/models/ (ARCHITECTURE.md §4.5): manifest.json, search-index.json, structures/<system>.json,
// definitions/<system>.json and the GLB chunks; generates ATTRIBUTION.md and data/inventory/PIPELINE_REPORT.md.
//
//   node pipeline/manifest.mjs [--systems skeletal,visceral]   (default: every system processed so far)
//                              [--no-validate]                 (publish even if validation fails)
//
// The output is assembled in a staging folder next to public/models and swapped in with two renames, so the
// dev server (and Agent B's watcher) never sees a half-written or missing manifest for more than a moment.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  fmtBytes,
  fmtInt,
  getIO,
  isMain,
  loadConfigs,
  loadExport,
  loadTa2,
  parseSystemsArg,
  PATHS,
  readJson,
  ROOT,
  writeFileAtomic,
  writeJsonAtomic,
} from './lib/io.mjs';
import { ATTRIBUTIONS, buildModel, toGroup, toLandmark, toStructure } from './lib/model.mjs';
import { applyReviews } from './lib/reviews.mjs';
import { SIDE_TOLERANCE, validate } from './validate.mjs';

const SOURCE = {
  name: 'Z-Anatomy',
  url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy',
  license: 'CC BY-SA 4.0',
};
const REPORT_PATH = join(PATHS.inventoryDir, 'PIPELINE_REPORT.md');
const REPORT_JSON = join(PATHS.inventoryDir, 'pipeline-report.json');

function log(msg) {
  console.log(`[manifest] ${msg}`);
}

function sortById(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Assemble the published data for the given systems. Pure apart from reading processed/*.json. */
export function assemble(model, systems, processed, config, nc, reviewsFile = { reviews: {} }) {
  const included = new Set(systems);
  const issues = { dropped: [], danglingRefs: [], nameSidesDropped: [], reviews: null };
  // structures that actually have a GLB node
  const geoById = new Map();
  for (const sid of systems) {
    const p = processed[sid];
    for (const c of p.chunks)
      for (const id of c.nodes) geoById.set(id, { ...p.structures[id], chunk: c.file });
  }
  const structures = [];
  for (const s of model.structures) {
    if (!included.has(s.system)) continue;
    const geo = geoById.get(s.id);
    if (!geo) {
      issues.dropped.push(s.sourceName);
      continue;
    }
    structures.push(toStructure(s, geo));
  }
  // `side` is the body side. A side read from the name ("Right ventricle", "Left medial segment of liver (IV)")
  // is kept only when the geometry lies on that side; organ-internal designations that cross the midline get
  // no side (ARCHITECTURE.md §4.3). Same tolerance as the validator, which is strict for every published side.
  const nameSideDropped = new Set();
  for (const s of structures) {
    if (s.sideSource !== 'name') continue;
    const x = s.centroid[0];
    if (s.side === 'left' ? x > -SIDE_TOLERANCE : x < SIDE_TOLERANCE) continue;
    issues.nameSidesDropped.push({ id: s.id, side: s.side, x: Math.round(x * 1e4) / 1e4 });
    nameSideDropped.add(s.id);
    delete s.side;
    delete s.sideSource;
  }
  const present = new Set(structures.map((s) => s.id));
  const modelById = new Map(model.structures.map((s) => [s.id, s]));
  const groups = model.groups.filter((g) => included.has(g.system)).map(toGroup);
  const groupIds = new Set(groups.map((g) => g.id));
  // drop references to nodes that are not published (no geometry) — targets in other, not yet built systems
  // are kept (they resolve once that system is built) and listed in the report
  for (const s of structures) {
    for (const key of ['pairId', 'parentId', 'muscleId', 'boneId']) {
      const ref = s[key];
      if (!ref) continue;
      if (present.has(ref) || groupIds.has(ref)) continue;
      const target = modelById.get(ref);
      if (target && !included.has(target.system)) {
        issues.danglingRefs.push({ id: s.id, key, ref, reason: `system ${target.system} not built` });
        continue;
      }
      issues.danglingRefs.push({ id: s.id, key, ref, reason: 'target has no geometry → removed' });
      delete s[key];
    }
  }
  for (const g of groups) {
    if (g.parentId && !groupIds.has(g.parentId) && !present.has(g.parentId)) delete g.parentId;
  }
  const landmarks = model.landmarks
    .filter((m) => included.has(m.system) && present.has(m.structureId))
    .map(toLandmark);
  for (const m of landmarks) if (nameSideDropped.has(m.structureId)) delete m.side;

  const bySys = (arr) => {
    const out = Object.fromEntries(systems.map((s) => [s, []]));
    for (const x of arr) out[x.system]?.push(x);
    for (const k of Object.keys(out)) out[k].sort(sortById);
    return out;
  };
  const sStructures = bySys(structures);
  const sGroups = bySys(groups);
  const sLandmarks = bySys(landmarks);

  const definitions = {};
  for (const sid of systems) {
    const used = new Set(
      [...sStructures[sid], ...sGroups[sid], ...sLandmarks[sid]].map((n) => n.definitionKey).filter(Boolean),
    );
    definitions[sid] = Object.fromEntries(
      Object.entries(model.definitions[sid] ?? {})
        .filter(([k]) => used.has(k))
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, d]) => [k, { ...d }]),
    );
  }
  // reviewed: true only where definition-reviews.json has a review of exactly this text
  issues.reviews = applyReviews(definitions, reviewsFile);

  // languages that actually occur in published names
  const langs = new Set();
  for (const n of [...structures, ...groups, ...landmarks])
    for (const k of Object.keys(n.names)) langs.add(k);
  const languages = ['la', 'en', 'de', 'fr', 'es', 'pt'].filter((l) => langs.has(l));

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const s of structures) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], s.bbox.min[k]);
      max[k] = Math.max(max[k], s.bbox.max[k]);
    }
  }

  const attributions = { ...ATTRIBUTIONS };
  for (const [id, src] of Object.entries(nc.sources ?? {})) {
    attributions[id] = {
      text: src.text,
      license: src.license,
      licenseUrl: src.licenseUrl,
      nonCommercial: true,
    };
  }

  const systemInfos = config.systems
    .filter((s) => included.has(s.id))
    .map((sys) => {
      const ms = model.systems.find((x) => x.id === sys.id);
      const p = processed[sys.id];
      const chunks = p.chunks.map((c) => {
        const info = {
          file: c.file,
          bytes: c.bytes,
          structureCount: c.nodes.length,
          triangleCount: c.nodes.reduce((a, id) => a + (p.structures[id]?.triangles ?? 0), 0),
        };
        if (c.region) info.region = c.region;
        return info;
      });
      return {
        id: sys.id,
        names: ms.names,
        color: ms.color,
        layerOrder: sys.layerOrder,
        defaultVisible: sys.defaultVisible,
        defaultOpacity: sys.defaultOpacity,
        chunks,
        structuresFile: `structures/${sys.id}.json`,
        definitionsFile: `definitions/${sys.id}.json`,
        structureCount: sStructures[sys.id].length,
        triangleCount: chunks.reduce((a, c) => a + c.triangleCount, 0),
      };
    });

  const search = [];
  const entry = (n, type) => {
    const names = { en: n.names.en };
    if (n.names.la) names.la = n.names.la;
    if (n.names.de) names.de = n.names.de;
    const e = { id: n.id, type, system: n.system, names };
    if (n.synonyms?.length) e.synonyms = n.synonyms;
    if (n.side) e.side = n.side;
    if (n.kind === 'origin' || n.kind === 'insertion') e.kind = n.kind;
    return e;
  };
  for (const sid of systems) {
    for (const s of sStructures[sid]) search.push(entry(s, 'structure'));
    for (const g of sGroups[sid]) search.push(entry(g, 'group'));
    for (const m of sLandmarks[sid]) search.push(entry(m, 'landmark'));
  }

  return {
    manifestBase: {
      schemaVersion: 1,
      source: SOURCE,
      languages,
      units: 'm',
      bodyBounds: {
        min: min.map((v) => Math.round(v * 1e6) / 1e6),
        max: max.map((v) => Math.round(v * 1e6) / 1e6),
      },
      systems: systemInfos,
      regions: model.regions,
      attributions,
      searchIndexFile: 'search-index.json',
      defaultHiddenIds: model.structures
        .filter((s) => s.defaultHidden && present.has(s.id))
        .map((s) => s.id)
        .sort(),
    },
    files: {
      structures: Object.fromEntries(
        systems.map((sid) => [
          sid,
          {
            schemaVersion: 1,
            system: sid,
            structures: sStructures[sid],
            groups: sGroups[sid],
            landmarks: sLandmarks[sid],
          },
        ]),
      ),
      definitions: Object.fromEntries(
        systems.map((sid) => [sid, { schemaVersion: 1, system: sid, definitions: definitions[sid] }]),
      ),
      search: { schemaVersion: 1, entries: search },
    },
    published: { structures, groups, landmarks },
    issues,
  };
}

function writeStaging(dir, assembled, systems, processed) {
  mkdirSync(join(dir, 'structures'), { recursive: true });
  mkdirSync(join(dir, 'definitions'), { recursive: true });
  const hash = createHash('sha256');
  const put = (rel, buf) => {
    writeFileAtomic(join(dir, rel), buf);
    hash.update(rel).update(buf);
  };
  for (const sid of systems) {
    for (const c of processed[sid].chunks) {
      copyFileSync(join(PATHS.processed, c.file), join(dir, c.file));
      hash.update(c.file).update(readFileSync(join(dir, c.file)));
    }
    put(`structures/${sid}.json`, JSON.stringify(assembled.files.structures[sid]));
    put(`definitions/${sid}.json`, JSON.stringify(assembled.files.definitions[sid]));
  }
  put('search-index.json', JSON.stringify(assembled.files.search));
  const { schemaVersion, ...rest } = assembled.manifestBase;
  const manifest = {
    schemaVersion,
    generatedAt: new Date().toISOString(),
    appDataVersion: hash.digest('hex').slice(0, 16),
    ...rest,
  };
  writeFileAtomic(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/** Swap the staging folder into place with two renames (public/models is gone only between them). */
function swapInto(staging, target) {
  const old = `${target}.old-${process.pid}`;
  if (existsSync(target)) renameSync(target, old);
  renameSync(staging, target);
  if (existsSync(old)) rmSync(old, { recursive: true, force: true });
}

// ------------------------------------------------------------------------------------------ ATTRIBUTION.md

function upstreamSection(readme, heading, until) {
  const start = readme.indexOf(heading);
  if (start === -1) return '';
  const end = until ? readme.indexOf(until, start + heading.length) : -1;
  return readme.slice(start + heading.length, end === -1 ? undefined : end).trim();
}

export function attributionMarkdown({
  readme,
  ncStructures,
  sideSwaps,
  nameFixes = [],
  settings,
  processSettings,
  ta2Present,
}) {
  const attributions = upstreamSection(readme, '## ATTRIBUTIONS', '## AUTHORS');
  const authors = upstreamSection(readme, '## AUTHORS:', null);
  const L = [];
  L.push('# Attribution');
  L.push('');
  L.push('<!-- Generated by pipeline/manifest.mjs — do not edit by hand. -->');
  L.push('');
  L.push(
    'The 3D models, anatomical names and definitions of this atlas come from **Z-Anatomy** ' +
      '(<https://github.com/Z-Anatomy/Models-of-human-anatomy>), licensed under ' +
      '[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The processed assets and extracted metadata ' +
      'are distributed under the same licence (see `assets.LICENSE`); the application code is MIT (see `LICENSE`).',
  );
  L.push('');
  L.push('## Upstream attributions (verbatim from the Z-Anatomy README)');
  L.push('');
  L.push(attributions);
  L.push('');
  L.push('### Upstream authors (verbatim)');
  L.push('');
  L.push(
    authors
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `- ${l}`)
      .join('\n'),
  );
  L.push('');
  L.push('## Terminology');
  L.push('');
  if (ta2Present) {
    L.push(
      '- Terminologia Anatomica, 2nd ed. (TA2), FIPAT, via Z-Anatomy `TA2.csv` — TA2 ids (`taId`) and Latin names ' +
        'where the Z-Anatomy `Translations` table has none (unique English matches only).',
    );
  } else {
    L.push('- TA2 was not available for this build (no `taId`).');
  }
  L.push('');
  L.push('## Modifications');
  L.push('');
  L.push(
    'The Z-Anatomy Blender file (`Startup.blend`) was converted by the learnanatomy.org asset pipeline (`pipeline/`):',
  );
  L.push('');
  L.push(
    `- geometry evaluated with all modifiers and curve bevels; subdivision surface capped at level ${settings.subsurfCap}, ` +
      `curve resolution capped at ${settings.curveResolutionCap} and round-bevel resolution at ${settings.bevelResolutionCap}`,
  );
  L.push(
    '- world transforms baked per object; mirrored left/right instances baked with flipped triangle winding',
  );
  L.push(
    "- converted to metres, Y-up (+Y superior, +Z anterior, +X patient's left), feet at y = 0, z centred; true scale",
  );
  L.push(
    `- simplified with meshoptimizer (absolute error ≤ ${processSettings.simplifyError * 1000} mm, borders locked), ` +
      `quantized (${processSettings.quantizeBits}-bit positions) and compressed with EXT_meshopt_compression`,
  );
  L.push('- one material colour per structure (base colour only, no textures); one GLB file per body system');
  L.push(
    '- names (English, Latin, French, Spanish, Portuguese) taken from the `Translations` table, definitions from the ' +
      'text datablocks (title line and trailing source URL separated; marked as not reviewed)',
  );
  if (sideSwaps.length) {
    L.push('- left/right naming errors corrected after human review (`pipeline/config/overrides.json`):');
    for (const s of sideSwaps) L.push(`  - \`${s.source}\` → ${s.side} (named ${s.suffixSide} upstream)`);
  }
  if (nameFixes.length) {
    L.push(
      '- spelling errors in names corrected after review (`pipeline/config/overrides.json` `nameFixes`):',
    );
    for (const f of nameFixes) L.push(`  - ${f.en} (${f.lang}): "${f.from}" → "${f.to}"`);
  }
  L.push('');
  L.push('## Definitions');
  L.push('');
  L.push(
    'Definitions are excerpts from Wikipedia (CC BY-SA 3.0) as included in Z-Anatomy; every definition links its ' +
      'source page. They are shown as "not reviewed" until a human reviewer has checked them.',
  );
  L.push('');
  L.push('## Non-commercial content');
  L.push('');
  L.push(
    'The following structures come from upstream components under **non-commercial** licences. They are marked ' +
      '`nonCommercial: true` in the data; a commercial deployment must remove them (filter `!s.nonCommercial`).',
  );
  L.push('');
  if (ncStructures.length) {
    L.push('| id | English name | source | licence |');
    L.push('|---|---|---|---|');
    for (const s of ncStructures) L.push(`| \`${s.id}\` | ${s.en} | ${s.text} | ${s.license} |`);
  } else {
    L.push('_None in this build._');
  }
  L.push('');
  L.push('## Provenance not recorded per structure');
  L.push('');
  L.push(
    'Upstream also credits "Brainder" and "White matter" (University of Washington, no licence stated) and ' +
      '"Cranial Nerves and Foramina" (University of Dundee, CAHID, CC BY 4.0) as references/adapted models. The ' +
      'Z-Anatomy file does not record which structures derive from them, so they are credited here as a whole.',
  );
  L.push('');
  return L.join('\n');
}

// ------------------------------------------------------------------------------------------ report

function pct(a, b) {
  return b ? `${((a / b) * 100).toFixed(1)} %` : '–';
}

export function reportMarkdown({
  previousHeader,
  model,
  assembled,
  systems,
  processed,
  scene,
  inventory,
  timings,
  held = [],
  review,
  reviews = [],
}) {
  const L = [];
  for (const line of previousHeader) L.push(line);
  if (previousHeader.length) L.push('');
  L.push('# Pipeline report');
  L.push('');
  L.push(
    `_Generated ${new Date().toISOString()} by \`pipeline/manifest.mjs\`. Systems in this build: ${systems.join(', ')}._`,
  );
  L.push('');
  const n = scene.normalization;
  L.push(
    `Source: \`${scene.file}\`, Blender ${scene.blender}, export ${scene.generatedAt}. Export settings: ` +
      `${JSON.stringify(scene.settings)}. Body height (all systems) ${n.height.toFixed(4)} m; normalization offset ` +
      `(Y-up) ${JSON.stringify(n.offset)}.`,
  );
  L.push('');
  L.push('## Stats');
  L.push('');
  L.push(
    '| system | structures | groups | landmarks | triangles (inventory, original settings) | triangles exported | triangles published | reduction | bytes per file | languages | with definition | NC |',
  );
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  const pub = assembled.published;
  let tot = { s: 0, g: 0, l: 0, inv: 0, before: 0, after: 0, bytes: 0, def: 0, nc: 0 };
  for (const sid of systems) {
    const p = processed[sid];
    const ss = pub.structures.filter((s) => s.system === sid);
    const gs = pub.groups.filter((g) => g.system === sid);
    const ls = pub.landmarks.filter((m) => m.system === sid);
    const langs = new Set();
    for (const s of ss) for (const k of Object.keys(s.names)) langs.add(k);
    const withDef = ss.filter((s) => s.definitionKey).length;
    const ncCount = ss.filter((s) => s.nonCommercial).length;
    const coll = model.systems.find((x) => x.id === sid).collection;
    const inv = inventory?.systems?.[coll]?.evalTris ?? 0;
    const bytes = p.chunks.map((c) => `${c.file}: ${fmtBytes(c.bytes)}`).join('<br>');
    L.push(
      `| ${sid} | ${ss.length} | ${gs.length} | ${ls.length} | ${fmtInt(inv)} | ${fmtInt(p.trianglesBefore)} | ${fmtInt(p.triangles)} | ` +
        `${pct(p.trianglesBefore - p.triangles, p.trianglesBefore)} | ${bytes} | ${['la', 'en', 'de', 'fr', 'es', 'pt'].filter((x) => langs.has(x)).join(', ')} | ` +
        `${pct(withDef, ss.length)} | ${ncCount} |`,
    );
    tot = {
      s: tot.s + ss.length,
      g: tot.g + gs.length,
      l: tot.l + ls.length,
      inv: tot.inv + inv,
      before: tot.before + p.trianglesBefore,
      after: tot.after + p.triangles,
      bytes: tot.bytes + p.chunks.reduce((a, c) => a + c.bytes, 0),
      def: tot.def + withDef,
      nc: tot.nc + ncCount,
    };
  }
  L.push(
    `| **total** | ${tot.s} | ${tot.g} | ${tot.l} | ${fmtInt(tot.inv)} | ${fmtInt(tot.before)} | ${fmtInt(tot.after)} | ` +
      `${pct(tot.before - tot.after, tot.before)} | ${fmtBytes(tot.bytes)} | ${assembled.manifestBase.languages.join(', ')} | ${pct(tot.def, tot.s)} | ${tot.nc} |`,
  );
  L.push('');
  L.push(
    `Largest file: ${largestFile(processed, systems)}. The startup download is checked by the validator (section ` +
      '"Validation" below).',
  );
  L.push('');
  if (timings) {
    L.push(
      'Timings (s): ' +
        Object.entries(timings)
          .map(([k, v]) => `${k} ${v.toFixed(1)}`)
          .join(', ') +
        '.',
    );
    L.push('');
  }

  L.push('## Simplification');
  L.push('');
  const ps = processed[systems[0]]?.settings;
  if (ps) {
    L.push(
      `meshoptimizer \`simplify\` with \`ErrorAbsolute\` + \`LockBorder\` (no pruning), error ${ps.simplifyError * 1000} mm ` +
        `(curves × ${ps.curveErrorFactor}), structures under ${ps.minTrianglesToSimplify} triangles untouched; a result is ` +
        `rejected when its bounding box moves by more than 2 × error. Quantization (scene volume per file): ` +
        systems.map((id) => `${id} ${processed[id].settings.quantizePosition}-bit`).join(', ') +
        ` positions; normals octahedral 8-bit (meshopt level \`${ps.meshoptLevel}\`).`,
    );
    L.push('');
  }
  L.push('| system | simplified primitives | skipped (reason) |');
  L.push('|---|---|---|');
  for (const sid of systems) {
    const s = processed[sid].simplify;
    L.push(
      `| ${sid} | ${s.applied} | ${
        Object.entries(s.skipped)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ') || '–'
      } |`,
    );
  }
  L.push('');

  // TA2
  L.push('## TA2 mapping');
  L.push('');
  if (Object.keys(model.report.ta2).length === 0) {
    L.push('_TA2.csv not found — no taId._');
  } else {
    L.push('| system | type | unique match | ambiguous | no match | Latin filled from TA2 |');
    L.push('|---|---|---|---|---|---|');
    for (const sid of systems) {
      for (const [type, c] of Object.entries(model.report.ta2[sid] ?? {})) {
        L.push(`| ${sid} | ${type} | ${c.match} | ${c.ambiguous} | ${c.none} | ${c.latinFilled} |`);
      }
    }
  }
  L.push('');

  // sides
  L.push('## Sides');
  L.push('');
  L.push('Applied side swaps (approved in `pipeline/config/overrides.json`):');
  L.push('');
  const swaps = model.report.sideSwaps.filter((s) =>
    systems.includes(model.structByName.get(s.source)?.system),
  );
  if (swaps.length)
    for (const s of swaps)
      L.push(`- \`${s.source}\` → ${s.side} (\`${model.structByName.get(s.source).id}\`)`);
  else L.push('- none in this build');
  L.push('');
  L.push('## Name fixes');
  L.push('');
  if (model.report.nameFixes.length)
    for (const f of model.report.nameFixes)
      L.push(
        `- ${f.applied ? 'applied' : '**not applied** (upstream text no longer matches; remove or update the entry)'}: ` +
          `${f.en} (${f.lang}) "${f.from}" → "${f.to}"`,
      );
  else L.push('- none');
  L.push('');
  if (review) {
    L.push(
      `Suffix sides that disagree with the geometry (vertex centroid beyond ±${review.tolerance} m), all processed ` +
        `systems: **${review.count}** — ${review.pairs.length} pairs where both members are swapped, ` +
        `${review.singles.length} single objects. Nothing is changed; proposed \`sideSwaps\` entries for the owner are in ` +
        '`data/inventory/side-review.json`.',
    );
    L.push('');
    if (review.count) {
      L.push('| object | system | named | centroid x | parent | parent side |');
      L.push('|---|---|---|---|---|---|');
      for (const i of [...review.pairs.flat(), ...review.singles]) {
        L.push(
          `| \`${i.source}\` | ${i.system} | ${i.side} | ${i.centroidX} | ${i.parent ?? '–'} | ${i.parentSide ?? '–'} |`,
        );
      }
      L.push('');
    }
  }
  for (const r of reviews) {
    L.push(`### Open review item \`${r.source}\` (\`${r.id}\`)`);
    L.push('');
    for (const [id, st] of Object.entries(r.structures)) {
      L.push(
        `- \`${id}\`: ${st.vertices} vertices, vertex centroid x = ${st.centroidX} m, y ${st.yRange[0]}–${st.yRange[1]} m; ` +
          'mean x per 5 cm height band (top → bottom): ' +
          [...st.bands]
            .reverse()
            .map((b) => `${b.y[0]}–${b.y[1]}: ${b.meanX}`)
            .join(', '),
      );
    }
    L.push('');
  }

  if (held.length) {
    L.push('## Systems held back (not published)');
    L.push('');
    for (const h of held) L.push(`- **${h.id}**: ${h.reason}`);
    L.push('');
  }

  // data issues
  const rep = model.report;
  L.push('## Data issues (for review)');
  L.push('');
  const list = (
    title,
    arr,
    fmt = (x) => `\`${typeof x === 'string' ? x : JSON.stringify(x)}\``,
    max = 60,
  ) => {
    L.push(`### ${title} (${arr.length})`);
    L.push('');
    if (!arr.length) {
      L.push('_none_');
    } else {
      L.push(
        arr.slice(0, max).map(fmt).join(', ') +
          (arr.length > max ? `, … (+${arr.length - max}, full list in pipeline-report.json)` : ''),
      );
    }
    L.push('');
  };
  list(
    'Id collisions (resolved deterministically)',
    rep.collisions,
    (c) =>
      `\`${c.stem}\` → ${c.members.map((m) => `${m.sourceName} [${m.system}] = \`${m.id}\``).join(' / ')}`,
    40,
  );
  const missing = systems.flatMap((s) => (rep.missingTranslations[s] ?? []).map((b) => `${s}: ${b}`));
  list('Names without a Translations row (English only unless TA2 filled Latin)', missing, (x) => x, 80);
  list('Structures dropped (no geometry after export)', assembled.issues.dropped);
  list(
    'Sides from the name dropped (geometry crosses the midline / lies on the other side)',
    assembled.issues.nameSidesDropped,
    (d) => `\`${d.id}\` named ${d.side}, vertex centroid x = ${d.x} m`,
  );
  const rv = assembled.issues.reviews;
  L.push(
    `Definition reviews (\`pipeline/config/definition-reviews.json\`): **${rv.applied.length}** published as reviewed.`,
  );
  L.push('');
  list(
    'Stale definition reviews (text changed since the review; published as not reviewed — review again)',
    rv.stale,
    (r) => `\`${r.key}\` (reviewed by ${r.reviewer}, ${r.date})`,
  );
  list('Definition reviews without a definition (key renamed or removed upstream)', rv.orphan);
  list(
    'References to unpublished nodes',
    assembled.issues.danglingRefs,
    (d) => `${d.id}.${d.key} → ${d.ref} (${d.reason})`,
  );
  list('Labels without a leader-line anchor', rep.labelsWithoutAnchor);
  list(
    'Labels not attached to a structure (parent is a group/none)',
    rep.unattachedLabels,
    (u) => `${u.label} (parent ${u.parent ?? '–'})`,
  );
  list('Redundant labels (structure already has a label)', rep.redundantLabels);
  list('Insertion patches without a matching muscle', rep.insertionsWithoutMuscle);
  list('Insertion patches without a bone parent', rep.insertionsWithoutBone);
  list(
    'Definitions with a non-Wikipedia or missing source (licence CC-BY-SA-4.0 assumed)',
    rep.definitionsNonWikipedia,
    (d) => `${d.name} (${d.source}${d.url ? `, ${d.url}` : ''})`,
    40,
  );
  list(
    'Definition texts not attached to any node',
    rep.definitionsUnattached,
    (d) => `${d.name}${d.region ? ' [region]' : ''}`,
    60,
  );
  list('Definition key conflicts', rep.definitionKeyConflicts);
  list(
    'Colour fallbacks (system colour used)',
    systems.flatMap((s) => (rep.colorFallback[s] ?? []).map((x) => `${s}: ${x}`)),
    (x) => x,
  );
  L.push(
    'Colour method per system: ' +
      systems.map((s) => `${s} ${JSON.stringify(rep.colorMethods[s] ?? {})}`).join('; '),
  );
  L.push('');
  list(
    'Objects without a usable name (not published)',
    rep.unnamed ?? [],
    (u) => `\`${u.name}\` [${u.system}] (parent ${u.parent ?? '–'})`,
  );
  list('Text objects with an unknown suffix (skipped)', rep.otherTexts);
  list('Translation rows with conflicting duplicates (first row used)', rep.translationConflicts);
  L.push('<!-- validation -->');
  L.push('');
  return L.join('\n');
}

/**
 * Suffix-sided structures whose geometry is on the other side, across every processed system (also held ones).
 * Evidence: vertex centroid x and the side of the Blender parent. Output feeds data/inventory/side-review.json,
 * a proposal for the owner — nothing here is applied.
 */
export function sideReview(model, scene, processedAll, tolerance = 0.002) {
  const byName = new Map(scene.objects.map((o) => [o.name, o]));
  const items = [];
  for (const s of model.structures) {
    if (s.sideSource !== 'suffix') continue;
    const st = processedAll[s.system]?.structures?.[s.id];
    if (!st) continue;
    const x = st.centroid[0];
    const wrong = s.side === 'left' ? x <= -tolerance : x >= tolerance;
    if (!wrong) continue;
    const parent = s.parentName ? byName.get(s.parentName) : undefined;
    const parentSide = parent
      ? /\.l$/.test(parent.name)
        ? 'left'
        : /\.r$/.test(parent.name)
          ? 'right'
          : undefined
      : undefined;
    items.push({
      source: s.sourceName,
      id: s.id,
      system: s.system,
      side: s.side,
      centroidX: Math.round(x * 1e4) / 1e4,
      geometrySide: x > 0 ? 'left' : 'right',
      parent: s.parentName ?? null,
      parentSide: parentSide ?? null,
      pair: s.pairId ?? null,
    });
  }
  const bySource = new Map(items.map((i) => [i.source, i]));
  const pairs = [];
  const singles = [];
  const seen = new Set();
  for (const i of items) {
    if (seen.has(i.source)) continue;
    const partnerName = i.source.replace(/([lr])$/, (m) => (m === 'l' ? 'r' : 'l'));
    const partner = bySource.get(partnerName);
    if (partner) {
      seen.add(partner.source);
      pairs.push([i, partner]);
    } else singles.push(i);
    seen.add(i.source);
  }
  return {
    tolerance,
    count: items.length,
    pairs,
    singles,
    proposedOverrides: [
      ...pairs.map(([a, b]) => ({
        source: [a.source, b.source].sort(),
        reason: `Both on the other side of their suffix (centroid x ${a.source}: ${a.centroidX}, ${b.source}: ${b.centroidX}); parents ${a.parent} / ${b.parent}.`,
        status: 'proposed',
      })),
      ...singles.map((i) => ({
        source: [i.source],
        reason: `Named ${i.side} but centroid x = ${i.centroidX} (${i.geometrySide})${i.parent ? `; parent ${i.parent}` : ''}; no counterpart on the other side.`,
        status: 'proposed',
      })),
    ],
  };
}

/** Per-height mean x of the vertices of open review items and their pair (decoded from the processed GLB). */
export async function reviewAnalysis(io, model, overrides, processedAll) {
  const out = [];
  for (const r of (overrides.toReview ?? []).filter((x) => ['open', 'accepted'].includes(x.status))) {
    const s = model.structByName.get(r.source);
    if (!s || !processedAll[s.system]) continue;
    const ids = [s.id, s.pairId].filter(Boolean);
    const result = { source: r.source, id: s.id, system: s.system, structures: {} };
    for (const c of processedAll[s.system].chunks) {
      if (!ids.some((id) => c.nodes.includes(id))) continue;
      const doc = await io.read(join(PATHS.processed, c.file));
      for (const node of doc.getRoot().listNodes()) {
        if (!ids.includes(node.getName())) continue;
        const m = node.getWorldMatrix();
        const pts = [];
        const el = [0, 0, 0];
        for (const prim of node.getMesh().listPrimitives()) {
          const pos = prim.getAttribute('POSITION');
          for (let i = 0; i < pos.getCount(); i++) {
            pos.getElement(i, el);
            pts.push([
              m[0] * el[0] + m[4] * el[1] + m[8] * el[2] + m[12],
              m[1] * el[0] + m[5] * el[1] + m[9] * el[2] + m[13],
            ]);
          }
        }
        const ys = pts.map((p) => p[1]);
        const lo = Math.min(...ys);
        const hi = Math.max(...ys);
        const bands = [];
        const step = 0.05;
        for (let y = Math.floor(lo / step) * step; y < hi; y += step) {
          const b = pts.filter((p) => p[1] >= y && p[1] < y + step);
          if (!b.length) continue;
          const mean = b.reduce((a, p) => a + p[0], 0) / b.length;
          bands.push({
            y: [Math.round(y * 100) / 100, Math.round((y + step) * 100) / 100],
            n: b.length,
            meanX: Math.round(mean * 1e4) / 1e4,
          });
        }
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        result.structures[node.getName()] = {
          vertices: pts.length,
          centroidX: Math.round(cx * 1e4) / 1e4,
          yRange: [lo, hi].map((v) => Math.round(v * 1000) / 1000),
          bands,
        };
      }
    }
    out.push(result);
  }
  return out;
}

function largestFile(processed, systems) {
  let best = ['–', 0];
  for (const sid of systems)
    for (const c of processed[sid].chunks) if (c.bytes > best[1]) best = [c.file, c.bytes];
  return `${best[0]} (${fmtBytes(best[1])})`;
}

function previousHeaderLines() {
  if (!existsSync(REPORT_PATH)) return [];
  const lines = readFileSync(REPORT_PATH, 'utf8').split('\n');
  const out = [];
  for (const l of lines) {
    if (/^\S+ delivered: /.test(l)) out.push(l);
    else if (l.trim() === '') continue;
    else break;
  }
  return out;
}

async function main() {
  const t0 = Date.now();
  const argv = process.argv.slice(2);
  const { config, nc, overrides, reviews: definitionReviews } = loadConfigs();
  const ids = config.systems.map((s) => s.id);
  const requested = parseSystemsArg(argv, ids);
  const available = ids.filter((id) => existsSync(join(PATHS.processed, `${id}.json`)));
  const isHeld = (id) => config.systems.find((s) => s.id === id)?.publish === false;
  // held systems (systems.json: publish false) are only published when requested explicitly
  const systems = (requested ?? available.filter((id) => !isHeld(id))).filter((id) => ids.includes(id));
  const held = available
    .filter((id) => isHeld(id) && !systems.includes(id))
    .map((id) => ({ id, reason: config.systems.find((s) => s.id === id).holdReason ?? 'publish: false' }));
  const missing = systems.filter((id) => !available.includes(id));
  if (missing.length)
    throw new Error(`Not processed yet: ${missing.join(', ')} — run \`node pipeline/process.mjs\` first.`);
  if (!systems.length) throw new Error('Nothing processed yet — run `npm run assets:process`.');

  const { scene, texts } = loadExport();
  const model = buildModel({ scene, texts, config, nc, overrides, ta2: loadTa2() });
  const processed = Object.fromEntries(
    systems.map((id) => [id, readJson(join(PATHS.processed, `${id}.json`))]),
  );
  for (const id of systems) {
    for (const c of processed[id].chunks) {
      if (!existsSync(join(PATHS.processed, c.file))) throw new Error(`Missing processed chunk ${c.file}`);
    }
  }

  const assembled = assemble(model, systems, processed, config, nc, definitionReviews);
  const staging = join(ROOT, 'public', `.models-staging-${process.pid}`);
  rmSync(staging, { recursive: true, force: true });
  // clean up leftovers of interrupted runs
  for (const f of readdirSync(join(ROOT, 'public'))) {
    if (/^\.models-staging-\d+$|^models\.old-\d+$/.test(f))
      rmSync(join(ROOT, 'public', f), { recursive: true, force: true });
  }
  const manifest = writeStaging(staging, assembled, systems, processed);
  // Gate: never replace public/models (served live to the viewer) with a build that fails validation.
  if (!argv.includes('--no-validate')) {
    const check = await validate({ dir: staging });
    if (check.errors.length) {
      for (const e of check.errors.slice(0, 50)) console.error(`[manifest] ERROR: ${e}`);
      writeJsonAtomic(
        join(PATHS.inventoryDir, 'validation-staging.json'),
        {
          at: new Date().toISOString(),
          systems,
          errors: check.errors,
          warnings: check.warnings,
          orientation: check.orientation,
          notes: check.notes,
        },
        true,
      );
      rmSync(staging, { recursive: true, force: true });
      throw new Error(
        `staging build failed validation (${check.errors.length} errors) — public/models left unchanged ` +
          '(re-run with --no-validate to publish anyway and inspect)',
      );
    }
    log(`staging build validated (${check.warnings.length} warnings)`);
    rmSync(join(PATHS.inventoryDir, 'validation-staging.json'), { force: true });
  }
  swapInto(staging, PATHS.models);
  log(
    `public/models: ${systems.join(', ')} — ${assembled.published.structures.length} structures, ${assembled.published.groups.length} groups, ${assembled.published.landmarks.length} landmarks, version ${manifest.appDataVersion}`,
  );

  // ATTRIBUTION.md
  const ncStructures = assembled.published.structures
    .filter((s) => s.nonCommercial)
    .map((s) => ({
      id: s.id,
      en: s.names.en,
      text: nc.sources[s.attribution]?.text ?? s.attribution,
      license: s.license,
    }));
  writeFileAtomic(
    PATHS.attribution,
    attributionMarkdown({
      readme: readFileSync(PATHS.upstreamReadme, 'utf8'),
      ncStructures,
      sideSwaps: model.report.sideSwaps.filter((s) =>
        systems.includes(model.structByName.get(s.source)?.system),
      ),
      nameFixes: model.report.nameFixes.filter((f) => f.applied),
      settings: scene.settings,
      processSettings: {
        ...processed[systems[0]].settings,
        quantizeBits: [...new Set(systems.map((id) => processed[id].settings.quantizePosition))]
          .sort()
          .join('/'),
      },
      ta2Present: Object.keys(model.report.ta2).length > 0,
    }),
  );

  // side review over every processed system (published or held) + open review items
  const processedAll = Object.fromEntries(
    available.map((id) => [id, readJson(join(PATHS.processed, `${id}.json`))]),
  );
  const review = sideReview(model, scene, processedAll);
  const reviews = await reviewAnalysis(await getIO(), model, overrides, processedAll);
  writeJsonAtomic(
    join(PATHS.inventoryDir, 'side-review.json'),
    {
      $comment:
        'Generated by pipeline/manifest.mjs. Proposed side corrections for the owner — NOT applied. To approve, copy entries into pipeline/config/overrides.json sideSwaps with status "approved".',
      generatedAt: new Date().toISOString(),
      ...review,
      openReviewItems: reviews,
    },
    true,
  );

  // report
  const inventoryPath = join(PATHS.inventoryDir, 'inventory.json');
  const inventory = existsSync(inventoryPath) ? readJson(inventoryPath) : null;
  const timings = { manifest: (Date.now() - t0) / 1000 };
  for (const id of systems) timings[`process ${id}`] = processed[id].seconds ?? 0;
  writeFileAtomic(
    REPORT_PATH,
    reportMarkdown({
      previousHeader: previousHeaderLines(),
      model,
      assembled,
      systems,
      processed,
      scene,
      inventory,
      timings,
      held,
      review,
      reviews,
    }),
  );
  writeJsonAtomic(
    REPORT_JSON,
    {
      generatedAt: new Date().toISOString(),
      systems,
      appDataVersion: manifest.appDataVersion,
      report: {
        ...model.report,
        dropped: assembled.issues.dropped,
        danglingRefs: assembled.issues.danglingRefs,
        nameSidesDropped: assembled.issues.nameSidesDropped,
        definitionReviews: assembled.issues.reviews,
      },
    },
    true,
  );
  log(
    `ATTRIBUTION.md, data/inventory/PIPELINE_REPORT.md written (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
