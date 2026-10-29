#!/usr/bin/env node
// Record a human review of a definition (CONTRIBUTING.md).
//
//   npm run review:definition -- <system>/<definitionKey> --reviewer "Name" [--note "…"]
//   npm run review:definition -- --status        reviewed / stale / unreviewed counts per system
//   npm run review:definition -- --find femur    definition keys of structures whose name contains "femur"
//
// Reads the built text from public/models/definitions/<system>.json (what users see), prints it, and stores its
// hash in pipeline/config/definition-reviews.json. `npm run assets:manifest` then publishes it as reviewed.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, PATHS, readJson, writeJsonAtomic } from './lib/io.mjs';
import { definitionHash } from './lib/reviews.mjs';

const USAGE =
  'usage: npm run review:definition -- <system>/<definitionKey> --reviewer "Name" [--note "…"]\n' +
  '       npm run review:definition -- --status\n' +
  '       npm run review:definition -- --find <name>';

const option = (argv, name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};

function loadReviews() {
  return existsSync(PATHS.definitionReviews) ? readJson(PATHS.definitionReviews) : { reviews: {} };
}

function loadDefinitions(system) {
  const p = join(PATHS.models, 'definitions', `${system}.json`);
  if (!existsSync(p)) throw new Error(`${p} not found — build the assets first (npm run assets:build).`);
  return readJson(p).definitions;
}

/** Returns a new reviews file with the review of `key` added or replaced (keys sorted). */
export function withReview(file, key, def, { reviewer, date, note }) {
  const entry = { sha256: definitionHash(def), reviewer, date };
  if (note) entry.note = note;
  const reviews = { ...(file.reviews ?? {}), [key]: entry };
  return {
    ...file,
    reviews: Object.fromEntries(Object.entries(reviews).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}

function status() {
  const { reviews = {} } = loadReviews();
  const manifest = readJson(join(PATHS.models, 'manifest.json'));
  for (const sys of manifest.systems) {
    const defs = loadDefinitions(sys.id);
    let ok = 0;
    const stale = [];
    for (const [k, d] of Object.entries(defs)) {
      const r = reviews[`${sys.id}/${k}`];
      if (r && r.sha256 === definitionHash(d)) ok++;
      else if (r) stale.push(k);
    }
    const total = Object.keys(defs).length;
    console.log(
      `${sys.id.padEnd(16)} ${String(ok).padStart(5)} reviewed  ${String(stale.length).padStart(3)} stale  ` +
        `${String(total - ok - stale.length).padStart(5)} not reviewed${stale.length ? `  (stale: ${stale.join(', ')})` : ''}`,
    );
  }
}

function find(query) {
  const q = query.toLowerCase();
  const { reviews = {} } = loadReviews();
  const manifest = readJson(join(PATHS.models, 'manifest.json'));
  const seen = new Set();
  for (const sys of manifest.systems) {
    const data = readJson(join(PATHS.models, sys.structuresFile));
    const defs = loadDefinitions(sys.id);
    for (const n of [...data.structures, ...data.groups, ...data.landmarks]) {
      const key = n.definitionKey && `${sys.id}/${n.definitionKey}`;
      if (!key || seen.has(key) || !defs[n.definitionKey]) continue;
      if (!Object.values(n.names).some((v) => v?.toLowerCase().includes(q))) continue;
      seen.add(key);
      const r = reviews[key];
      const state = !r
        ? 'not reviewed'
        : r.sha256 === definitionHash(defs[n.definitionKey])
          ? 'reviewed'
          : 'stale';
      console.log(`${key.padEnd(56)} ${state.padEnd(13)} ${n.names.la ?? ''} / ${n.names.en}`);
    }
  }
  if (!seen.size) console.log(`No definition found for "${query}".`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--status')) return status();
  if (argv.includes('--find')) {
    const q = option(argv, '--find');
    if (!q) throw new Error(USAGE);
    return find(q);
  }
  const key = argv[0] && !argv[0].startsWith('--') ? argv[0] : undefined;
  const reviewer = option(argv, '--reviewer');
  if (!key || !/^[a-z-]+\/[a-z0-9-]+$/.test(key) || !reviewer) {
    console.error(USAGE);
    process.exit(1);
  }
  const [system, defKey] = key.split('/');
  const def = loadDefinitions(system)[defKey];
  if (!def) throw new Error(`No definition "${defKey}" in system "${system}".`);
  const date = new Date().toISOString().slice(0, 10);
  const next = withReview(loadReviews(), key, def, { reviewer, date, note: option(argv, '--note') });
  writeJsonAtomic(PATHS.definitionReviews, next, true);
  console.log(`Reviewed text of ${key} (${def.source}${def.sourceUrl ? `, ${def.sourceUrl}` : ''}):\n`);
  for (const [lang, text] of Object.entries(def.text)) console.log(`[${lang}] ${text}\n`);
  console.log(`Recorded: ${reviewer}, ${date}, sha256 ${next.reviews[key].sha256.slice(0, 12)}…`);
  console.log(
    'Run `npm run assets:manifest` to publish it, then commit pipeline/config/definition-reviews.json.',
  );
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
