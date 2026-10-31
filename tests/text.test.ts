import { describe, expect, it } from 'vitest';
import { content, newGame, standardPerks } from '../src/core';
import { artifactText, bustText, digText, eventText, fallText, outcomeText } from '../src/ui/text';

describe('fall and bust text', () => {
  it('names a fall before descending', () => {
    expect(fallText(1)).toBe('A fall here: 1 action next month');
    expect(fallText(2)).toBe('A fall here: 2 actions next month');
    expect(fallText('month')).toBe('A fall here: next month out recovering');
    expect(fallText(0)).toMatch(/nothing more/);
  });

  it('says how many finds a bust keeps, and what a fall costs', () => {
    expect(bustText(2, 1)).toBe('Bust! You scramble home with only your first 2 finds.');
    expect(bustText(3, 2)).toMatch(/first 3 finds/);
    expect(bustText(1, 1)).toMatch(/first 1 find\./);
    expect(bustText(2, 1, 1)).toMatch(/next month you'll be 1 action short/);
    expect(bustText(2, 1, 'month')).toMatch(/next month out recovering/);
    expect(outcomeText('bust', { type: 'hazard', name: 'Ticks' } as any)).toBe(bustText(content.rules.bustKeep, 1));
  });

  it("doesn't claim finds a bust had nothing to drop from", () => {
    expect(bustText(0, 0)).toBe('Bust! You scramble home empty-handed.');
    expect(bustText(1, 0)).toBe('Bust! You scramble home with your one find.');
    expect(bustText(2, 0)).toBe('Bust! You scramble home with both your finds.');
    expect(bustText(3, 0)).toBe('Bust! You scramble home with all 3 of your finds.');
    expect(bustText(0, 0, 1)).toMatch(/^Bust! You scramble home empty-handed\. You took a fall/);
  });

  it('tells the night of a fall', () => {
    const grid: { species: string | null }[] = [];
    const short = eventText({ type: 'recovering', zone: 'mixedwoods', layer: 1, actions: 1 }, grid);
    expect(short).toMatch(/1 action fewer this month/);
    expect(short).toContain(`the ${content.underground.mixedwoods[0].name.replace(/^The /, '')}`);
    expect(eventText({ type: 'recovering', zone: 'mixedwoods', layer: 2, actions: 2 }, grid)).toMatch(/2 actions fewer/);
    expect(eventText({ type: 'recovering', zone: 'mixedwoods', layer: 3, actions: 'month' }, grid)).toMatch(/out recovering/);
    expect(eventText({ type: 'recovering', zone: 'mixedwoods', layer: 3, actions: 'month' }, grid, { finale: true })).toMatch(/no last harvest/);
    // Never "the The …".
    for (const [zone, layers] of Object.entries(content.underground))
      layers.forEach((_, d) => expect(eventText({ type: 'recovering', zone, layer: d + 1, actions: 1 }, grid)).not.toMatch(/the The /));
  });
});

describe('night report', () => {
  it("skips the fruiting line for a bed the apprentice already picked", () => {
    const grid = [{ species: 'oyster' }, { species: 'shiitake' }];
    expect(eventText({ type: 'grow', square: 0, from: 'P', to: 'F' } as any, grid)).toMatch(/Oyster is fruiting/);
    expect(eventText({ type: 'grow', square: 0, from: 'P', to: 'F' } as any, grid, { picked: [0] })).toBeNull();
    expect(eventText({ type: 'grow', square: 1, from: 'P', to: 'F' } as any, grid, { picked: [0] })).toMatch(/Shiitake is fruiting/);
  });
});

describe('dig text', () => {
  it('a missed truffle dig is its own line, apart from the founder’s riddle', () => {
    const miss = digText('empty', { host: true, inSeason: true, cellarReady: false });
    expect(miss).toMatch(/^Nothing under this one/);
    // Even with the marks complete, a miss under a truffle tree in season is just a miss.
    expect(digText('empty', { host: true, inSeason: true, cellarReady: true })).toBe(miss);
    expect(digText('empty', { host: false, inSeason: true, cellarReady: true })).toBe(content.cache.wrong);
    expect(digText('empty', { host: false, inSeason: true, cellarReady: false })).toMatch(/grow under oak and hazel/);
    expect(digText('empty', { host: true, inSeason: false, cellarReady: false })).toMatch(/only come up in winter/);
    expect(digText('empty', { host: true, inSeason: false, cellarReady: false })).not.toMatch(/^Nothing under this one/);
  });
});

describe('artifact text', () => {
  it('says when a piece is already in the cabinet, and what it is worth then', () => {
    const g = newGame({ mode: 'story', seed: 'artifact-text', perks: { ...standardPerks(), generation: 2 } });
    const a = content.artifacts.find((x) => x.points === 3)!;
    expect(artifactText(g, a.id)).toMatch(/Worth 3 points/);
    expect(artifactText(g, a.id)).toMatch(/1 of 3 for the /);
    g.perks.clues = [a.id];
    expect(artifactText(g, a.id)).toMatch(/Already in the cabinet: worth 2 points this year, not 3/);
  });

  it('shows set progress the moment a piece is found', () => {
    const g = newGame({ mode: 'story', seed: 'artifact-text', perks: { ...standardPerks(), generation: 2 } });
    const set = content.artifacts.filter((x) => x.set === 'purse');
    g.perks.clues = [set[0].id];
    g.artifacts = [set[1].id];
    expect(artifactText(g, set[2].id)).toMatch(/completes the Drover's Purse/);
  });
});

describe('hybrid riddles', () => {
  const hybrids = content.speciesOrder.map((id) => content.species[id]).filter((sp) => sp.kind === 'hybrid');

  it('gives every hybrid a riddle that names neither parent', () => {
    expect(hybrids.length).toBeGreaterThan(0);
    for (const sp of hybrids) {
      expect(sp.hint, sp.id).toBeTruthy();
      for (const p of sp.parents!) expect(sp.hint!.toLowerCase(), `${sp.id} names ${p}`).not.toContain(content.species[p].name.toLowerCase());
    }
  });

  it("uses each parent's journal look", () => {
    for (const sp of hybrids)
      for (const p of sp.parents!) expect(sp.hint!.toLowerCase(), `${sp.id} hints at ${p}`).toContain(content.species[p].group!.toLowerCase());
  });
});
