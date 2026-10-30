// Builds the atlas data model (structures, groups, landmarks, definitions, regions, systems) from the raw
// Blender dump (data/export/scene.json + texts.json). Pure function of its inputs: subset and full runs give
// identical ids because scene.json always lists every object of all nine systems. ARCHITECTURE.md §4.2–4.3.
import { baseId, parseName, resolveIds, sideFromName, slug } from './names.mjs';
import { buildTa2Index, buildTranslations, matchTa2, parseDefinition } from './texts.mjs';

export const ATTRIBUTIONS = {
  'z-anatomy': {
    text: 'Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0',
    license: 'CC-BY-SA-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy',
  },
  bodyparts3d: {
    text: 'BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan',
    license: 'CC-BY-SA-2.1-JP',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.1/jp/',
    url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html',
  },
  wikipedia: {
    text: 'Wikipedia - CC-BY-SA 3.0',
    license: 'CC-BY-SA-3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    url: 'https://en.wikipedia.org/',
  },
  // Credited upstream as "used as reference/included and adapted"; which structures derive from them is not
  // recorded, so they are credited as a whole (ATTRIBUTION.md, "Provenance not recorded per structure").
  'dundee-cranial-nerves': {
    text: 'Cranial Nerves and Foramina - by University of Dundee, CAHID - CC-BY 4.0',
    license: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  'uw-brainder-white-matter': {
    // No licence stated upstream.
    text: '"Brainder" and "White matter" from the University of Washington',
  },
};

const DEFAULT_COLOR = '#cccccc';

function mostCommon(values) {
  const c = new Map();
  for (const v of values) if (v) c.set(v, (c.get(v) ?? 0) + 1);
  let best;
  let n = -1;
  for (const [k, v] of [...c.entries()].sort()) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

/**
 * @param {object} input
 * @param {object} input.scene      data/export/scene.json
 * @param {object} input.texts      data/export/texts.json
 * @param {object} input.config     pipeline/config/systems.json
 * @param {object} input.nc         pipeline/config/non-commercial.json
 * @param {object} input.overrides  pipeline/config/overrides.json
 * @param {Array}  [input.ta2]      parsed TA2 rows (optional)
 */
export function buildModel({ scene, texts, config, nc, overrides, ta2 }) {
  const report = {
    collisions: [],
    sideSwaps: [],
    missingTranslations: {},
    ta2: {},
    labels: {},
    unattachedLabels: [],
    unnamed: [],
    redundantLabels: [],
    labelsWithoutAnchor: [],
    definitionsNonWikipedia: [],
    definitionsUnattached: [],
    definitionKeyConflicts: [],
    insertionsWithoutMuscle: [],
    insertionsWithoutBone: [],
    colorFallback: {},
    colorMethods: {},
    otherTexts: [],
    duplicatesAcrossSystems: scene.duplicatesAcrossSystems ?? [],
    translationConflicts: [],
    nameFixes: [],
  };

  const systemOrder = new Map(config.systems.map((s, i) => [s.id, i]));
  const { map: tr, conflicts, languages } = buildTranslations(texts.translations);
  report.translationConflicts = conflicts;
  const ta2Index = ta2 ? buildTa2Index(ta2) : null;
  const ncByBase = new Map();
  for (const [srcId, src] of Object.entries(nc.sources ?? {}))
    for (const b of src.structures) ncByBase.set(b, srcId);
  const sysConfig = new Map(config.systems.map((s) => [s.id, s]));
  const swaps = new Set();
  for (const s of overrides.sideSwaps ?? []) {
    if (s.status === 'approved') for (const n of s.source) swaps.add(n);
  }

  const objects = scene.objects;
  const byName = new Map(objects.map((o) => [o.name, o]));

  // ------------------------------------------------------------------ definitions (parsed lazily, cached)
  const defCache = new Map();
  const definitionFor = (base) => {
    if (!defCache.has(base)) {
      const raw = texts.texts[base] ?? texts.texts[` ${base}`];
      defCache.set(base, raw === undefined ? null : parseDefinition(raw));
    }
    return defCache.get(base);
  };
  const usedTextNames = new Set();

  // Reviewed spelling corrections (overrides.json nameFixes), applied only while the upstream text still equals `from`.
  const nameFixes = (overrides.nameFixes ?? []).filter((f) => f.status === 'approved');
  const nameFixesUsed = new Set();
  const namesFor = (en) => {
    const names = { en };
    const t = tr.get(en);
    if (t) Object.assign(names, t);
    for (const f of nameFixes) {
      if (f.en === en && names[f.lang] === f.from) {
        names[f.lang] = f.to;
        nameFixesUsed.add(f);
      }
    }
    return names;
  };

  // ------------------------------------------------------------------ structures
  const structures = [];
  const structByName = new Map();
  for (const o of objects) {
    if (o.kind !== 'structure') continue;
    const p = parseName(o.name);
    if (!slug(p.base)) {
      // e.g. an object literally named "????????": no usable English name → not published
      report.unnamed.push({ name: o.name, system: o.system, parent: o.parent ?? null });
      continue;
    }
    let kind = p.kind === 'origin' || p.kind === 'insertion' ? p.kind : 'structure';
    if (p.kind === 'group' || p.kind === 'label' || p.kind === 'line') kind = 'structure';
    let side = p.side;
    let sideSource = side ? 'suffix' : undefined;
    // Approved swaps behave like suffix sides internally (ids, pairs); they are published as 'override'.
    let sideOverridden = false;
    if (side && swaps.has(o.name)) {
      const corrected = side === 'left' ? 'right' : 'left';
      report.sideSwaps.push({ source: o.name, suffixSide: side, side: corrected });
      side = corrected;
      sideOverridden = true;
    }
    if (!side) {
      side = sideFromName(p.base);
      if (side) sideSource = 'name';
    }
    const s = {
      sourceName: o.name,
      system: o.system,
      kind,
      base: p.base,
      patch: p.patch,
      side,
      sideSource,
      sideOverridden,
      isCurve: !!o.isCurve,
      color: o.color,
      colorMethod: o.colorMethod,
      material: o.material,
      parentName: o.parent,
      regionCollections: o.regionCollections ?? [],
      // Hidden until the user shows them (systems.json): defaultHiddenCollections, e.g. the fasciae over the
      // muscles; defaultHiddenChildrenOf, e.g. the liver segments, which repeat the liver's volume.
      defaultHidden:
        (sysConfig.get(o.system)?.defaultHiddenCollections ?? []).some((c) =>
          (o.collections ?? []).includes(c),
        ) || (sysConfig.get(o.system)?.defaultHiddenChildrenOf ?? []).includes(o.parent),
      stem: baseId(kind, p.base, { side, sideFromSuffix: sideSource === 'suffix', patch: p.patch }),
    };
    structures.push(s);
    structByName.set(o.name, s);
  }
  const structsByBase = new Map();
  for (const s of structures) {
    const k = `${s.system}\u0000${s.base}`;
    if (!structsByBase.has(k)) structsByBase.set(k, []);
    structsByBase.get(k).push(s);
  }

  // ------------------------------------------------------------------ groups
  const groups = [];
  const groupByName = new Map();
  for (const o of objects) {
    if (o.kind !== 'group') continue;
    const p = parseName(o.name);
    if (!slug(p.base)) {
      report.unnamed.push({ name: o.name, system: o.system, parent: o.parent ?? null });
      continue;
    }
    const g = {
      sourceName: o.name,
      system: o.system,
      base: p.base,
      parentName: o.parent,
      stem: baseId('group', p.base),
    };
    groups.push(g);
    groupByName.set(o.name, g);
  }
  for (const o of objects) if (o.kind === 'otherText') report.otherTexts.push(o.name);

  // ------------------------------------------------------------------ labels → labelAnchor / landmarks
  const labels = objects
    .filter((o) => o.kind === 'label')
    .sort((a, b) => labelRank(a) - labelRank(b) || cmp(a.name, b.name));
  const ownLabel = new Map(); // structure sourceName -> label
  const landmarks = [];
  const pending = [];
  const pickBySide = (cands, side) => {
    if (cands.length === 1) return cands[0];
    const same = cands.filter((c) => c.side === side);
    return same.length === 1 ? same[0] : undefined;
  };
  for (const l of labels) {
    const p = parseName(l.name);
    if (!slug(p.base)) {
      report.unnamed.push({ name: l.name, system: l.system, parent: l.parent ?? null });
      continue;
    }
    if (!l.anchor) {
      report.labelsWithoutAnchor.push(l.name);
      continue;
    }
    const parent = l.parent ? byName.get(l.parent) : undefined;
    const parentStruct = parent ? structByName.get(parent.name) : undefined;
    if (parentStruct && parentStruct.base === p.base) {
      if (!ownLabel.has(parentStruct.sourceName)) ownLabel.set(parentStruct.sourceName, l);
      else report.redundantLabels.push(l.name);
      continue;
    }
    const named = structsByBase.get(`${l.system}\u0000${p.base}`) ?? [];
    if (named.length) {
      pending.push({ l, target: pickBySide(named, parentStruct?.side), parentStruct });
      continue;
    }
    if (parentStruct) {
      landmarks.push({
        sourceName: l.name,
        system: parentStruct.system,
        base: p.base,
        structure: parentStruct,
        side: parentStruct.side,
        anchor: l.anchor,
        stem: baseId('landmark', p.base, { side: parentStruct.side }),
      });
      continue;
    }
    report.unattachedLabels.push({ label: l.name, parent: l.parent ?? null });
  }
  // labels that name another structure: they become that structure's labelAnchor when it has none
  for (const { l, target, parentStruct } of pending) {
    if (target && !ownLabel.has(target.sourceName)) ownLabel.set(target.sourceName, l);
    else if (!target && parentStruct)
      report.unattachedLabels.push({
        label: l.name,
        parent: l.parent,
        reason: 'names a structure (ambiguous side)',
      });
    else report.redundantLabels.push(l.name);
  }
  report.labels = {
    total: labels.length,
    labelAnchors: ownLabel.size,
    landmarks: landmarks.length,
    unattached: report.unattachedLabels.length,
    redundant: report.redundantLabels.length,
    withoutAnchor: report.labelsWithoutAnchor.length,
  };

  // ------------------------------------------------------------------ ids (all nodes, all systems)
  const items = [
    ...structures.map((s) => ({
      key: `s:${s.sourceName}`,
      stem: s.stem,
      sourceName: s.sourceName,
      system: s.system,
    })),
    ...groups.map((g) => ({
      key: `g:${g.sourceName}`,
      stem: g.stem,
      sourceName: g.sourceName,
      system: g.system,
    })),
    ...landmarks.map((m) => ({
      key: `l:${m.sourceName}`,
      stem: m.stem,
      sourceName: m.sourceName,
      system: m.system,
    })),
  ].map((it) => ({ ...it, systemOrder: systemOrder.get(it.system) }));
  const { ids, collisions } = resolveIds(items);
  report.collisions = collisions;
  for (const s of structures) s.id = ids.get(`s:${s.sourceName}`);
  for (const g of groups) g.id = ids.get(`g:${g.sourceName}`);
  for (const m of landmarks) m.id = ids.get(`l:${m.sourceName}`);

  // ------------------------------------------------------------------ definitions per system
  const definitions = Object.fromEntries(config.systems.map((s) => [s.id, {}]));
  const keyOwner = new Map(); // `${system}/${key}` -> base
  const attachDefinition = (system, base) => {
    const d = definitionFor(base);
    if (!d) return undefined;
    const key = slug(base);
    const ownerKey = `${system}/${key}`;
    const owner = keyOwner.get(ownerKey);
    if (owner !== undefined && owner !== base) {
      report.definitionKeyConflicts.push({ system, key, bases: [owner, base] });
      return undefined;
    }
    keyOwner.set(ownerKey, base);
    usedTextNames.add(base);
    if (!definitions[system][key]) {
      const def = { text: { [d.lang]: d.text }, source: d.source, license: d.license, reviewed: false };
      if (d.sourceUrl) def.sourceUrl = d.sourceUrl;
      definitions[system][key] = def;
      if (d.source !== 'Wikipedia')
        report.definitionsNonWikipedia.push({ name: base, source: d.source, url: d.sourceUrl ?? null });
    }
    return key;
  };

  // ------------------------------------------------------------------ names, TA2, relations
  const ta2Stats = {};
  const bumpTa2 = (system, type, status) => {
    ta2Stats[system] ??= {};
    ta2Stats[system][type] ??= { match: 0, ambiguous: 0, none: 0, latinFilled: 0 };
    ta2Stats[system][type][status]++;
  };
  const fillNames = (node, type) => {
    const names = namesFor(node.base);
    if (!tr.has(node.base)) {
      report.missingTranslations[node.system] ??= [];
      if (!report.missingTranslations[node.system].includes(node.base))
        report.missingTranslations[node.system].push(node.base);
    }
    if (ta2Index) {
      const m = matchTa2(ta2Index, node.base, tr.get(node.base)?.la);
      bumpTa2(node.system, type, m.status);
      if (m.status === 'match') {
        if (type === 'structure') node.taId = String(m.row.id);
        if (!names.la && m.row.la) {
          names.la = m.row.la;
          ta2Stats[node.system][type].latinFilled++;
        }
      }
    }
    node.names = names;
  };

  const sysColor = {};
  for (const sys of config.systems) {
    sysColor[sys.id] =
      mostCommon(structures.filter((s) => s.system === sys.id).map((s) => s.color)) ?? DEFAULT_COLOR;
  }

  const pairKey = (s) => `${s.system}\u0000${s.kind}\u0000${s.base}\u0000${s.patch ?? ''}`;
  const pairs = new Map();
  for (const s of structures) {
    if (s.sideSource !== 'suffix') continue;
    const k = pairKey(s);
    if (!pairs.has(k)) pairs.set(k, {});
    const slot = pairs.get(k);
    if (slot[s.side]) slot.dup = true;
    else slot[s.side] = s;
  }
  const regionIdOf = new Map();
  for (const r of config.regions) for (const c of r.collections) regionIdOf.set(c, r.id);
  const regionOrder = new Map(config.regions.map((r, i) => [r.id, i]));
  const toRegions = (cols) =>
    [...new Set(cols.map((c) => regionIdOf.get(c)).filter(Boolean))].sort(
      (a, b) => regionOrder.get(a) - regionOrder.get(b),
    );

  const muscles = new Map();
  for (const s of structures)
    if (s.system === 'muscular' && s.kind === 'structure') muscles.set(`${s.base}\u0000${s.side ?? ''}`, s);

  for (const s of structures) {
    fillNames(s, 'structure');
    s.regions = toRegions(s.regionCollections);
    const parent = s.parentName ? byName.get(s.parentName) : undefined;
    const pg = parent && groupByName.get(parent.name);
    const ps = parent && structByName.get(parent.name);
    if (pg && pg.system === s.system) s.parentId = pg.id;
    else if (ps && ps.system === s.system) s.parentId = ps.id;
    if (s.sideSource === 'suffix') {
      const slot = pairs.get(pairKey(s));
      const other = slot && !slot.dup ? slot[s.side === 'left' ? 'right' : 'left'] : undefined;
      if (other) s.pairId = other.id;
    }
    if (s.kind === 'origin' || s.kind === 'insertion') {
      const m = muscles.get(`${s.base}\u0000${s.side ?? ''}`) ?? muscles.get(`${s.base}\u0000`);
      if (m) s.muscleId = m.id;
      else report.insertionsWithoutMuscle.push(s.sourceName);
      if (ps) s.boneId = ps.id;
      else report.insertionsWithoutBone.push(s.sourceName);
    }
    const dk = attachDefinition(s.system, s.base);
    if (dk) s.definitionKey = dk;
    if (!s.color) {
      s.color = sysColor[s.system];
      (report.colorFallback[s.system] ??= []).push(s.sourceName);
    }
    report.colorMethods[s.system] ??= {};
    report.colorMethods[s.system][s.colorMethod ?? 'none'] =
      (report.colorMethods[s.system][s.colorMethod ?? 'none'] ?? 0) + 1;
    const ncSource = ncByBase.get(s.base);
    if (ncSource) {
      s.attribution = ncSource;
      s.license = nc.sources[ncSource].license;
      s.nonCommercial = true;
    } else {
      s.attribution = 'z-anatomy';
      s.license = 'CC-BY-SA-4.0';
    }
    const lab = ownLabel.get(s.sourceName);
    if (lab) s.labelAnchor = lab.anchor;
  }
  // insertion patches without own region membership inherit the regions of their bone
  const structById = new Map(structures.map((s) => [s.id, s]));
  for (const s of structures) {
    if ((s.kind === 'origin' || s.kind === 'insertion') && s.regions.length === 0 && s.boneId) {
      s.regions = [...(structById.get(s.boneId)?.regions ?? [])];
    }
  }
  for (const g of groups) {
    fillNames(g, 'group');
    const parent = g.parentName ? byName.get(g.parentName) : undefined;
    const pg = parent && groupByName.get(parent.name);
    const ps = parent && structByName.get(parent.name);
    if (pg && pg.system === g.system) g.parentId = pg.id;
    else if (ps && ps.system === g.system) g.parentId = ps.id;
    const dk = attachDefinition(g.system, g.base);
    if (dk) g.definitionKey = dk;
  }
  attachBones(structures, groups);
  for (const m of landmarks) {
    fillNames(m, 'landmark');
    m.structureId = m.structure.id;
    const dk = attachDefinition(m.system, m.base);
    if (dk) m.definitionKey = dk;
  }
  report.ta2 = ta2Stats;

  // texts that matched nothing (collection-named texts etc.)
  const regionNames = new Set(config.regions.map((r) => r.nameEn ?? r.collections[0]));
  for (const name of Object.keys(texts.texts)) {
    const b = name.trim();
    if (usedTextNames.has(b) || name === '1.Licence') continue;
    report.definitionsUnattached.push({ name: b, region: regionNames.has(b) || undefined });
  }

  // ------------------------------------------------------------------ systems + regions
  const systems = config.systems.map((sys) => {
    const sc = scene.systems.find((x) => x.id === sys.id);
    const en = String(sc?.collection ?? sys.collection).replace(/^\d+:\s*/, '');
    return {
      id: sys.id,
      collection: sys.collection,
      names: namesFor(en),
      color: sysColor[sys.id],
      layerOrder: sys.layerOrder,
      defaultVisible: sys.defaultVisible,
      defaultOpacity: sys.defaultOpacity,
    };
  });
  const regions = config.regions.map((r) => {
    const info = { id: r.id, names: namesFor(r.nameEn ?? r.collections[0]) };
    if (r.parentId) info.parentId = r.parentId;
    return info;
  });

  report.nameFixes = nameFixes.map((f) => ({ ...f, applied: nameFixesUsed.has(f) }));

  const presentLangs = new Set(['en']);
  for (const n of [...structures, ...groups, ...landmarks])
    for (const k of Object.keys(n.names)) presentLangs.add(k);
  const langOrder = ['la', 'en', 'de', 'fr', 'es', 'pt'];
  return {
    systems,
    regions,
    structures,
    groups,
    landmarks,
    definitions,
    languages: langOrder.filter((l) => presentLangs.has(l)),
    translationLanguages: languages,
    structByName,
    report,
  };
}

/**
 * `boneIds` of the muscles: the bones their origin and insertion patches sit on (isolating a muscle keeps them
 * visible). A patch named after a whole muscle that the source splits into parts reaches every part on its side:
 * the group of that name ("Biceps brachii muscle") or the structures named "… of <muscle>" ("Deep head of pronator
 * teres" for "Pronator teres"). The source misses some patches on one side and parents a few to the bone of the
 * other side, so a bone on the other side than the muscle is skipped and left and right muscles get the same
 * (mirrored) bones. Muscles without patches on either side get none.
 */
function attachBones(structures, groups) {
  const muscles = structures.filter((s) => s.system === 'muscular' && s.kind === 'structure');
  const byId = new Map(muscles.map((s) => [s.id, s]));
  const boneById = new Map(structures.filter((s) => s.system === 'skeletal').map((s) => [s.id, s]));
  const children = new Map();
  for (const n of [...groups, ...muscles]) {
    if (n.system !== 'muscular' || !n.parentId) continue;
    if (!children.has(n.parentId)) children.set(n.parentId, []);
    children.get(n.parentId).push(n.id);
  }
  const musclesUnder = (id) => {
    const out = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      if (byId.has(cur)) out.push(byId.get(cur));
      stack.push(...(children.get(cur) ?? []));
    }
    return out;
  };
  const groupByBase = new Map(groups.filter((g) => g.system === 'muscular').map((g) => [g.base, g]));
  const bare = (base) =>
    base
      .replace(/^\((.*)\)$/, '$1')
      .toLowerCase()
      .replace(/ muscle$/, '');

  for (const p of structures) {
    if ((p.kind !== 'origin' && p.kind !== 'insertion') || !p.boneId) continue;
    let targets;
    if (p.muscleId) targets = [byId.get(p.muscleId)];
    else if (groupByBase.has(p.base)) targets = musclesUnder(groupByBase.get(p.base).id);
    else {
      const tail = ` of ${bare(p.base)}`;
      targets = muscles.filter((m) => bare(m.base).endsWith(tail));
    }
    const boneSide = boneById.get(p.boneId)?.side;
    for (const m of targets) {
      if (!m || (m.side && p.side && m.side !== p.side) || (m.side && boneSide && m.side !== boneSide))
        continue;
      (m.boneIds ??= new Set()).add(p.boneId);
    }
  }
  const own = new Map(muscles.map((m) => [m, [...(m.boneIds ?? [])]]));
  for (const m of muscles) {
    const pair = m.pairId && byId.get(m.pairId);
    for (const b of (pair && own.get(pair)) ?? []) {
      const bone = boneById.get(b);
      const mirrored = bone?.side ? bone.pairId : b;
      if (mirrored) (m.boneIds ??= new Set()).add(mirrored);
    }
  }
  for (const m of muscles) if (m.boneIds) m.boneIds = [...m.boneIds].sort();
}

function labelRank(o) {
  return o.name.endsWith('.t') ? 0 : 1;
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Contract-shaped Structure (src/contract/anatomy.ts) from a model structure + geometry stats. */
export function toStructure(s, geo) {
  const out = {
    id: s.id,
    kind: s.kind,
    nodeName: s.id,
    chunk: geo.chunk,
    system: s.system,
    regions: s.regions,
  };
  if (s.side) {
    out.side = s.side;
    out.sideSource = s.sideOverridden ? 'override' : s.sideSource;
  }
  if (s.pairId) out.pairId = s.pairId;
  if (s.parentId) out.parentId = s.parentId;
  out.names = s.names;
  if (s.taId) out.taId = s.taId;
  if (s.definitionKey) out.definitionKey = s.definitionKey;
  if (s.muscleId) out.muscleId = s.muscleId;
  if (s.boneId) out.boneId = s.boneId;
  if (s.boneIds) out.boneIds = s.boneIds;
  out.color = s.color;
  out.centroid = geo.centroid;
  out.bbox = geo.bbox;
  if (s.labelAnchor) out.labelAnchor = s.labelAnchor;
  out.triangles = geo.triangles;
  out.attribution = s.attribution;
  out.license = s.license;
  if (s.nonCommercial) out.nonCommercial = true;
  return out;
}

export function toGroup(g) {
  const out = { id: g.id, system: g.system, names: g.names };
  if (g.parentId) out.parentId = g.parentId;
  if (g.definitionKey) out.definitionKey = g.definitionKey;
  return out;
}

export function toLandmark(m) {
  const out = { id: m.id, system: m.system, structureId: m.structureId, names: m.names };
  if (m.side) out.side = m.side;
  out.anchor = m.anchor;
  if (m.definitionKey) out.definitionKey = m.definitionKey;
  return out;
}
