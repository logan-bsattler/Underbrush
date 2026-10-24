import { describe, expect, it } from 'vitest';
import {
  content,
  dispatch,
  GameError,
  hazardsNear,
  newGame,
  orderPayment,
  score,
  seasonOf,
  type Action,
  type Card,
  type GameState,
} from '../src/core';
import { runGrowth } from '../src/core/growth';
import { Rng } from '../src/core/rng';
import { emptyJournal, mergeDiscoveries, recordYear } from '../src/core/journal';
import { playYear } from '../scripts/bot';

const run = (s: GameState, ...actions: Action[]) => {
  for (const a of actions) s = dispatch(s, a).state;
  return s;
};

/** A fresh game with clear weather and an empty farm, for growth tests. */
function blank(seed = 'test'): GameState {
  const s = newGame({ seed });
  s.weather = 'clear';
  s.shed = [];
  for (const sq of s.grid) Object.assign(sq, { substrate: null, species: null, stage: null, hold: 0, dry: 0, blight: false });
  return s;
}

function bed(s: GameState, i: number, species: string, stage: 'S' | 'C' | 'P' | 'F' = 'S', substrate = content.species[species].substrates[0]) {
  Object.assign(s.grid[i], { substrate, species, stage, hold: 0, dry: 0, blight: false });
}

function grow(s: GameState) {
  return runGrowth(s, new Rng(1), content);
}

function stackDeck(s: GameState, zone: string, cards: Card[]) {
  s.decks[zone].draw = cards.concat(s.decks[zone].draw);
}

describe('setup', () => {
  it('matches the solo setup', () => {
    const s = newGame({ seed: 'a' });
    expect(s.round).toBe(1);
    expect(s.actionsLeft).toBe(4);
    expect(s.coins).toBe(3);
    expect(s.orders.visible).toHaveLength(3);
    expect(s.grid.filter((q) => q.tree)).toHaveLength(2);
    expect(s.grid.filter((q) => q.substrate === 'log')).toHaveLength(2);
    expect(s.grid.filter((q) => q.substrate === 'straw')).toHaveLength(2);
    expect(s.grid.filter((q) => q.species === 'oyster' && q.stage === 'C')).toHaveLength(1);
    for (const z of content.zones) {
      const total = z.deck.reduce((n, e) => n + e.copies, 0);
      expect(s.decks[z.id].draw).toHaveLength(total);
    }
  });

  it('is deterministic for a seed', () => {
    expect(newGame({ seed: 'same' })).toEqual(newGame({ seed: 'same' }));
    expect(newGame({ seed: 'same' }).decks.meadow.draw).not.toEqual(newGame({ seed: 'other' }).decks.meadow.draw);
  });

  it('names seasons by round', () => {
    expect([1, 3, 4, 7, 10, 12].map((r) => seasonOf(r))).toEqual(['spring', 'spring', 'summer', 'fall', 'winter', 'winter']);
  });

  it('never mutates the input state', () => {
    const s = newGame({ seed: 'b' });
    const copy = structuredClone(s);
    dispatch(s, { type: 'water' });
    expect(s).toEqual(copy);
  });
});

