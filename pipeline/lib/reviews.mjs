// Human reviews of definitions (pipeline/config/definition-reviews.json, CONTRIBUTING.md).
//
// A review is keyed by `<system>/<definitionKey>` and stores the sha256 of the text the reviewer read. The
// manifest step publishes `reviewed: true` only while the current text still has that hash, so a changed upstream
// text falls back to "not reviewed" until someone checks it again. Pure functions; file access stays in callers.
import { createHash } from 'node:crypto';

/** sha256 over the definition's text in every language (sorted by language code). */
export function definitionHash(def) {
  const text = def?.text ?? {};
  const canonical = Object.keys(text)
    .sort()
    .map((lang) => `${lang}\n${text[lang]}`)
    .join('\n\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Sets `reviewed` on every definition of the built systems.
 * @param {Record<string, Record<string, object>>} definitionsBySystem  system → key → definition (mutated)
 * @param {object} reviewsFile  parsed definition-reviews.json ({ reviews: { 'system/key': { sha256, … } } })
 * @returns {{ applied: string[], stale: {key: string, reviewer: string, date: string}[], orphan: string[] }}
 *   stale  = review exists but the text changed (published as not reviewed)
 *   orphan = review for a definition that no longer exists in a built system
 */
export function applyReviews(definitionsBySystem, reviewsFile) {
  const reviews = reviewsFile?.reviews ?? {};
  const out = { applied: [], stale: [], orphan: [] };
  for (const [sid, defs] of Object.entries(definitionsBySystem)) {
    for (const [key, def] of Object.entries(defs)) {
      const r = reviews[`${sid}/${key}`];
      const ok = Boolean(r) && r.sha256 === definitionHash(def);
      def.reviewed = ok;
      if (ok) out.applied.push(`${sid}/${key}`);
      else if (r) out.stale.push({ key: `${sid}/${key}`, reviewer: r.reviewer, date: r.date });
    }
  }
  for (const k of Object.keys(reviews)) {
    const [sid, key] = k.split('/');
    if (definitionsBySystem[sid] && !definitionsBySystem[sid][key]) out.orphan.push(k);
  }
  return out;
}
