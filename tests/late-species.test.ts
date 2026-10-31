import { describe, expect, it } from 'vitest';
import {
  content,
  dispatch,
  migrateState,
  newGame,
  perksFor,
  spawnStock,
  standardPerks,
  type Action,
  type Content,
  type GameState,
} from '../src/core';
import { runGrowth, stageLength } from '../src/core/growth';
import { Rng } from '../src/core/rng';
import { emptyJournal } from '../src/core/journal';

const run = (s: GameState, ...actions: Action[]) => {
  for (const a of actions) s = dispatch(s, a).state;
  return s;
};

/** Perks at a level, with King Oyster already in the field journal. */
const at = (level: number) => perksFor({ ...emptyJournal(), renown: content.progression.levels[level - 1].renown, discovered: ['kingoyster'] }, []);

/** A year at a level with clear weather and an empty farm. */
function year(level: number, seed = 'king'): GameState {
  const s = newGame({ seed, perks: at(level) });
  s.weather = 'clear';
  for (const sq of s.grid) if (!sq.tree) Object.assign(sq, { substrate: null, species: null, stage: null, hold: 0, dry: 0, blight: false });
  return s;
}

function bed(s: GameState, i: number, species: string, stage: 'S' | 'C' | 'P' | 'F', substrate = content.species[species].substrates[0]) {
  Object.assign(s.grid[i], { substrate, species, stage, hold: 0, dry: 0, blight: false });
}

/** Two free squares side by side in a row, for a pair of beds. */
function spot(s: GameState): [number, number] {
  const i = s.grid.findIndex((q, i) => (i + 1) % s.size !== 0 && !q.tree && !s.grid[i + 1].tree);
  return [i, i + 1];
}

const meadow = (s: GameState) => [...s.decks.meadow.draw, ...s.decks.meadow.discard];
const kings = (s: GameState) => meadow(s).filter((c) => c.type === 'specimen' && c.species === 'kingoyster').length;
const dealable = (s: GameState) => [...s.orders.visible, ...s.orders.deck].includes('o-king2');

describe('King Oyster', () => {
  it('stays out of the Meadow, the market and the orders below level 7', () => {
    for (const level of [1, 6]) {
      const s = year(level);
      expect(s.perks.species).toEqual([]);
      expect(kings(s)).toBe(0);
      expect(meadow(s).some((c) => c.type === 'ground' && c.name === 'Sea Holly')).toBe(false);
      // In the field journal, but the spawn waits for the level.
      expect(s.perks.spawn).toContain('kingoyster');
      expect(spawnStock(s)).not.toContain('kingoyster');
      expect(dealable(s)).toBe(false);
    }
    expect(standardPerks().species).toEqual([]);
  });

  it('comes up in the Meadow, at the market and in the orders from level 7', () => {
    const s = year(7);
    expect(s.perks.species).toEqual(['kingoyster']);
    expect(kings(s)).toBe(2);
    expect(meadow(s)).toHaveLength(content.zones[0].deck.reduce((n, e) => n + e.copies, 0));
    expect(spawnStock(s)).toContain('kingoyster');
    expect(dealable(s)).toBe(true);
  });

  it('deals a level 1 year exactly as before it was added', () => {
    const without: Content = { ...content, zones: content.zones.map((z) => ({ ...z, deck: z.deck.filter((e) => !e.unlock) })) };
    for (const seed of ['a', 'b', 'daily'])
      expect(newGame({ seed, perks: standardPerks() })).toEqual(newGame({ seed, perks: standardPerks(without) }, without));
  });

  it('keeps a save from before it locked, and its deck as dealt', () => {
    const old = year(7);
    delete (old.perks as Partial<typeof old.perks>).species;
    const draw = old.decks.meadow.draw.slice();
    const s = migrateState(old);
    expect(s.perks.species).toEqual([]);
    expect(spawnStock(s)).not.toContain('kingoyster');
    // The Meadow was dealt at its level 7 size; the lock reprints it without King Oyster.
    expect(s.decks.meadow.draw).not.toEqual(draw);
    expect(kings(s)).toBe(0);
  });
});

describe('the heavy trait', () => {
  it('brings in two a harvest by hand', () => {
    let s = year(7);
    s.round = 2;
    const [a, b] = spot(s);
    bed(s, a, 'kingoyster', 'F');
    bed(s, b, 'oyster', 'F');
    const r = dispatch(s, { type: 'harvest' });
    expect(r.result).toMatchObject({ kind: 'harvest', gained: { kingoyster: 2, oyster: 1 } });
    s = r.state;
    expect(s.storage).toMatchObject({ kingoyster: 2, oyster: 1 });
    expect(s.grid[a].stage).toBe('C');
  });

  it('brings in two a harvest by the apprentice', () => {
    const s = year(9);
    s.round = 1;
    s.watered = true;
    s.perks.autoHarvest = true;
    // Pinning tonight: the bed fruits overnight and the apprentice picks it at first light.
    bed(s, spot(s)[0], 'kingoyster', 'P');
    s.grid[spot(s)[0]].hold = stageLength('P', 'medium') - 1;
    const after = run(s, { type: 'endMonth' });
    expect(after.storage.kingoyster).toBe(2);
    expect(after.night!.events).toContainEqual(expect.objectContaining({ type: 'autoHarvest', gained: { kingoyster: 2 } }));
  });

  it('fills a "2 King Oyster" order from one bed', () => {
    let s = year(7);
    s.round = 2;
    s.orders = { visible: ['o-king2'], deck: [], filled: [] };
    bed(s, spot(s)[0], 'kingoyster', 'F');
    s = run(s, { type: 'harvest' }, { type: 'fillOrder', order: 'o-king2' });
    expect(s.orders.filled).toContain('o-king2');
  });
});

describe('Crackle Crown', () => {
  const pair = (level: number) => {
    const s = year(level);
    s.round = 2;
    s.watered = true;
    const [a, b] = spot(s);
    bed(s, a, 'kingoyster', 'C');
    bed(s, b, 'shiitake', 'C');
    runGrowth(s, new Rng(1), content);
    return { s, a, b };
  };

  it('crosses from King Oyster and Shiitake at level 7, not before', () => {
    expect(pair(6).s.pendingCrosses).toEqual([]);
    const { s, a, b } = pair(7);
    expect(s.pendingCrosses).toEqual([{ a, b, hybrid: 'cracklecrown' }]);
  });

  it('is heavy too', () => {
    let s = year(7);
    s.round = 2;
    bed(s, spot(s)[0], 'cracklecrown', 'F', 'straw');
    s = run(s, { type: 'harvest' });
    expect(s.storage.cracklecrown).toBe(2);
  });
});