describe('foraging', () => {
  it('busts on the second hazard and keeps the first two specimens', () => {
    let s = newGame({ seed: 'f' });
    s.weather = 'clear';
    stackDeck(s, 'meadow', [
      { type: 'specimen', species: 'puffball' },
      { type: 'hazard', name: 'Ticks' },
      { type: 'specimen', species: 'winecap' },
      { type: 'specimen', species: 'puffball' },
      { type: 'coins', amount: 2 },
      { type: 'hazard', name: 'Lost Trail' },
    ]);
    s = run(s, { type: 'forage', zone: 'meadow' });
    expect(s.actionsLeft).toBe(3);
    for (let i = 0; i < 6; i++) s = run(s, { type: 'flip', index: i });
    expect(s.forage!.status).toBe('busted');
    expect(s.basket.map((b) => b.species)).toEqual(['puffball', 'winecap']);
    expect(s.coins).toBe(5);
    expect(s.stats.busts).toBe(1);
    expect(() => dispatch(s, { type: 'flip', index: 6 })).toThrow(GameError);
  });

  it('lets the knife ignore the first hazard', () => {
    let s = newGame({ seed: 'k' });
    s.weather = 'clear';
    s.gear.push('knife');
    stackDeck(s, 'meadow', [
      { type: 'hazard', name: 'Ticks' },
      { type: 'hazard', name: 'Ticks' },
      { type: 'specimen', species: 'puffball' },
    ]);
    s = run(s, { type: 'forage', zone: 'meadow' }, { type: 'flip', index: 0 }, { type: 'flip', index: 1 }, { type: 'flip', index: 2 });
    expect(s.forage!.status).toBe('open');
    expect(s.forage!.hazards).toBe(1);
    expect(s.basket).toHaveLength(1);
  });

  it('leaves specimens behind when the basket is full, and wild ones out of season', () => {
    let s = newGame({ seed: 'b' });
    s.weather = 'clear';
    stackDeck(s, 'mixedwoods', [
      { type: 'specimen', species: 'chanterelle' }, // spring: empty patch
      ...Array.from({ length: 5 }, (): Card => ({ type: 'specimen', species: 'oyster' })),
    ]);
    s = run(s, { type: 'forage', zone: 'mixedwoods' });
    const outcomes = [];
    for (let i = 0; i < 6; i++) {
      const r = dispatch(s, { type: 'flip', index: i });
      s = r.state;
      outcomes.push(r.result.kind === 'draw' ? r.result.outcome : '');
    }
    expect(outcomes).toEqual(['emptyPatch', 'basket', 'basket', 'basket', 'basket', 'basketFull']);
  });

  it('deals a 3×3 patch from the top of the zone deck', () => {
    let s = newGame({ seed: 'deal' });
    s.weather = 'clear';
    const top = s.decks.meadow.draw.slice(0, 9);
    s = run(s, { type: 'forage', zone: 'meadow' });
    expect(s.forage!.patch.map((p) => p.card)).toEqual(top);
    expect(s.forage!.patch.every((p) => !p.flipped)).toBe(true);
    expect(s.decks.meadow.draw).toHaveLength(24 - 9);
    expect(() => dispatch(s, { type: 'flip', index: 9 })).toThrow(GameError);
  });

  it('counts the hazards beside a card, up, down, left and right', () => {
    let s = newGame({ seed: 'near' });
    s.weather = 'clear';
    const h: Card = { type: 'hazard', name: 'Ticks' };
    const f: Card = { type: 'coins', amount: 2 };
    // h f h
    // f f f
    // f h f
    stackDeck(s, 'meadow', [h, f, h, f, f, f, f, h, f]);
    s = run(s, { type: 'forage', zone: 'meadow' });
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => hazardsNear(s.forage!, i))).toEqual([0, 2, 0, 1, 1, 1, 1, 0, 1]);
  });

  it('going deeper returns unturned cards under the deck and deals a fresh patch; hazards carry over', () => {
    let s = newGame({ seed: 'deep' });
    s.weather = 'clear';
    stackDeck(s, 'meadow', [{ type: 'hazard', name: 'Ticks' }]);
    const cards = s.decks.meadow.draw.length;
    s = run(s, { type: 'forage', zone: 'meadow' }, { type: 'flip', index: 0 });
    const unturned = s.forage!.patch.slice(1).map((p) => p.card);
    const next = s.decks.meadow.draw.slice(0, 9);
    s = run(s, { type: 'deeper' });
    expect(s.forage).toMatchObject({ depth: 2, hazards: 1, status: 'open' });
    expect(s.forage!.patch.map((p) => p.card)).toEqual(next);
    expect(s.decks.meadow.draw.slice(-8)).toEqual(unturned);
    const total = (x: GameState) => x.decks.meadow.draw.length + x.decks.meadow.discard.length + x.forage!.patch.length;
    expect(total(s)).toBe(cards);
    s = run(s, { type: 'stopForage' });
    expect(s.decks.meadow.draw.length + s.decks.meadow.discard.length).toBe(cards);
  });

  it('respects locks, seasons and fog', () => {
    const s = newGame({ seed: 'z' });
    s.weather = 'fog';
    expect(() => dispatch(s, { type: 'forage', zone: 'mixedwoods' })).toThrow(/fog/);
    expect(() => dispatch(s, { type: 'forage', zone: 'oldgrowth' })).toThrow(/Lantern/);
    s.gear.push('trailmap');
    expect(() => dispatch(s, { type: 'forage', zone: 'burnscar' })).not.toThrow();
    s.round = 4;
    expect(() => dispatch(s, { type: 'forage', zone: 'burnscar' })).toThrow(/spring/);
  });
});

