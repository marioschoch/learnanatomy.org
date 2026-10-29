// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { withReview } from '../review-definition.mjs';
import { applyReviews, definitionHash } from './reviews.mjs';

const def = (en) => ({ text: { en }, source: 'Wikipedia', license: 'CC-BY-SA-3.0', reviewed: false });

describe('definition reviews', () => {
  it('hashes the text in every language, independent of key order', () => {
    const a = { text: { en: 'Thigh bone.', de: 'Oberschenkelknochen.' } };
    const b = { text: { de: 'Oberschenkelknochen.', en: 'Thigh bone.' } };
    expect(definitionHash(a)).toBe(definitionHash(b));
    expect(definitionHash(a)).not.toBe(definitionHash({ text: { en: 'Thigh bone.' } }));
    expect(definitionHash(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('marks a definition reviewed only while its text matches the review', () => {
    const defs = { skeletal: { femur: def('Thigh bone.'), tibia: def('Shin bone.') } };
    let file = withReview({ reviews: {} }, 'skeletal/femur', defs.skeletal.femur, {
      reviewer: 'A. Reviewer',
      date: '2026-11-01',
    });
    file = withReview(file, 'skeletal/tibia', def('Old text.'), { reviewer: 'B', date: '2026-11-01' });
    file.reviews['skeletal/gone'] = { sha256: 'x', reviewer: 'C', date: '2026-11-01' };
    file.reviews['muscular/other'] = { sha256: 'x', reviewer: 'C', date: '2026-11-01' };

    const r = applyReviews(defs, file);
    expect(defs.skeletal.femur.reviewed).toBe(true);
    expect(defs.skeletal.tibia.reviewed).toBe(false);
    expect(r.applied).toEqual(['skeletal/femur']);
    expect(r.stale.map((s) => s.key)).toEqual(['skeletal/tibia']);
    // only for built systems
    expect(r.orphan).toEqual(['skeletal/gone']);
  });

  it('keeps review keys sorted and stores reviewer, date and optional note', () => {
    let file = withReview({ $comment: 'c', reviews: {} }, 'visceral/liver', def('Liver.'), {
      reviewer: 'R',
      date: '2026-11-02',
      note: 'checked against Gray',
    });
    file = withReview(file, 'skeletal/femur', def('Thigh bone.'), { reviewer: 'R', date: '2026-11-02' });
    expect(Object.keys(file.reviews)).toEqual(['skeletal/femur', 'visceral/liver']);
    expect(file.reviews['visceral/liver']).toMatchObject({ reviewer: 'R', note: 'checked against Gray' });
    expect(file.$comment).toBe('c');
  });
});
