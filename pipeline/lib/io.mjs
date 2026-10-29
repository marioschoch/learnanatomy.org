// File locations, config loading and glTF I/O shared by process.mjs, manifest.mjs and validate.mjs.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { parseTa2Csv } from './texts.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PATHS = {
  config: join(ROOT, 'pipeline', 'config', 'systems.json'),
  nc: join(ROOT, 'pipeline', 'config', 'non-commercial.json'),
  overrides: join(ROOT, 'pipeline', 'config', 'overrides.json'),
  exportDir: join(ROOT, 'data', 'export'),
  scene: join(ROOT, 'data', 'export', 'scene.json'),
  texts: join(ROOT, 'data', 'export', 'texts.json'),
  raw: join(ROOT, 'data', 'export', 'raw'),
  processed: join(ROOT, 'data', 'export', 'processed'),
  ta2: join(ROOT, 'data', 'raw', 'ta2', 'TA2.csv'),
  upstreamReadme: join(ROOT, 'data', 'inventory', 'upstream', 'Readme.md'),
  inventoryDir: join(ROOT, 'data', 'inventory'),
  models: join(ROOT, 'public', 'models'),
  attribution: join(ROOT, 'ATTRIBUTION.md'),
};

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Write atomically (temp file + rename) so watchers never see half-written files. */
export function writeFileAtomic(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

export function writeJsonAtomic(path, data, pretty = false) {
  writeFileAtomic(path, JSON.stringify(data, null, pretty ? 2 : undefined) + (pretty ? '\n' : ''));
}

export function loadConfigs() {
  return {
    config: readJson(PATHS.config),
    nc: readJson(PATHS.nc),
    overrides: readJson(PATHS.overrides),
  };
}

/** Raw Blender dump. Throws a helpful error when the export step has not run. */
export function loadExport() {
  if (!existsSync(PATHS.scene) || !existsSync(PATHS.texts)) {
    throw new Error(`Missing ${PATHS.scene} — run \`npm run assets:export\` first.`);
  }
  return { scene: readJson(PATHS.scene), texts: readJson(PATHS.texts) };
}

/** TA2 rows, or null when data/raw/ta2/TA2.csv is not present (TA2 is optional). */
export function loadTa2() {
  if (!existsSync(PATHS.ta2)) return null;
  return parseTa2Csv(readFileSync(PATHS.ta2, 'utf8'));
}

let ioPromise;
export function getIO() {
  ioPromise ??= (async () => {
    await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
    return new NodeIO()
      .registerExtensions([KHRMeshQuantization, EXTMeshoptCompression])
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  })();
  return ioPromise;
}

export { MeshoptEncoder, MeshoptSimplifier };

/**
 * `--systems a,b` (or `--systems=a,b`) from argv, else the ASSET_SYSTEMS env variable
 * (`ASSET_SYSTEMS=skeletal npm run assets:build`); returns null for "all".
 * Unknown ids throw.
 */
export function parseSystemsArg(argv, known) {
  let value;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--systems') value = argv[i + 1];
    else if (a.startsWith('--systems=')) value = a.slice('--systems='.length);
  }
  value ??= process.env.ASSET_SYSTEMS;
  if (!value || value === 'all') return null;
  const list = value
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = list.filter((s) => !known.includes(s));
  if (unknown.length)
    throw new Error(`Unknown system id(s): ${unknown.join(', ')}. Known: ${known.join(', ')}`);
  return list;
}

/** True when the module at `metaUrl` is the script node was started with (paths may contain spaces). */
export function isMain(metaUrl) {
  return !!process.argv[1] && fileURLToPath(metaUrl) === resolve(process.argv[1]);
}

export function hasFlag(argv, flag) {
  return argv.includes(flag);
}

export function fmtBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

export function fmtInt(n) {
  return Number(n).toLocaleString('en-US');
}