describe('identify and plant', () => {
  it('identifies the whole basket for one action', () => {
    let s = blank('all');
    s.basket = [
      { uid: 1, species: 'puffball', identified: false, trip: 1 },
      { uid: 2, species: 'oyster', identified: true, trip: 1 },
      { uid: 3, species: 'shiitake', identified: false, trip: 1 },
      { uid: 4, species: 'winecap', identified: false, trip: 1 },
    ];
    const r = dispatch(s, { type: 'identify' });
    if (r.result.kind !== 'identify') throw new Error();
    expect(r.result.results.map((x) => x.uid)).toEqual([1, 3, 4]);
    expect(r.state.actionsLeft).toBe(3);
    expect(r.state.basket.every((b) => b.identified)).toBe(true);
    const fakes = r.result.results.filter((x) => !x.real).length;
    expect(r.state.basket).toHaveLength(4 - fakes);
    expect(r.state.shed.filter((x) => x === 'compost')).toHaveLength(fakes);
    expect(() => dispatch(r.state, { type: 'identify' })).toThrow(/Nothing in your basket/);
  });

  it('turns a lookalike into compost and a real find into a plantable specimen', () => {
    let s = blank('id');
    s.basket = [{ uid: 1, species: 'puffball', identified: false, trip: 1 }];
    s.nextUid = 2;
    // Try seeds until we see both outcomes for the puffball.
    const outcomes = new Set<boolean>();
    for (let seed = 0; seed < 50 && outcomes.size < 2; seed++) {
      const r = dispatch({ ...s, rng: seed }, { type: 'identify' });
      if (r.result.kind !== 'identify') throw new Error();
      const [one] = r.result.results;
      outcomes.add(one.real);
      if (!one.real) {
        expect(one.kept).toBe(1);
        expect(r.state.shed).toEqual(['compost']);
        expect(r.state.basket).toHaveLength(0);
      } else {
        expect(r.state.basket[0].identified).toBe(true);
        expect(r.state.discovered).toContain('puffball');
      }
    }
    expect(outcomes.size).toBe(2);
  });

  it('sends identified wild mushrooms straight to storage', () => {
    const s = blank('w');
    s.basket = [{ uid: 1, species: 'chanterelle', identified: false, trip: 1 }];
    for (let seed = 0; seed < 50; seed++) {
      const r = dispatch({ ...s, rng: seed }, { type: 'identify' });
      if (r.result.kind === 'identify' && r.result.results[0].real) {
        expect(r.state.storage.chanterelle).toBe(1);
        expect(r.state.basket).toHaveLength(0);
        return;
      }
    }
    throw new Error('never identified');
  });

  it('plants only on a matching empty substrate', () => {
    let s = blank('p');
    s.grid[5].substrate = 'log';
    s.grid[6].substrate = 'straw';
    s.basket = [{ uid: 1, species: 'shiitake', identified: true, trip: 1 }];
    expect(() => dispatch(s, { type: 'plant', uid: 1, square: 6 })).toThrow(GameError);
    s = run(s, { type: 'plant', uid: 1, square: 5 });
    expect(s.grid[5]).toMatchObject({ species: 'shiitake', stage: 'S' });
    expect(s.planted).toEqual(['shiitake']);
  });

  it('places shed substrate on empty ground for free', () => {
    let s = blank('sub');
    s.shed = ['woodchip'];
    s = run(s, { type: 'placeSubstrate', index: 0, square: 0 });
    expect(s.grid[0].substrate).toBe('woodchip');
    expect(s.actionsLeft).toBe(4);
    expect(() => dispatch(s, { type: 'placeSubstrate', index: 0, square: 2 })).toThrow(GameError);
  });
});

