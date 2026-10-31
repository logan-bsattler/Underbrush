import { describe, expect, it } from 'vitest';
import {
  achievementProgress,
  achievementsEarned,
  basketCapacity,
  boardsFor,
  bustAt,
  content,
  dailyBoard,
  dispatch,
  emptyJournal,
  farmLayout,
  lookalikeOn,
  mergeDiscoveries,
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
    expect(boardsFor({ ...emptyJournal(), renown: 420 })).toHaveLength(content.boards.length);
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
    expect(auto.night!.events).toContainEqual(expect.objectContaining({ type: 'autoHarvest', gained: { oyster: 1 } }));
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

  it('deals the first waiting order storage can fill, keeping the rest of the pile in its order', () => {
    const s = fresh('swap3');
    s.coins = 20;
    s.storage = { morel: 1, stgeorge: 1 };
    s.orders.visible = ['o-lion2', 'o-shii2', 'o-enoki2'];
    s.orders.deck = ['o-reishii', 'o-hyb2', 'o-stgeorge', 'o-woods2', 'o-four'];
    const a = run(s, { type: 'swapOrder', order: 'o-shii2' });
    expect(a.orders.visible).toEqual(['o-lion2', 'o-stgeorge', 'o-enoki2']);
    expect(a.orders.deck).toEqual(['o-reishii', 'o-hyb2', 'o-woods2', 'o-four', 'o-shii2']);
  });

  it('deals the top of the pile when nothing waiting can be filled', () => {
    const s = fresh('swap4');
    s.coins = 20;
    s.storage = { puffball: 1 };
    s.orders.visible = ['o-lion2', 'o-shii2', 'o-enoki2'];
    s.orders.deck = ['o-reishii', 'o-hyb2', 'o-stgeorge'];
    const a = run(s, { type: 'swapOrder', order: 'o-lion2' });
    expect(a.orders.visible[0]).toBe('o-reishii');
    expect(a.orders.deck).toEqual(['o-hyb2', 'o-stgeorge', 'o-lion2']);
  });

  it('deals below-ground orders only once a generation has a layer open', () => {
    const dealt = (generation: number) => {
      const s = newGame({ seed: 'below', perks: { ...standardPerks(), generation } });
      return [...s.orders.visible, ...s.orders.deck];
    };
    expect(dealt(1)).not.toContain('o-below2');
    expect(dealt(2)).toContain('o-below2');
  });

  it('gives every zone order the gear that opens its zone', () => {
    for (const o of content.orders) {
      if (o.need.kind !== 'zone') continue;
      const zone = content.zones.find((z) => z.id === (o.need as { zone: string }).zone)!;
      expect(o.requires ?? null, o.id).toBe(zone.unlock);
    }
  });

  it('keeps a daily year the same for everyone on the same seed', () => {
    const a = newGame({ seed: '2026-10-28', mode: 'daily' });
    const b = newGame({ seed: '2026-10-28', mode: 'daily' });
    a.coins = b.coins = 20;
    a.storage = { morel: 1, stgeorge: 1, chanterelle: 2 };
    b.storage = { ...a.storage };
    const swap = (s: GameState) => run(s, { type: 'swapOrder', order: s.orders.visible[0] }, { type: 'swapOrder', order: s.orders.visible[1] });
    expect(swap(a).orders).toEqual(swap(b).orders);
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

  it('cooks the wild dishes from what each one needs', () => {
    const s = fresh('wild-dishes');
    s.storage = { morel: 2, dryad: 2, porcini: 1, blewit: 1, yellowfoot: 1, woodear: 1, springking: 1, matsutake: 1 };
    expect(bustAt(cook(s, 'morelbutter'))).toBe(content.rules.bustAt + 1);
    expect(saleValue(cook(s, 'porcinipie'), 'oyster')).toBe(saleValue(s, 'oyster') + 1);
    expect(cook(s, 'blewitstew').actionsLeft).toBe(s.actionsLeft + 1);
    expect(lookalikeOn(cook(s, 'winterbroth'), 'chanterelle')).toBe(lookalikeOn(s, 'chanterelle') - 1);
    for (const id of ['springtart', 'matsutakerice']) {
      const feast = cook(s, id);
      expect(score(feast).feast).toBe(3);
      expect(score(feast).total).toBe(score(s).total + 3);
    }
    const tart = cook(s, 'springtart');
    expect(tart.storage.springking ?? 0).toBe(0);
    expect(tart.storage.morel).toBe(1);
    const stew = cook(s, 'dryadstew');
    expect(stew.storage.dryad ?? 0).toBe(0);
    expect(() => cook({ ...s, storage: { dryad: 1 } }, 'dryadstew')).toThrow(/needs 2 Dryad/);
    expect(() => cook({ ...s, storage: { yellowfoot: 1 } }, 'winterbroth')).toThrow(/needs 1 Yellowfoot and 1 Wood Ear/);
  });

  it('dishes score at most the yearly cap of festival points', () => {
    const s = fresh('feast-cap');
    s.storage = { matsutake: 1 };
    s.feastPoints = content.rules.maxFeastPoints - 1;
    expect(cook(s, 'matsutakerice').feastPoints).toBe(content.rules.maxFeastPoints);
    s.feastPoints = content.rules.maxFeastPoints;
    expect(score(cook(s, 'matsutakerice')).feast).toBe(content.rules.maxFeastPoints);
  });

  it("Dryad's Saddle Stew waters the beds tonight", () => {
    const s = fresh('dryadstew');
    s.storage = { dryad: 2 };
    bed(s, 5, 'oyster', 'C');
    const a = run(s, { type: 'cook', recipe: 'dryadstew' }, { type: 'endMonth' });
    expect(a.grid[5].dry).toBe(0);
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
    expect(total(t)).toBe(content.zones[0].deck.filter((e) => !e.unlock).reduce((n, e) => n + e.copies, 0));
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

  it('opens the Riverbank with Waders, stocked from level 7, spring to fall', () => {
    const shop = (renown: number) => perksFor({ ...emptyJournal(), renown }, []).shop;
    expect(shop(150)).not.toContain('waders');
    expect(shop(210)).toContain('waders');
    const s = fresh('river');
    expect(() => dispatch(s, { type: 'forage', zone: 'riverbank' })).toThrow(/Waders/);
    s.gear.push('waders');
    for (const round of [1, 4, 7]) expect(run({ ...s, round }, { type: 'forage', zone: 'riverbank' }).forage!.zone).toBe('riverbank');
    s.round = 10;
    expect(() => dispatch(s, { type: 'forage', zone: 'riverbank' })).toThrow(/Only open in spring, summer and fall/);
  });

  it('deals Riverbank orders only once the shop stocks Waders', () => {
    const dealt = (g: GameState) => [...g.orders.visible, ...g.orders.deck];
    expect(dealt(newGame({ seed: 'river-orders', perks: perksFor({ ...emptyJournal(), renown: 150 }, []) }))).not.toContain('o-shaggy2');
    expect(dealt(newGame({ seed: 'river-orders', perks: perksFor({ ...emptyJournal(), renown: 210 }, []) }))).toContain('o-shaggy2');
  });
});

describe('achievements: clearing a zone', () => {
  const coin: Card = { type: 'coins', amount: 1 };
  const hazard: Card = { type: 'hazard', name: 'Nettles' };
  /** A Meadow trip on a stacked deck: the first nine cards make the first patch. */
  function stacked(draw: Card[]) {
    const s = fresh('clear');
    s.decks.meadow = { draw: draw.map((card) => ({ ...card })), discard: [] };
    return run(s, { type: 'forage', zone: 'meadow' });
  }

  it('clears the zone when the last non-hazard card is turned, leaving hazards face down', () => {
    let s = stacked([...Array(8).fill(coin), hazard, hazard, hazard]);
    for (let i = 0; i < 7; i++) {
      const r = dispatch(s, { type: 'flip', index: i });
      expect(r.result).not.toMatchObject({ cleared: true });
      s = r.state;
    }
    const last = dispatch(s, { type: 'flip', index: 7 });
    expect(last.result).toMatchObject({ kind: 'draw', cleared: true });
    expect(last.state.forage!.cleared).toBe(true);
    expect(last.state.zonesCleared).toEqual(['meadow']);
  });

  it("can't clear once a non-hazard card is left behind by going deeper", () => {
    let s = stacked(Array(18).fill(coin));
    for (let i = 0; i < 8; i++) s = run(s, { type: 'flip', index: i });
    s = run(s, { type: 'deeper' });
    expect(s.forage!.missed).toBe(1);
    for (let i = 0; i < 9; i++) s = run(s, { type: 'flip', index: i });
    expect(s.forage!.cleared).toBe(false);
    expect(s.zonesCleared).toEqual([]);
  });

  it('earns the achievement in the field journal once, with a fresh tag for the year-end screen', () => {
    let s = stacked([...Array(8).fill(coin), hazard]);
    for (let i = 0; i < 8; i++) s = run(s, { type: 'flip', index: i });
    const first = mergeDiscoveries(emptyJournal(), s);
    expect(first.journal.achievements).toEqual(['clearZone']);
    expect(first.journal.zonesCleared).toEqual(['meadow']);
    expect(first.fresh).toContain('achievement:clearZone');
    expect(mergeDiscoveries(first.journal, s).fresh).toEqual([]);
  });
});

describe('achievements: feats of a year', () => {
  const earned = (s: GameState) => achievementsEarned(s);

  it('counts a rare mushroom picked from a deep find, not a deep cache of coins', () => {
    let s = run(fresh('rare'), { type: 'forage', zone: 'meadow' }, { type: 'deeper' }, { type: 'deeper' });
    const at = s.forage!.patch.findIndex((p) => p.deep);
    s.forage!.patch[at].card = { type: 'coins', amount: 3 };
    expect(run(s, { type: 'flip', index: at }).stats.rareFinds).toBe(0);
    s.forage!.patch[at].card = { type: 'specimen', species: 'stgeorge' };
    expect(run(s, { type: 'flip', index: at }).stats.rareFinds).toBe(1);
  });

  it('remembers each different dish cooked this year', () => {
    const s = fresh('menu');
    s.storage = { reishi: 2, oyster: 2 };
    let a = run(s, { type: 'cook', recipe: 'reishitea' }, { type: 'endMonth' }, { type: 'dismissNight' });
    a = run(a, { type: 'cook', recipe: 'reishitea' }, { type: 'endMonth' }, { type: 'dismissNight' }, { type: 'cook', recipe: 'oysterfry' });
    expect(a.stats.dishes).toEqual(['reishitea', 'oysterfry']);
  });

  it("awards festival tiers only once the festival is over, against the generation's tiers", () => {
    const s = fresh('tier');
    s.orderPoints = 15;
    expect(earned(s)).not.toContain('firstRibbon');
    s.over = true;
    expect(earned(s)).toContain('firstRibbon');
    expect(earned(s)).not.toContain('golden');
    s.perks.generation = 2;
    expect(earned(s)).not.toContain('firstRibbon');
    expect(earned(s)).toContain('familyFarm');
  });

  it('needs a whole year without a bust for Sure-Footed', () => {
    const s = fresh('sure');
    s.stats.trips = 10;
    expect(earned(s)).not.toContain('sureFooted');
    s.over = true;
    expect(earned(s)).toContain('sureFooted');
    s.stats.busts = 1;
    expect(earned(s)).not.toContain('sureFooted');
  });

  it('fills the farm for Wall to Wall, trees aside', () => {
    const s = clearFarm(fresh('wall'));
    const open = s.grid.map((sq, i) => (sq.tree ? -1 : i)).filter((i) => i >= 0);
    for (const i of open.slice(1)) bed(s, i, 'oyster');
    expect(earned(s)).not.toContain('wallToWall');
    bed(s, open[0], 'oyster');
    expect(earned(s)).toContain('wallToWall');
  });

  it('needs every Legend challenge and a festival tier for Against the Grain', () => {
    const s = fresh('grain');
    s.over = true;
    s.perks.challenges = content.progression.challenges.map((c) => c.id);
    expect(earned(s)).not.toContain('againstTheGrain');
    s.orderPoints = 15;
    expect(earned(s)).toContain('againstTheGrain');
    s.perks.challenges = s.perks.challenges.slice(1);
    expect(earned(s)).not.toContain('againstTheGrain');
  });

  it('counts hybrids, orders, compost and coins within the year', () => {
    const s = fresh('counts');
    expect(earned(s)).toEqual([]);
    Object.assign(s, { hybridsMade: ['shaggyoyster', 'emberpuff', 'frostoyster'] });
    s.orders.filled = ['a', 'b', 'c', 'd', 'e', 'f'];
    Object.assign(s.stats, { compostTiles: 5, coinsEarned: 100, rareFinds: 5, dishes: ['a', 'b', 'c', 'd'] });
    expect(earned(s)).toEqual(['firstCross', 'rareHaul', 'villageCook', 'blackGold', 'fullPurse', 'orderBook', 'strangeGardens']);
  });

  it('reports how far this year is toward counted achievements', () => {
    const s = clearFarm(fresh('progress'));
    s.stats.rareFinds = 2;
    s.stats.trips = 4;
    const of = (id: string) => achievementProgress(content.achievements.find((a) => a.id === id)!.check, s);
    expect(of('rareHaul')).toEqual({ have: 2, need: 5 });
    expect(of('sureFooted')).toEqual({ have: 4, need: 10 });
    expect(of('wallToWall')).toEqual({ have: 0, need: s.grid.filter((sq) => !sq.tree).length });
    expect(of('golden')).toBeNull();
    s.stats.busts = 1;
    expect(of('sureFooted')).toBeNull();
  });

  it('every achievement has a known check', () => {
    const ids = content.achievements.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of content.achievements) if (a.check.type === 'tier') expect(content.rules.tiers.map((t) => t.id)).toContain(a.check.tier);
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

  it('plays on with an order pile dealt before the wild orders', () => {
    const s = fresh('oldorders');
    s.orders = { visible: ['o-oyster3', 'o-lion2', 'o-shii2'], deck: ['o-reishii', 'o-hyb2', 'o-four', 'o-morel2'], filled: [] };
    s.coins = 20;
    s.storage = { morel: 2 };
    const m = run(migrateState(structuredClone(s)), { type: 'swapOrder', order: 'o-lion2' }, { type: 'fillOrder', order: 'o-morel2' });
    expect(m.orders.filled).toEqual(['o-morel2']);
    expect(m.orderPoints).toBe(6);
  });

  it('deals a deck afresh when its printed size has changed, but not during a trip there', () => {
    const s = newGame({ seed: 'resize' });
    s.decks.meadow = { draw: s.decks.meadow.draw.slice(0, 20), discard: s.decks.meadow.draw.slice(20, 24) };
    s.decks.mixedwoods = { draw: s.decks.mixedwoods.draw.slice(0, 24), discard: [] };
    s.forage = { zone: 'mixedwoods', status: 'open', patch: [], depth: 1 } as any;
    const m = migrateState(structuredClone(s));
    expect(m.decks.meadow.draw).toHaveLength(32);
    expect(m.decks.meadow.discard).toHaveLength(0);
    expect(m.decks.mixedwoods.draw).toHaveLength(24);
  });
});
