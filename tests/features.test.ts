import { describe, expect, it } from 'vitest';
import {
  basketCapacity,
  boardsFor,
  bustAt,
  content,
  dailyBoard,
  dispatch,
  emptyJournal,
  farmLayout,
  lookalikeOn,
  migrateState,
  newGame,
  perksFor,
  saleValue,
  score,
  spawnStock,
  standardPerks,
  swapCost,
  type Action,
  type Card,
  type GameState,
} from '../src/core';

const run = (s: GameState, ...actions: Action[]) => {
  for (const a of actions) s = dispatch(s, a).state;
  return s;
};

function fresh(seed = 'feat', opts: Parameters<typeof newGame>[0] = {}): GameState {
  const s = newGame({ seed, ...opts });
  s.weather = 'clear';
  return s;
}

/** Clears every bed and tile, keeping the trees. */
function clearFarm(s: GameState) {
  for (const sq of s.grid) if (!sq.tree) Object.assign(sq, { substrate: null, species: null, stage: null, hold: 0, dry: 0, blight: false });
  return s;
}

function bed(s: GameState, i: number, species: string, stage: 'S' | 'C' | 'P' | 'F' = 'S') {
  Object.assign(s.grid[i], { substrate: content.species[species].substrates[0], species, stage, hold: 0, dry: 0, blight: false });
}

describe('starting boards', () => {
  it('lays out each board with its trees, damp squares and starting beds', () => {
    for (const b of content.boards) {
      const s = newGame({ seed: 'x', board: b.id });
      expect(s.board).toBe(b.id);
      expect(s.grid.filter((q) => q.tree)).toHaveLength(b.trees.length);
      expect(s.grid.filter((q) => q.species)).toHaveLength(b.start.filter((x) => x.species).length);
      for (const sq of b.start) expect(s.grid[sq.index].substrate).toBe(sq.substrate);
      // No starting bed sits on a tree.
      for (const sq of b.start) expect(b.trees).not.toContain(sq.index);
    }
  });

  it('keeps the stream down the left column, or only the springs on a board without one', () => {
    const stream = newGame({ seed: 'x', board: 'streamside' });
    expect(stream.grid.map((q, i) => (q.damp ? i : -1)).filter((i) => i >= 0)).toEqual([0, 4, 8, 12]);
    const woodlot = newGame({ seed: 'x', board: 'woodlot' });
    expect(woodlot.grid.map((q, i) => (q.damp ? i : -1)).filter((i) => i >= 0)).toEqual([12, 13]);
  });

  it('extends a board to 5×5, stream included', () => {
    const l = farmLayout('woodlot', 5);
    expect(l.trees).toEqual([1, 7, 13, 24]);
    expect(l.damp).toEqual([15, 16]);
    expect(farmLayout('streamside', 5).damp).toEqual([0, 5, 10, 15, 20]);
  });

  it('dries beds away from damp squares only', () => {
    const s = clearFarm(fresh('dry', { board: 'woodlot' }));
    bed(s, 12, 'oyster', 'C');
    bed(s, 0, 'oyster', 'C');
    const after = run(s, { type: 'endMonth' });
    const dried = after.night!.events.flatMap((e) => (e.type === 'dry' ? [e.square] : []));
    expect(dried).toEqual([0]);
  });

  it('opens boards as the homestead levels up', () => {
    expect(boardsFor(emptyJournal())).toEqual(['streamside', 'meadowedge']);
    expect(boardsFor({ ...emptyJournal(), renown: 150 })).toContain('woodlot');
    expect(boardsFor({ ...emptyJournal(), renown: 480 })).toHaveLength(content.boards.length);
  });

  it('gives a daily year the same board for everyone that day', () => {
    const a = newGame({ seed: 'daily-2026-10-25', mode: 'daily' });
    const b = newGame({ seed: 'daily-2026-10-25', mode: 'daily' });
    expect(a.board).toBe(b.board);
    expect(a.board).toBe(dailyBoard('daily-2026-10-25'));
    const days = new Set(Array.from({ length: 30 }, (_, d) => dailyBoard(`daily-2026-11-${d}`)));
    expect(days.size).toBeGreaterThan(1);
  });
});