describe('compost pile', () => {
  const per = content.rules.scrapsPerCompost;
  const scraps = (n: number, start = 1) =>
    Array.from({ length: n }, (_, i) => ({ uid: start + i, species: ['oyster', 'puffball', 'shiitake'][i % 3], identified: i % 2 === 0, trip: 1 }));

  it('puts composted specimens on the pile, and a full pile rots into a Compost tile overnight', () => {
    let s = blank('pile');
    s.basket = scraps(per + 1);
    for (const b of s.basket.slice()) s = run(s, { type: 'discard', uid: b.uid });
    expect(s.basket).toHaveLength(0);
    expect(s.compostPile).toHaveLength(per + 1);
    expect(s.actionsLeft).toBe(4);
    s = run(s, { type: 'endWeek' });
    expect(s.shed).toEqual(['compost']);
    expect(s.compostPile).toHaveLength(1);
    expect(s.night!.events).toContainEqual({ type: 'compost', tiles: 1 });
    expect(s.stats).toMatchObject({ scraps: per + 1, compostTiles: 1 });
  });

  it('overripe fruit goes on the pile', () => {
    const s = blank('ripe');
    s.watered = true;
    bed(s, 0, 'oyster', 'F');
    grow(s);
    expect(s.compostPile).toEqual(['oyster']);
    expect(s.stats.scraps).toBe(1);
  });

  it('stock that spoils at the season change goes on the pile and rots the same night', () => {
    let s = blank('spoilpile');
    s.round = 3;
    s.storage = { oyster: per, shiitake: 1 };
    s = run(s, { type: 'endWeek' });
    expect(s.storage).toEqual({});
    expect(s.shed).toEqual(['compost']);
    expect(s.compostPile).toHaveLength(1);
    const kinds = s.night!.events.map((e) => e.type);
    expect(kinds.indexOf('spoil')).toBeLessThan(kinds.indexOf('compost'));
  });

  it('a pile short of a full tile waits for more', () => {
    let s = blank('short');
    s.basket = scraps(per - 1);
    for (const b of s.basket.slice()) s = run(s, { type: 'discard', uid: b.uid });
    s = run(s, { type: 'endWeek' });
    expect(s.shed).toEqual([]);
    expect(s.compostPile).toHaveLength(per - 1);
    expect(s.night!.events.some((e) => e.type === 'compost')).toBe(false);
  });
});

