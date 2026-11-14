#!/usr/bin/env node
// Fetches what the static structure pages add on top of the Z-Anatomy data, into data/wikidata/wikidata.json
// (committed, so `npm run build` stays offline and reproducible):
//   - supply and function from Wikidata (CC0): nerve supply (P3189), arterial supply (P2286), venous drainage
//     (P2289), lymphatic drainage (P2288), muscle action (P3310), with English and German labels;
//   - the German Wikipedia introduction (CC BY-SA 4.0) of the article the English description comes from, or of
//     the structure's own Wikidata item.
//
//   node seo/wikidata.ts
//
// Pages are matched to Wikidata items by TA2 ID (P7173, exact) and else by the English Wikipedia article of their
// description (see seo/model.ts, wikidataOf). Needs the assets (npm run assets:build) and network access; takes
// about two minutes. Rerun it after the assets change or to pick up Wikidata and Wikipedia edits.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enwikiTitle, loadSiteData, RELATION_PROPS, type RelationKind, type WikidataFile } from './model.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'wikidata', 'wikidata.json');
const UA = 'anatomy-atlas-data-fetch/1.0 (static site build script)';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const SPARQL = 'https://query.wikidata.org/sparql';
const ENWIKI_API = 'https://en.wikipedia.org/w/api.php';
const DEWIKI_API = 'https://de.wikipedia.org/w/api.php';
/** Shorter German introductions are stubs ("Der X ist ein Muskel.") that say less than the facts box. */
const MIN_TEXT = 80;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** JSON from a Wikimedia endpoint; retries on errors, timeouts and "maxlag" (servers busy), honouring Retry-After. */
async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let problem: string;
    let wait = 2 ** attempt;
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': UA, ...init.headers },
        signal: AbortSignal.timeout(60_000),
      });
      const retry = Number(res.headers.get('retry-after'));
      if (Number.isFinite(retry) && retry > 0) wait = retry;
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.includes('json')) {
        const body = (await res.json()) as { error?: { code?: string; info?: string } };
        if (!body.error) return body;
        if (body.error.code !== 'maxlag') throw new Error(`${body.error.code}: ${body.error.info}`);
        problem = 'maxlag';
      } else problem = `${res.status} ${res.statusText}`;
    } catch (e) {
      if (!(e instanceof Error) || !/abort|timeout|fetch failed|network/i.test(`${e.name} ${e.message}`))
        throw e;
      problem = e.message;
    }
    if (attempt >= 6) throw new Error(`${problem} for ${url.slice(0, 120)}`);
    console.log(`  ${problem}, retrying in ${wait}s`);
    await sleep(wait * 1000);
  }
}

/**
 * MediaWiki action API call, one at a time with a pause (Wikimedia rate-limits anonymous scripts); `maxlag` makes
 * the servers ask us to wait instead of slowing down for others.
 */
async function api(base: string, params: Record<string, string>): Promise<unknown> {
  await sleep(500);
  const q = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  return getJson(`${base}?${q}`);
}

const chunks = <T>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