describe('gear: Drip Line and Blight Spray', () => {
  it('Drip Line waters every bed, and a dry spell still grows', () => {
    const s = fresh('drip');
    s.gear.push('dripline');
    s.weather = 'dryspell';
    bed(s, 5, 'oyster', 'S');
    const after = run(s, { type: 'endMonth' });
    expect(after.grid[5].stage).toBe('C');
    expect(after.grid.every((q) => q.dry === 0)).toBe(true);
  });

  it('Blight Spray clears every blighted bed for one action', () => {
    const s = fresh('spray');
    bed(s, 5, 'oyster', 'C');
    bed(s, 6, 'shiitake', 'C');
    s.grid[5].blight = true;
    s.grid[6].blight = true;
    const one = run(s, { type: 'clearBlight', square: 5 });
    expect(one.grid.filter((q) => q.blight)).toHaveLength(1);
    s.gear.push('blightspray');
    const all = run(s, { type: 'clearBlight', square: 5 });
    expect(all.grid.filter((q) => q.blight)).toHaveLength(0);
    expect(all.actionsLeft).toBe(s.actionsLeft - 1);
  });
});

describe('auto harvest', () => {
  it('picks every fruiting bed into storage each morning once unlocked', () => {
    const s = clearFarm(fresh('auto'));
    s.round = 4;
    s.watered = true;
    bed(s, 8, 'oyster', 'C'); // fast: C→F tonight
    const plain = run(s, { type: 'endMonth' });
    expect(plain.grid[8].stage).toBe('F');
    s.perks.autoHarvest = true;
    const auto = run(s, { type: 'endMonth' });
    expect(auto.grid[8].stage).toBe('C');
    expect(auto.storage.oyster).toBe(1);
    expect(auto.night!.events).toContainEqual({ type: 'autoHarvest', gained: { oyster: 1 } });
  });

  it('picks after the season turns, so the fresh harvest doesn’t spoil', () => {
    const s = clearFarm(fresh('auto2'));
    s.round = 3;
    s.watered = true;
    s.perks.autoHarvest = true;
    s.storage = { puffball: 2 };
    bed(s, 8, 'oyster', 'C');
    const after = run(s, { type: 'endMonth' });
    expect(after.storage).toEqual({ oyster: 1 });
  });
});

describe('swapping festival orders', () => {
  it('sends an order to the bottom of the deck for coins, dearer each time', () => {
    const s = fresh('swap');
    s.coins = 20;
    const first = s.orders.visible[0];
    const next = s.orders.deck[0];
    const a = run(s, { type: 'swapOrder', order: first });
    expect(a.orders.visible[0]).toBe(next);
    expect(a.orders.deck[a.orders.deck.length - 1]).toBe(first);
    expect(a.coins).toBe(20 - content.rules.swapCost);
    expect(a.actionsLeft).toBe(s.actionsLeft - 1); // the market visit
    expect(swapCost(a)).toBe(content.rules.swapCost + 1);
    const b = run(a, { type: 'swapOrder', order: a.orders.visible[1] });
    expect(b.coins).toBe(a.coins - content.rules.swapCost - 1);
    expect(b.actionsLeft).toBe(a.actionsLeft); // same visit
  });

  it('needs the coins, and works on festival morning', () => {
    const s = fresh('swap2');
    s.coins = 1;
    expect(() => dispatch(s, { type: 'swapOrder', order: s.orders.visible[0] })).toThrow(/costs 2 coins/);
    s.coins = 5;
    s.finale = { harvested: false, marketed: false };
    s.actionsLeft = 0;
    const a = run(s, { type: 'swapOrder', order: s.orders.visible[0] });
    expect(a.finale!.marketed).toBe(true);
  });

  it('only deals orders for zones the shop can open', () => {
    const basic = perksFor(emptyJournal(), []);
    const s = newGame({ seed: 'orders', perks: basic });
    const dealt = [...s.orders.visible, ...s.orders.deck];
    expect(dealt).not.toContain('o-truffle');
    expect(dealt).not.toContain('o-porcini2');
    expect([...newGame({ seed: 'orders' }).orders.deck, ...newGame({ seed: 'orders' }).orders.visible]).toContain('o-truffle');
  });
});

