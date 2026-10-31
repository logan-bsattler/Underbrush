import { describe, expect, it } from 'vitest';
import {
  afterwordPages,
  belowNotes,
  content,
  emptyJournal,
  mergeDiscoveries,
  newGame,
  normalizeJournal,
  pairings,
  passItOn,
  perksFor,
  type Journal,
  type YearRecord,
} from '../src/core';

const pages = content.cache.afterword.pages;
/** A family that found the cellar in its second generation and is now working the homestead in `generation`. */
const found = (generation: number, extra: Partial<Journal> = {}): Journal => ({
  ...emptyJournal(),
  cacheFound: true,
  cacheGeneration: 2,
  generation,
  ...extra,
});

describe("the founder's journal", () => {
  it('stays shut until the cellar is found', () => {
    const j = { ...emptyJournal(), generation: 4, artifacts: ['droverspenny'] };
    expect(afterwordPages(j)).toEqual([]);
  });

  it('reads one page in the generation that finds it and one more each generation after, up to the last', () => {
    expect(afterwordPages(found(2))).toEqual(pages.slice(0, 1));
    expect(afterwordPages(found(5))).toEqual(pages.slice(0, 4));
    expect(afterwordPages(found(8))).toEqual(pages);
    expect(afterwordPages(found(20))).toEqual(pages);
  });

  it('remembers the generation that found the cellar, once, and keeps it down the generations', () => {
    const s = newGame({ seed: 'afterword', perks: perksFor({ ...emptyJournal(), generation: 3 }, []) });
    s.cacheFound = true;
    const { journal } = mergeDiscoveries({ ...emptyJournal(), generation: 3 }, s);
    expect(journal.cacheGeneration).toBe(3);
    // A later year of a later generation doesn't move it.
    const later = newGame({ seed: 'afterword-2', perks: perksFor({ ...journal, generation: 4 }, []) });
    later.cacheFound = true;
    expect(mergeDiscoveries({ ...journal, generation: 4 }, later).journal.cacheGeneration).toBe(3);
    expect(passItOn({ ...journal, renown: 1e6 }).cacheGeneration).toBe(3);
  });

  it('works out the finding generation for cellars found before the journal kept it', () => {
    const year = (generation: number, cache: number) =>
      ({ seed: `y${generation}`, mode: 'story', breakdown: { cache }, generation }) as unknown as YearRecord;
    const old = { ...emptyJournal(), cacheFound: true, generation: 4, years: [year(2, 0), year(3, 10), year(4, 0)] };
    delete (old as Partial<Journal>).cacheGeneration;
    expect(normalizeJournal(old).cacheGeneration).toBe(3);
    // No year records it: count from the generation working the homestead now.
    expect(normalizeJournal({ ...old, years: [] }).cacheGeneration).toBe(4);
    // Never found: nothing to fill in.
    expect(normalizeJournal({ ...emptyJournal() }).cacheGeneration).toBeUndefined();
  });

  it("notes every zone's deepest layer, with the hazards its deck really holds", () => {
    const notes = belowNotes(found(2, { artifacts: ['doorkey'] }));
    expect(notes).toHaveLength(content.zones.length);
    for (const n of notes) {
      const layer = content.underground[n.zone][n.depth - 1];
      expect(n.depth).toBe(content.underground[n.zone].length);
      expect(n.artifact).toBe(layer.artifact);
      const hazards = layer.deck.filter((e) => e.card.type === 'hazard').reduce((sum, e) => sum + e.copies, 0);
      expect(n.hazards.reduce((sum, h) => sum + h.count, 0)).toBe(hazards);
      expect(n.found).toBe(n.artifact === 'doorkey');
    }
    expect(notes.find((n) => n.zone === 'burnscar')!.hazards).toEqual([
      { name: 'Smoke Pocket', count: 4 },
      { name: 'Crumbling Brick', count: 3 },
    ]);
  });

  it('names the parents of hybrids not yet made, once the homestead can cross them', () => {
    const level1 = pairings(found(2, { hybrids: ['shaggyoyster'] }));
    const ids = level1.map((p) => p.hybrid);
    expect(ids).not.toContain('shaggyoyster');
    expect(ids).toContain('lacquercap');
    // Snow Comb and Claret Shelf wait for levels 8 and 9.
    expect(ids).not.toContain('snowcomb');
    expect(ids).not.toContain('claretshelf');
    expect(level1.find((p) => p.hybrid === 'lacquercap')!.parents).toEqual(content.species.lacquercap.parents);
    const legend = pairings(found(2, { renown: 1e6 })).map((p) => p.hybrid);
    expect(legend).toContain('snowcomb');
    expect(legend).toContain('claretshelf');
  });
});