async function main() {
  const data = loadSiteData(join(ROOT, 'public', 'models'));
  if (!data) throw new Error('public/models/manifest.json not found: run npm run assets:build first');

  // 1. what we look up: TA2 IDs of the structures, English articles of the descriptions
  const ourTa2 = new Set(data.structures.flatMap((s) => (s.taId ? [s.taId] : [])));
  const titles = [...new Set(Object.values(data.definitions).flatMap((d) => enwikiTitle(d.sourceUrl) ?? []))];
  console.log(`${ourTa2.size} TA2 IDs, ${titles.length} English Wikipedia articles`);

  // 2. TA2 ID → item (one query for all items with a TA2 ID); IDs held by several items are left out
  const sparql = (await getJson(SPARQL, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ query: 'SELECT ?item ?ta2 WHERE { ?item wdt:P7173 ?ta2 . }' }),
  })) as { results: { bindings: { item: { value: string }; ta2: { value: string } }[] } };
  const itemsOfTa2 = new Map<string, Set<string>>();
  for (const b of sparql.results.bindings) {
    const ta2 = b.ta2.value;
    if (!ourTa2.has(ta2)) continue;
    itemsOfTa2.set(ta2, (itemsOfTa2.get(ta2) ?? new Set()).add(b.item.value.replace(/^.*\//, '')));
  }
  const byTa2: Record<string, string> = {};
  for (const [ta2, items] of [...itemsOfTa2].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })))
    if (items.size === 1) byTa2[ta2] = [...items][0]!;
  console.log(
    `TA2: ${Object.keys(byTa2).length} matched, ${itemsOfTa2.size - Object.keys(byTa2).length} ambiguous`,
  );

  // 3. English article → item (following redirects)
  const byEnwiki: Record<string, string> = {};
  for (const batch of chunks(titles, 50)) {
    const r = (await api(ENWIKI_API, {
      action: 'query',
      prop: 'pageprops',
      ppprop: 'wikibase_item',
      redirects: '1',
      titles: batch.join('|'),
    })) as {
      query: {
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
        pages: { title: string; pageprops?: { wikibase_item?: string } }[];
      };
    };
    const itemOf = new Map(
      r.query.pages.flatMap((p) =>
        p.pageprops?.wikibase_item ? [[p.title, p.pageprops.wikibase_item]] : [],
      ),
    );
    const norm = new Map((r.query.normalized ?? []).map((n) => [n.from, n.to]));
    const redir = new Map((r.query.redirects ?? []).map((n) => [n.from, n.to]));
    for (const t of batch) {
      const n = norm.get(t) ?? t;
      const item = itemOf.get(redir.get(n) ?? n);
      if (item) byEnwiki[t] = item;
    }
  }
  console.log(`English articles: ${Object.keys(byEnwiki).length} of ${titles.length} matched`);

  // 4. the items: German article and supply/function statements
  const qids = [...new Set([...Object.values(byTa2), ...Object.values(byEnwiki)])].sort();
  const items: WikidataFile['items'] = {};
  const targets = new Set<string>();
  for (const batch of chunks(qids, 50)) {
    const r = (await api(WIKIDATA_API, {
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'claims|sitelinks',
      sitefilter: 'dewiki',
    })) as { entities: Record<string, WdEntity> };
    for (const [qid, e] of Object.entries(r.entities)) {
      const entry: WikidataFile['items'][string] = {};
      const de = e.sitelinks?.dewiki?.title;
      if (de) entry.dewiki = de;
      const relations: Partial<Record<RelationKind, string[]>> = {};
      for (const [kind, prop] of Object.entries(RELATION_PROPS) as [RelationKind, string][]) {
        const values = statementValues(e.claims?.[prop] ?? []);
        if (values.length) {
          relations[kind] = values;
          values.forEach((v) => targets.add(v));
        }
      }
      if (Object.keys(relations).length) entry.relations = relations;
      if (entry.dewiki || entry.relations) items[qid] = entry;
    }
  }
  const withRel = Object.values(items).filter((i) => i.relations).length;
  console.log(
    `items: ${qids.length} fetched, ${withRel} with supply/function, ${targets.size} distinct targets`,
  );

  // 5. labels of the targets (nerves, arteries, veins, lymph nodes, actions)
  const labels: WikidataFile['labels'] = {};
  for (const batch of chunks([...targets].sort(), 50)) {
    const r = (await api(WIKIDATA_API, {
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'labels',
      languages: 'en|de',
    })) as { entities: Record<string, { labels?: Record<string, { value: string }> }> };
    for (const [qid, e] of Object.entries(r.entities)) {
      const en = e.labels?.en?.value;
      const de = e.labels?.de?.value;
      if (en || de) labels[qid] = { ...(en ? { en } : {}), ...(de ? { de } : {}) };
    }
  }

  // 6. German introductions (plain text; at most 20 per request with exintro)
  const deTitles = [...new Set(Object.values(items).flatMap((i) => i.dewiki ?? []))].sort();
  const dewiki: WikidataFile['dewiki'] = {};
  for (const batch of chunks(deTitles, 20)) {
    const r = (await api(DEWIKI_API, {
      action: 'query',
      prop: 'extracts|info|pageprops',
      exintro: '1',
      explaintext: '1',
      exsectionformat: 'plain',
      inprop: 'url',
      ppprop: 'disambiguation',
      redirects: '1',
      titles: batch.join('|'),
    })) as {
      query: {
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
        pages: {
          title: string;
          missing?: boolean;
          extract?: string;
          canonicalurl?: string;
          pageprops?: object;
        }[];
      };
    };
    const pageOf = new Map(r.query.pages.map((p) => [p.title, p]));
    const norm = new Map((r.query.normalized ?? []).map((n) => [n.from, n.to]));
    const redir = new Map((r.query.redirects ?? []).map((n) => [n.from, n.to]));
    for (const t of batch) {
      const n = norm.get(t) ?? t;
      const p = pageOf.get(redir.get(n) ?? n);
      if (!p || p.missing || p.pageprops || !p.canonicalurl) continue;
      const text = cleanExtract(p.extract ?? '');
      if (text.length >= MIN_TEXT) dewiki[t] = { text, url: p.canonicalurl };
    }
  }
  console.log(`German introductions: ${Object.keys(dewiki).length} of ${deTitles.length} articles`);

  const out: WikidataFile = {
    schemaVersion: 1,
    fetchedAt: new Date().toISOString(),
    byTa2,
    byEnwiki: Object.fromEntries(Object.entries(byEnwiki).sort(([a], [b]) => a.localeCompare(b, 'en'))),
    items: Object.fromEntries(
      Object.entries(items).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
    ),
    labels: Object.fromEntries(
      Object.entries(labels).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
    ),
    dewiki: Object.fromEntries(Object.entries(dewiki).sort(([a], [b]) => a.localeCompare(b, 'de'))),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`wrote ${OUT}`);
}

interface WdStatement {
  rank: 'preferred' | 'normal' | 'deprecated';
  mainsnak: { snaktype: string; datavalue?: { value?: { id?: string } } };
}
interface WdEntity {
  missing?: string;
  claims?: Record<string, WdStatement[]>;
  sitelinks?: Record<string, { title: string }>;
}

/** Item values of a property: the preferred statements if any, else the normal ones; never deprecated ones. */
function statementValues(statements: WdStatement[]): string[] {
  const usable = statements.filter((s) => s.rank !== 'deprecated' && s.mainsnak.snaktype === 'value');
  const preferred = usable.filter((s) => s.rank === 'preferred');
  return [
    ...new Set((preferred.length ? preferred : usable).flatMap((s) => s.mainsnak.datavalue?.value?.id ?? [])),
  ];
}

/**
 * TextExtracts plain text → the paragraph format of the Z-Anatomy descriptions (blank line between paragraphs),
 * without the empty brackets left where pronunciations and references were.
 */
export function cleanExtract(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\(\s*[,;]?\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