describe('growth phase', () => {
  it('grows fast, medium, slow and very slow species at their own pace', () => {
    const s = blank();
    s.round = 4; // summer
    s.watered = true;
    bed(s, 0, 'puffball');
    bed(s, 4, 'reishi');
    bed(s, 8, 'winecap');
    bed(s, 12, 'oyster');
    s.round = 7; // fall for shiitake and lion's mane
    bed(s, 1, 'shiitake');
    bed(s, 3, 'lionsmane'); // beside the tree at 2
    const stages: string[][] = [];
    for (let i = 0; i < 6; i++) {
      grow(s);
      s.watered = true;
      for (const sq of s.grid) if (sq.stage === 'F') sq.stage = 'C'; // harvest each week
      stages.push([1, 3, 12].map((n) => s.grid[n].stage!));
    }
    // shiitake: S→C, C (slow), P, F; lion's mane: S→C→P→F; oyster: S→C→F
    expect(stages.slice(0, 3).map((r) => r[0])).toEqual(['C', 'C', 'P']);
    expect(stages.slice(0, 2).map((r) => r[1])).toEqual(['C', 'P']);
    expect(stages[0][2]).toBe('C');
  });

  it('holds very slow Reishi two phases at C and two at P', () => {
    const s = blank();
    s.round = 4;
    bed(s, 0, 'reishi', 'C', 'log');
    const seen = [];
    for (let i = 0; i < 5; i++) {
      s.watered = true;
      grow(s);
      seen.push(s.grid[0].stage);
    }
    expect(seen).toEqual(['C', 'P', 'P', 'F', 'C']);
  });

  it('waits out of season, out of shade and in a cold snap; the tent ignores season and cold', () => {
    const s = blank();
    s.round = 1; // spring
    s.watered = true;
    bed(s, 0, 'puffball', 'C'); // summer–fall
    bed(s, 12, 'lionsmane', 'C', 'log'); // fall, unshaded
    bed(s, 4, 'puffball', 'C');
    s.grid[4].tent = true;
    grow(s);
    expect(s.grid[0].stage).toBe('C');
    expect(s.grid[4].stage).toBe('F');
    const cold = blank();
    cold.round = 10;
    cold.weather = 'coldsnap';
    cold.watered = true;
    bed(cold, 0, 'oyster', 'C');
    bed(cold, 4, 'enoki', 'C', 'log');
    grow(cold);
    expect(cold.grid[0].stage).toBe('C');
    expect(cold.grid[4].stage).toBe('P');
  });

  it('rain grows two stages and prevents dry marks', () => {
    const s = blank();
    s.weather = 'rain';
    bed(s, 1, 'oyster', 'S');
    grow(s);
    expect(s.grid[1]).toMatchObject({ stage: 'F', dry: 0 });
  });

  it('a dry spell stalls everything unless you tend', () => {
    const s = blank();
    s.weather = 'dryspell';
    bed(s, 0, 'oyster', 'S');
    grow(s);
    expect(s.grid[0].stage).toBe('S');
    s.watered = true;
    grow(s);
    expect(s.grid[0].stage).toBe('C');
  });

  it('dry marks outside the stream build to blight on beds that are not growing', () => {
    const s = blank();
    s.round = 1;
    bed(s, 0, 'puffball', 'C'); // stream column, out of season
    bed(s, 1, 'puffball', 'C'); // out of season
    grow(s);
    expect(s.grid[0].dry).toBe(0);
    expect(s.grid[1]).toMatchObject({ dry: 1, blight: false });
    grow(s);
    expect(s.grid[1]).toMatchObject({ dry: 2, blight: true });
  });

  it('frost oyster blights after one dry mark', () => {
    const s = blank();
    s.round = 4;
    bed(s, 1, 'frostoyster', 'F');
    grow(s);
    expect(s.grid[1].blight).toBe(true);
  });

  it('crowding blights and blight spreads to same-species neighbors', () => {
    const s = blank();
    s.watered = true;
    // A plus of oysters: the centre touches 4 of its own kind.
    for (const i of [5, 1, 4, 6, 9]) bed(s, i, 'oyster', 'S');
    s.grid[9].tree = false;
    const report = grow(s);
    expect(s.grid[5].blight).toBe(true);
    expect([1, 4, 6, 9].every((i) => s.grid[i].blight)).toBe(true);
    expect(report.events.some((e) => e.type === 'moldBloom')).toBe(true);
    expect(s.moldPenalty).toBe(1);
  });

  it('overripe beds drop back to C without a harvest', () => {
    const s = blank();
    s.watered = true;
    bed(s, 0, 'oyster', 'F');
    grow(s);
    expect(s.grid[0].stage).toBe('C');
  });

  it('spreaders colonize empty matching substrate; wine cap takes over puffball', () => {
    const s = blank();
    s.round = 4;
    s.watered = true;
    bed(s, 0, 'oyster', 'C');
    s.grid[1].substrate = 'straw';
    s.grid[4].substrate = 'log';
    grow(s);
    expect(s.grid[1]).toMatchObject({ species: 'oyster', stage: 'C' });
    expect(s.grid[4].species).toBeNull();

    const w = blank();
    w.round = 4;
    w.watered = true;
    bed(w, 12, 'winecap', 'C');
    bed(w, 13, 'puffball', 'S');
    grow(w);
    expect(w.grid[13].species).toBe('winecap');
  });

  it('ember puff eats adjacent empty compost', () => {
    const s = blank();
    s.round = 4;
    s.watered = true;
    bed(s, 12, 'emberpuff', 'C', 'compost');
    s.grid[13].substrate = 'compost';
    grow(s);
    expect(s.grid[13].substrate).toBeNull();
  });

  it('offers hybrids for compatible neighbors and resolves them', () => {
    let s = blank();
    s.round = 7;
    s.watered = true;
    bed(s, 4, 'oyster', 'C', 'straw');
    bed(s, 5, 'lionsmane', 'C', 'log');
    s.night = grow(s);
    expect(s.pendingCrosses).toEqual([{ a: 4, b: 5, hybrid: 'shaggyoyster' }]);
    expect(() => dispatch(s, { type: 'water' })).toThrow(/hybrids/);
    s = run(s, { type: 'resolveCross', index: 0, replace: 'b' });
    expect(s.grid[5]).toMatchObject({ species: 'shaggyoyster', stage: 'C', substrate: 'log' });
    expect(s.hybridsMade).toEqual(['shaggyoyster']);
    expect(score(s).hybrids).toBe(3);
  });

  it('does not re-offer a declined cross', () => {
    let s = blank();
    s.round = 10;
    s.watered = true;
    bed(s, 4, 'oyster', 'C', 'straw');
    bed(s, 5, 'enoki', 'C', 'log');
    grow(s);
    expect(s.pendingCrosses).toHaveLength(1);
    s = run(s, { type: 'resolveCross', index: 0, replace: null });
    grow(s);
    expect(s.pendingCrosses).toHaveLength(0);
  });
});

