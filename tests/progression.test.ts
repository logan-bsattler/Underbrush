import { describe, expect, it } from 'vitest';
import {
  content,
  dispatch,
  emptyJournal,
  heirloomChoices,
  levelFor,
  masteryLevel,
  migrateState,
  newGame,
  normalizeJournal,
  perksFor,
  recordYear,
  saleValue,
  score,
  standardPerks,
  zoneStatus,
  type Card,
  type GameState,
  type Journal,
} from '../src/core';
import { runGrowth } from '../src/core/growth';
import { Rng } from '../src/core/rng';
import { playCampaign } from '../scripts/bot';

const journalAt = (renown: number, extra: Partial<Journal> = {}): Journal => ({ ...emptyJournal(), renown, ...extra });

function forageOne(s: GameState, zone: string, card: Card) {
  s.weather = 'clear';
  s.decks[zone].draw.unshift(card);
  s = dispatch(s, { type: 'forage', zone }).state;
  const r = dispatch(s, { type: 'flip', index: 0 });
  return { s: r.state, outcome: r.result.kind === 'draw' ? r.result.outcome : null };
}

describe('homestead levels', () => {
  it('maps renown to levels', () => {
    expect([0, 14, 15, 39, 40, 70, 209, 210, 999].map((r) => levelFor(r).level)).toEqual([1, 1, 2, 2, 3, 4, 6, 7, 7]);
  });

  it('starts a new homestead with the basic kit on a 4×4 farm', () => {
    const p = perksFor(emptyJournal(), ['lantern']);
    expect(p.shop.sort()).toEqual(['biggerbasket', 'dehydrator', 'fieldguide', 'knife']);
    expect(p).toMatchObject({ heirlooms: [], size: 4, bonusCoins: 0, bonusActions: 0 });
  });

  it('adds gear, heirloom slots, a bigger farm, coins and a farmhand as levels rise', () => {
    const owned = { gearOwned: ['knife', 'biggerbasket', 'lantern', 'dehydrator'] };
    expect(perksFor(journalAt(15, owned), ['knife', 'lantern']).heirlooms).toEqual(['knife']);
    expect(perksFor(journalAt(40, owned), []).shop).toContain('lantern');
    const grower = perksFor(journalAt(70, owned), []);
    expect(grower).toMatchObject({ size: 5, bonusCoins: 2 });
    const elder = perksFor(journalAt(210, owned), ['knife', 'biggerbasket', 'lantern', 'dehydrator']);
    expect(elder).toMatchObject({ size: 5, bonusActions: 1 });
    expect(elder.heirlooms).toHaveLength(3);
    expect(elder.shop).toHaveLength(content.gear.length);
  });

  it('only offers heirlooms you have owned that the shop stocks', () => {
    expect(heirloomChoices(journalAt(15, { gearOwned: ['lantern', 'knife'] }))).toEqual(['knife']);
  });
});