describe('spawn', () => {
  it('sells spawn of species you have identified, as a ready-to-plant specimen', () => {
    const s = fresh('spawn');
    s.coins = 10;
    expect(spawnStock(s)).toEqual([]);
    expect(() => dispatch(s, { type: 'buySpawn', species: 'reishi' })).toThrow(/Identify one first/);
    s.discovered.push('reishi', 'chanterelle');
    expect(spawnStock(s)).toEqual(['reishi']);
    const a = run(s, { type: 'buySpawn', species: 'reishi' });
    expect(a.coins).toBe(10 - (content.species.reishi.value + content.rules.spawnMarkup));
    expect(a.basket).toEqual([{ uid: s.nextUid, species: 'reishi', identified: true, trip: 0 }]);
    const planted = run(a, { type: 'plant', uid: s.nextUid, square: 5 });
    expect(planted.grid[5].species).toBe('reishi');
  });

  it('stocks the field journal’s cultivated species from the first month of a story year', () => {
    const p = perksFor({ ...emptyJournal(), discovered: ['shiitake', 'porcini', 'lacquercap'] }, []);
    expect(p.spawn).toEqual(['shiitake']);
    expect(standardPerks().spawn).toEqual([]);
  });

  it('saves a stored mushroom as spawn for free, hybrids included, but not wild ones', () => {
    const s = fresh('save');
    s.storage = { lacquercap: 1, porcini: 1 };
    const a = run(s, { type: 'saveSpawn', species: 'lacquercap' });
    expect(a.storage).toEqual({ porcini: 1 });
    expect(a.actionsLeft).toBe(s.actionsLeft);
    expect(a.basket[0]).toMatchObject({ species: 'lacquercap', identified: true });
    expect(() => dispatch(a, { type: 'saveSpawn', species: 'porcini' })).toThrow(/Wild/);
    const planted = run(a, { type: 'plant', uid: a.basket[0].uid, square: 5 });
    expect(planted.grid[5].species).toBe('lacquercap');
    expect(planted.planted).toContain('lacquercap');
  });
});

describe('cooking', () => {
  const cook = (s: GameState, recipe: string) => run(s, { type: 'cook', recipe });

  it('takes the ingredients from storage, once a month, for free', () => {
    const s = fresh('cook');
    s.storage = { oyster: 3, reishi: 1 };
    const a = cook(s, 'oysterfry');
    expect(a.storage).toEqual({ oyster: 1, reishi: 1 });
    expect(a.meal).toBe('oysterfry');
    expect(basketCapacity(a)).toBe(basketCapacity(s) + 2);
    expect(() => cook(a, 'reishitea')).toThrow(/already cooked/);
    expect(() => cook(s, 'supper')).toThrow(/needs 2 Puffball/);
    const next = run(a, { type: 'endMonth' });
    expect(next.meal).toBeNull();
  });

  it('applies each dish for the month', () => {
    const s = fresh('dishes');
    s.storage = { reishi: 1, lionsmane: 1, chanterelle: 1, winecap: 2, truffle: 1 };
    expect(cook(s, 'reishitea').actionsLeft).toBe(s.actionsLeft + 1);
    expect(lookalikeOn(cook(s, 'lionsbroth'), 'chanterelle')).toBe(lookalikeOn(s, 'chanterelle') - 1);
    expect(bustAt(cook(s, 'trailtoast'))).toBe(content.rules.bustAt + 1);
    expect(saleValue(cook(s, 'risotto'), 'oyster')).toBe(saleValue(s, 'oyster') + 1);
    const feast = cook(s, 'truffle');
    expect(score(feast).feast).toBe(3);
    expect(score(feast).total).toBe(score(s).total + 3);
  });

  it('Puffball Supper waters the beds tonight', () => {
    const s = fresh('supper');
    s.storage = { puffball: 2 };
    bed(s, 5, 'oyster', 'C');
    const a = run(s, { type: 'cook', recipe: 'supper' }, { type: 'endMonth' });
    expect(a.grid[5].dry).toBe(0);
  });

  it('a trip on Chanterelle Toast survives a second hazard', () => {
    const s = fresh('toast');
    s.storage = { chanterelle: 1 };
    const hz: Card = { type: 'hazard', name: 'Ticks' };
    s.decks.meadow.draw.unshift(hz, hz, hz);
    let t = run(s, { type: 'cook', recipe: 'trailtoast' }, { type: 'forage', zone: 'meadow' });
    t = run(t, { type: 'flip', index: 0 }, { type: 'flip', index: 1 });
    expect(t.forage!.status).toBe('open');
    t = run(t, { type: 'flip', index: 2 });
    expect(t.forage!.status).toBe('busted');
  });
});