describe('market and orders', () => {
  it('charges one action per market visit', () => {
    let s = blank('m');
    s.storage = { oyster: 5, shiitake: 1 };
    s = run(s, { type: 'sell', species: 'oyster', count: 2 }, { type: 'sell', species: 'shiitake', count: 1 });
    expect(s.actionsLeft).toBe(3);
    expect(s.coins).toBe(3 + 2 + 3);
    s = run(s, { type: 'leaveMarket' }, { type: 'sell', species: 'oyster', count: 1 });
    expect(s.actionsLeft).toBe(2);
  });

  it('market day adds a coin per sale', () => {
    let s = blank('md');
    s.weather = 'marketday';
    s.storage = { reishi: 1 };
    s = run(s, { type: 'sell', species: 'reishi', count: 1 });
    expect(s.coins).toBe(3 + 5);
  });

  it('fills one order per visit and refills the board', () => {
    let s = blank('o');
    s.orders = { visible: ['o-oyster3', 'o-hyb2', 'o-four'], deck: ['o-lion2'], filled: [] };
    s.storage = { oyster: 3, shaggyoyster: 1, frostoyster: 2, puffball: 1, winecap: 1 };
    s = run(s, { type: 'fillOrder', order: 'o-oyster3' });
    expect(s.orderPoints).toBe(4);
    expect(s.orders.visible).toEqual(['o-hyb2', 'o-four', 'o-lion2']);
    expect(() => dispatch(s, { type: 'fillOrder', order: 'o-hyb2' })).toThrow(/One order/);
    s = run(s, { type: 'leaveMarket' }, { type: 'fillOrder', order: 'o-hyb2' });
    // Cheapest hybrids first: both Frost Oysters (value 2) before the Shaggy Oyster (3).
    expect(s.storage).toEqual({ shaggyoyster: 1, puffball: 1, winecap: 1 });
  });

  it('works out payment for "different species" orders', () => {
    const order = content.orders.find((o) => o.id === 'o-four')!;
    expect(orderPayment({ oyster: 2, reishi: 1, puffball: 1 }, order)).toBeNull();
    expect(orderPayment({ oyster: 2, reishi: 1, puffball: 1, enoki: 1 }, order)).toEqual({ oyster: 1, puffball: 1, enoki: 1, reishi: 1 });
  });

  it('buys each gear once', () => {
    let s = blank('g');
    s.coins = 20;
    s = run(s, { type: 'buyGear', gear: 'biggerbasket' });
    expect(() => dispatch(s, { type: 'buyGear', gear: 'biggerbasket' })).toThrow(/already/);
    expect(s.coins).toBe(16);
  });
});