describe('a year with perks', () => {
  it('builds a 5×5 farm that keeps the 4×4 layout and adds a tree', () => {
    const s = newGame({ seed: 'big', perks: { ...standardPerks(), size: 5 } });
    expect(s.grid).toHaveLength(25);
    expect(s.grid.map((q, i) => (q.tree ? i : -1)).filter((i) => i >= 0)).toEqual([2, 11, 23]);
    expect(s.grid[5]).toMatchObject({ species: 'oyster', substrate: 'straw' });
    expect(s.grid[10].substrate).toBe('straw');
    expect([6, 7].map((i) => s.grid[i].substrate)).toEqual(['log', 'log']);
  });

  it('grows and spreads across the wider farm edges', () => {
    const s = newGame({ seed: 'edge', perks: { ...standardPerks(), size: 5 } });
    s.watered = true;
    Object.assign(s.grid[24], { substrate: 'straw', species: 'oyster', stage: 'C' });
    s.grid[19].substrate = 'straw';
    runGrowth(s, new Rng(3), content);
    expect(s.grid[24].stage).toBe('F');
    expect(s.grid[19].species).toBe('oyster');
  });

  it('starts with heirlooms, bonus coins and the farmhand', () => {
    const s = newGame({ seed: 'p', perks: { ...standardPerks(), heirlooms: ['knife'], bonusCoins: 2, bonusActions: 1 } });
    expect(s).toMatchObject({ gear: ['knife'], coins: 5, actionsLeft: 5 });
    const next = dispatch({ ...s, actionsLeft: 0 }, { type: 'endWeek' }).state;
    expect(next.actionsLeft).toBe(5);
  });

  it("won't sell gear the shop doesn't stock, and says why a zone is shut", () => {
    const s = newGame({ seed: 'shop', perks: perksFor(emptyJournal(), []) });
    s.coins = 20;
    expect(() => dispatch(s, { type: 'buyGear', gear: 'lantern' })).toThrow(/doesn't stock/);
    const status = zoneStatus(s, content.zones.find((z) => z.id === 'oldgrowth')!);
    expect(status).toMatchObject({ open: false, notStocked: true });
  });
});

describe('species mastery', () => {
  it('levels at 3, 8 and 16 identifications', () => {
    expect([0, 2, 3, 7, 8, 15, 16].map((n) => masteryLevel(n))).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it('Familiar: a cultivated species is never a lookalike', () => {
    const s = newGame({ seed: 'fam', perks: { ...standardPerks(), mastery: { puffball: 1 } } });
    s.basket = [{ uid: 1, species: 'puffball', identified: false, trip: 1 }];
    for (let seed = 0; seed < 40; seed++) {
      const r = dispatch({ ...s, rng: seed }, { type: 'identify' });
      expect(r.result.kind === 'identify' && r.result.results[0].real).toBe(true);
    }
  });

  it('Expert: specimens come home identified, wild ones straight to storage', () => {
    const perks = { ...standardPerks(), mastery: { oyster: 2, chanterelle: 2 } };
    const a = forageOne(newGame({ seed: 'e1', perks }), 'mixedwoods', { type: 'specimen', species: 'oyster' });
    expect(a.outcome).toBe('known');
    expect(a.s.basket[0]).toMatchObject({ species: 'oyster', identified: true });
    expect(a.s.stats.identified.oyster).toBe(1);
    const summer = newGame({ seed: 'e2', perks });
    summer.round = 4;
    const b = forageOne(summer, 'mixedwoods', { type: 'specimen', species: 'chanterelle' });
    expect(b.outcome).toBe('known');
    expect(b.s.storage.chanterelle).toBe(1);
    expect(b.s.basket).toHaveLength(0);
  });

  it('Master: sells for a coin more', () => {
    const s = newGame({ seed: 'm', perks: { ...standardPerks(), mastery: { shiitake: 3 } } });
    s.weather = 'clear';
    expect(saleValue(s, 'shiitake')).toBe(4);
    expect(saleValue(s, 'oyster')).toBe(1);
  });
});

describe('recording a year', () => {
  function finished(seed: string, patch: Partial<GameState>) {
    const s = newGame({ seed });
    return { ...s, over: true, ...patch } as GameState;
  }

  it('turns the festival score into renown, once per seed', () => {
    const s = finished('r1', { orderPoints: 20, coins: 0, gear: ['knife'], stats: { ...newGame().stats, identified: { oyster: 3 } } });
    const j = recordYear(emptyJournal(), s);
    expect(j.renown).toBe(score(s).total);
    expect(j.years[0]).toMatchObject({ renown: 20, levelFrom: 1, levelTo: 2, masteryUps: ['oyster'] });
    expect(j.gearOwned).toEqual(['knife']);
    expect(j.idCounts).toEqual({ oyster: 3 });
    expect(recordYear(j, s)).toEqual(j);
  });

  it('brings old saves and journals up to date', () => {
    const old = newGame({ seed: 'old' }) as any;
    delete old.size;
    delete old.perks;
    delete old.stats.identified;
    delete old.compostPile;
    const s = migrateState(old);
    expect(s).toMatchObject({ size: 4, perks: standardPerks(), compostPile: [] });
    expect(dispatch(s, { type: 'water' }).state.watered).toBe(true);
    const j = normalizeJournal({ discovered: ['oyster'], years: [{ seed: 'x', score: 12 } as any] });
    expect(j).toMatchObject({ renown: 0, idCounts: {}, gearOwned: [], discovered: ['oyster'] });
    expect(j.years[0]).toMatchObject({ seed: 'x', levelFrom: 1, masteryUps: [] });
  });

  it('plays multi-year campaigns without illegal moves, banking every score', () => {
    for (let i = 0; i < 6; i++) {
      const { journal, games } = playCampaign(4, `c-${i}`, emptyJournal());
      expect(journal.renown).toBe(games.reduce((n, g) => n + score(g).total, 0));
      expect(journal.years).toHaveLength(4);
    }
  });
});