describe('going deeper', () => {
  const walk = (s: GameState, zone: string, depth: number) => {
    s = run(s, { type: 'forage', zone });
    for (let d = 1; d < depth; d++) s = run(s, { type: 'deeper' });
    return s;
  };

  it('deals one deep find into every patch from the third', () => {
    const s = fresh('deep');
    const two = walk(s, 'meadow', 2);
    expect(two.forage!.patch.some((p) => p.deep)).toBe(false);
    const three = walk(s, 'meadow', 3);
    expect(three.forage!.patch.filter((p) => p.deep)).toHaveLength(1);
    expect(three.forage!.patch).toHaveLength(9);
  });

  it('deals the rare mushroom in season, and a cache of coins about one time in four', () => {
    const s = fresh('deep2');
    const finds = (round: number) => {
      s.round = round;
      return Array.from({ length: 200 }, (_, i) => walk({ ...s, rng: i }, 'meadow', 3).forage!.patch.find((p) => p.deep)!.card);
    };
    for (const [round, species] of [[1, 'stgeorge'], [4, 'fairyring'], [7, 'blewit'], [10, 'blewit']] as const) {
      const cards = finds(round);
      const coins = cards.filter((c) => c.type === 'coins').length;
      expect(new Set(cards.map((c) => (c.type === 'specimen' ? c.species : c.type)))).toEqual(new Set([species, 'coins']));
      expect(coins / cards.length).toBeGreaterThan(0.15);
      expect(coins / cards.length).toBeLessThan(0.35);
    }
  });

  it('has a rare mushroom in every season each zone is open', () => {
    for (const z of content.zones) {
      for (const season of z.seasons ?? content.rules.seasons) {
        const inSeason = z.deep.filter((c) => c.type === 'specimen' && content.species[c.species].seasons.includes(season));
        expect(inSeason, `${z.id} in ${season}`).toHaveLength(1);
      }
    }
  });

  it('never puts a deep find into the deck', () => {
    const s = fresh('deep3');
    const total = (g: GameState) => g.decks.meadow.draw.length + g.decks.meadow.discard.length;
    let t = walk(s, 'meadow', 3);
    const at = t.forage!.patch.findIndex((p) => p.deep);
    t = run(t, { type: 'flip', index: at }, { type: 'stopForage' });
    // Heading home shuffles every card back in: the printed deck, and nothing more.
    expect(total(t)).toBe(content.zones[0].deck.reduce((n, e) => n + e.copies, 0));
  });

  it('opens the Hollow with a Compass, in fall and winter', () => {
    const s = fresh('hollow');
    s.round = 7;
    expect(() => dispatch(s, { type: 'forage', zone: 'hollow' })).toThrow(/Compass/);
    s.gear.push('compass');
    expect(run(s, { type: 'forage', zone: 'hollow' }).forage!.zone).toBe('hollow');
    s.round = 4;
    expect(() => dispatch(s, { type: 'forage', zone: 'hollow' })).toThrow(/Only open in fall and winter/);
  });
});

describe('old saves', () => {
  it('migrates a save from before boards, swaps, meals and the Hollow', () => {
    const s = newGame({ seed: 'old' }) as any;
    delete s.board;
    delete s.orderSwaps;
    delete s.meal;
    delete s.feastPoints;
    delete s.decks.hollow;
    delete s.perks.autoHarvest;
    delete s.perks.spawn;
    for (const sq of s.grid) delete sq.damp;
    const m = migrateState(s);
    expect(m).toMatchObject({ board: 'streamside', orderSwaps: 0, meal: null, feastPoints: 0 });
    expect(m.perks).toMatchObject({ autoHarvest: false, spawn: [] });
    expect(m.grid.filter((q: { damp: boolean }) => q.damp)).toHaveLength(4);
    expect(m.decks.hollow.draw.length).toBeGreaterThan(0);
  });
});