describe('the year', () => {
  it('spoils storage at season change unless you own a dehydrator', () => {
    let s = blank('spoil');
    s.round = 3;
    s.storage = { oyster: 2 };
    s = run(s, { type: 'endWeek' });
    expect(s.round).toBe(4);
    expect(s.storage).toEqual({});
    expect(s.night!.events.some((e) => e.type === 'spoil')).toBe(true);
    let d = blank('dry');
    d.round = 3;
    d.gear.push('dehydrator');
    d.storage = { oyster: 2 };
    d = run(d, { type: 'endWeek' });
    expect(d.storage).toEqual({ oyster: 2 });
  });

  it('mold bloom costs an action next week', () => {
    let s = blank('mold');
    for (const i of [0, 1, 3]) {
      bed(s, i, 'oyster', 'C');
      s.grid[i].blight = true;
    }
    s = run(s, { type: 'endWeek' });
    expect(s.actionsLeft).toBe(3);
  });

  it('ends after round 12 with the festival, and scores a tier', () => {
    let s = blank('end');
    s.round = 12;
    s.orderPoints = 20;
    s.hybridsMade = ['shaggyoyster'];
    s.planted = ['shiitake', 'reishi'];
    s.coins = 8;
    s = run(s, { type: 'endWeek' });
    expect(s.over).toBe(false);
    expect(s.finale).toEqual({ harvested: false, marketed: false });
    s = run(s, { type: 'dismissNight' }, { type: 'festival' });
    expect(s).toMatchObject({ over: true, finale: null });
    expect(score(s)).toMatchObject({ coins: 2, total: 27, tier: { id: 'silver' } });
    expect(() => dispatch(s, { type: 'water' })).toThrow(/over/);
  });

  describe('festival morning', () => {
    /** The morning after week 12, with a fruiting bed and an order the harvest can fill. */
    function morning() {
      let s = blank('morning');
      s.round = 12;
      s.watered = true;
      bed(s, 4, 'oyster', 'C', 'straw');
      bed(s, 8, 'oyster', 'C', 'straw');
      s.storage = { oyster: 1 };
      s.orders = { visible: ['o-oyster3'], deck: [], filled: [] };
      s = run(s, { type: 'endWeek' }, { type: 'dismissNight' });
      expect(s.grid[4].stage).toBe('F');
      return s;
    }

    it('allows one free harvest and one free market visit', () => {
      let s = morning();
      s = run(s, { type: 'harvest' });
      expect(s.storage.oyster).toBe(3);
      expect(s.finale!.harvested).toBe(true);
      s = run(s, { type: 'fillOrder', order: 'o-oyster3' });
      expect(s.orderPoints).toBe(4);
      s.storage = { oyster: 1 };
      s = run(s, { type: 'sell', species: 'oyster', count: 1 }, { type: 'leaveMarket' });
      expect(s.coins).toBe(3 + 1);
      s.storage = { oyster: 1 };
      expect(() => dispatch(s, { type: 'sell', species: 'oyster', count: 1 })).toThrow(/last market visit/);
      Object.assign(s.grid[4], { stage: 'F' });
      expect(() => dispatch(s, { type: 'harvest' })).toThrow(/last harvest/);
    });

    it('allows nothing else, and sells no gear', () => {
      const s = morning();
      s.coins = 20;
      s.basket = [{ uid: 1, species: 'oyster', identified: false, trip: 1 }];
      for (const a of [
        { type: 'forage', zone: 'meadow' },
        { type: 'identify' },
        { type: 'water' },
        { type: 'endWeek' },
      ] as Action[])
        expect(() => dispatch(s, a)).toThrow(/festival morning/);
      expect(() => dispatch(s, { type: 'buyGear', gear: 'knife' })).toThrow(/gear on festival day/);
    });

    it('lets you make a hybrid offered on the last night before the festival', () => {
      let s = blank('lastcross');
      s.round = 12;
      s.watered = true;
      bed(s, 4, 'oyster', 'C', 'straw');
      bed(s, 5, 'enoki', 'C', 'log');
      s = run(s, { type: 'endWeek' }, { type: 'dismissNight' });
      expect(s.pendingCrosses).toHaveLength(1);
      expect(() => dispatch(s, { type: 'festival' })).toThrow(/hybrids/);
      s = run(s, { type: 'resolveCross', index: 0, replace: 'b' }, { type: 'festival' });
      expect(s.hybridsMade).toEqual(['frostoyster']);
      expect(score(s).hybrids).toBe(3);
    });
  });

  it('a whole year plays out without illegal moves across many seeds', () => {
    for (let i = 0; i < 60; i++) {
      const end = playYear(newGame({ seed: `fuzz-${i}` }), { greed: 2 + (i % 4) });
      expect(end.over).toBe(true);
      expect(end.round).toBe(12);
    }
  });
});

describe('journal', () => {
  it('collects discoveries across years and reports what is new', () => {
    const s = blank('j');
    s.discovered = ['oyster', 'puffball'];
    s.hybridsMade = ['frostoyster'];
    const first = mergeDiscoveries(emptyJournal(), s);
    expect(first.fresh).toEqual(['oyster', 'puffball', 'hybrid:frostoyster']);
    const again = mergeDiscoveries(first.journal, s);
    expect(again.fresh).toEqual([]);
    s.over = true;
    const j = recordYear(recordYear(first.journal, s), s);
    expect(j.years).toHaveLength(1);
  });
});
