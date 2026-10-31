import { describe, expect, it } from 'vitest';
import { records, type YearRecord } from '../src/core';

const year = (seed: string, score: number, mode: YearRecord['mode'] = 'story'): YearRecord => ({
  finished: '2026-10-30T12:00:00.000Z',
  mode,
  seed,
  score,
  tier: null,
  renown: score,
  levelFrom: 1,
  levelTo: 1,
  masteryUps: [],
});
const seeds = (s: Set<YearRecord>) => [...s].map((y) => y.seed).sort();

describe('personal bests', () => {
  it('marks each year that beat every earlier one, and the one still standing', () => {
    const r = records([year('a', 20), year('b', 15), year('c', 30), year('d', 25), year('e', 40)]);
    expect(seeds(r.set)).toEqual(['a', 'c', 'e']);
    expect(seeds(r.best)).toEqual(['e']);
    expect(seeds(r.beaten)).toEqual(['c', 'e']);
  });

  it("doesn't count a tie: the first year to reach a score holds it", () => {
    const r = records([year('a', 30), year('b', 30)]);
    expect(seeds(r.set)).toEqual(['a']);
    expect(seeds(r.best)).toEqual(['a']);
    expect(r.beaten.size).toBe(0);
  });

  it('keeps story and daily years apart', () => {
    const r = records([year('a', 50), year('daily-2026-10-29', 20, 'daily'), year('daily-2026-10-30', 25, 'daily'), year('b', 40)]);
    expect(seeds(r.set)).toEqual(['a', 'daily-2026-10-29', 'daily-2026-10-30']);
    expect(seeds(r.best)).toEqual(['a', 'daily-2026-10-30']);
    expect(seeds(r.beaten)).toEqual(['daily-2026-10-30']);
  });

  it('has nothing to mark before the first festival', () => {
    const r = records([]);
    expect(r.set.size + r.best.size + r.beaten.size).toBe(0);
  });
});
