#!/usr/bin/env node
// Runs a pipeline Blender script headless against the Z-Anatomy .blend.
//
//   node pipeline/blender/run.mjs inventory   -> pipeline/blender/inventory.py --out data/inventory/
//   node pipeline/blender/run.mjs export      -> pipeline/blender/export.py   --out data/export/
//   node pipeline/blender/run.mjs export -- --systems skeletal   (extra args are passed to the script;
//                                                                 ASSET_SYSTEMS=skeletal does the same)
//   node pipeline/blender/run.mjs script <file.py> [args…]       (development: any read-only probe script,
//                                                                 --out data/export/probe/)
//
// Blender is resolved in this order: BLENDER_PATH (env or .env.local) → `blender` on PATH →
// the macOS / Windows default install locations.
// The .blend is resolved under data/raw/; if only Z-Anatomy.zip exists it is unzipped first.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(root, 'data', 'raw');

const TASKS = {
  inventory: { script: 'pipeline/blender/inventory.py', out: 'data/inventory' },
  export: { script: 'pipeline/blender/export.py', out: 'data/export' },
};

function loadEnv() {
  const envFile = join(root, '.env.local');
  if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
  }
}

function works(bin) {
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  return r.status === 0 && /Blender/.test(r.stdout ?? '');
}

function findBlender() {
  const candidates = [];
  if (process.env.BLENDER_PATH) candidates.push(process.env.BLENDER_PATH);
  candidates.push('blender');
  candidates.push('/Applications/Blender.app/Contents/MacOS/Blender');
  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\Blender Foundation';
    if (existsSync(base)) {
      for (const d of readdirSync(base).sort().reverse()) candidates.push(join(base, d, 'blender.exe'));
    }
  }
  for (const c of candidates) if (works(c)) return c;
  throw new Error(
    `Blender not found. Tried: ${candidates.join(', ')}.\nSet BLENDER_PATH in .env.local to your Blender executable.`,
  );
}

function findFiles(dir, pred, depth = 0, out = []) {
  if (!existsSync(dir) || depth > 4) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) findFiles(p, pred, depth + 1, out);
    else if (pred(name)) out.push(p);
  }
  return out;
}

function findBlend() {
  let blends = findFiles(RAW, (n) => n.toLowerCase() === 'startup.blend');
  if (blends.length === 0) {
    const zips = findFiles(RAW, (n) => /^z-anatomy\.zip$/i.test(n));
    if (zips.length === 0) throw new Error(`No Startup.blend or Z-Anatomy.zip found under ${RAW}`);
    const dest = join(RAW, 'z-anatomy');
    mkdirSync(dest, { recursive: true });
    console.log(`Unzipping ${zips[0]} -> ${dest}`);
    // `tar` understands zip archives on Windows 10+, macOS (bsdtar) and most Linux distros.
    const cmd =
      process.platform === 'win32'
        ? ['tar', ['-xf', zips[0], '-C', dest]]
        : ['unzip', ['-q', '-o', zips[0], '-d', dest]];
    const r = spawnSync(cmd[0], cmd[1], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('Unzip failed');
    blends = findFiles(RAW, (n) => n.toLowerCase() === 'startup.blend');
  }
  if (blends.length === 0) throw new Error('Startup.blend not found after unzipping');
  return blends[0];
}

const taskName = process.argv[2];
let extra = process.argv.slice(3);
let task = TASKS[taskName];
if (taskName === 'script' && extra[0]) {
  task = { script: resolve(extra[0]), out: 'data/export/probe' };
  extra = extra.slice(1);
}
// `run.mjs export -- --systems skeletal`: drop the separator, the script gets its own `--` below.
if (extra[0] === '--') extra = extra.slice(1);
// ASSET_SYSTEMS=skeletal npm run assets:build → subset for every step (export, process, manifest, validate)
if (taskName === 'export' && process.env.ASSET_SYSTEMS && !extra.some((a) => a.startsWith('--systems'))) {
  extra = ['--systems', process.env.ASSET_SYSTEMS, ...extra];
}
if (!task) {
  console.error(
    `Usage: node pipeline/blender/run.mjs <${Object.keys(TASKS).join('|')}> [-- extra args…]\n` +
      `       node pipeline/blender/run.mjs script <file.py> [extra args…]`,
  );
  process.exit(2);
}
loadEnv();
const blender = findBlender();
const blend = findBlend();
const out = join(root, task.out);
mkdirSync(out, { recursive: true });
console.log(`Blender: ${blender}\nFile:    ${blend}\nScript:  ${task.script}\nOut:     ${out}`);

// -b: background, -Y: never auto-run the Python script embedded in the .blend.
const r = spawnSync(
  blender,
  [
    '-b',
    '-Y',
    blend,
    '--python-exit-code',
    '1',
    '--python',
    resolve(root, task.script),
    '--',
    '--out',
    out,
    ...extra,
  ],
  { stdio: 'inherit' },
);
if (r.status !== 0) {
  console.error(`Blender exited with status ${r.status}${r.signal ? ` (signal ${r.signal})` : ''}`);
  process.exit(r.status || 1);
}
