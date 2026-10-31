import { describe, expect, it } from 'vitest';
import {
  cacheMarks,
  cellarReady,
  content,
  digStatus,
  dispatch,
  emptyJournal,
  gearUnlockLevel,
  mergeDiscoveries,
  migrateState,
  newGame,
  passItOn,
  perksFor,
  score,
  standardPerks,
  type Action,
  type Card,
  type GameState,
} from '../src/core';
import { plainRules } from './plain';

plainRules();

const run = (s: GameState, ...actions: Action[]) => {
  for (const a of actions) s = dispatch(s, a).state;
  return s;
};

const yew: Card = { type: 'ground', name: 'Yew', look: 'tree' };
const oak: Card = { type: 'ground', name: 'Oak', look: 'tree' };
/** One mark each for the tree, the place and the season: enough to open the cellar. */
const enough = ['droverspenny', 'sixpence', 'guinea'];
/** Content where a dig under oak or hazel in season always turns up a truffle. */
const sure = { ...content, rules: { ...content.rules, dig: { ...content.rules.dig, chance: 1 } } };
const winter = 10;
const fall = 7;

/** A story year for a second-generation homestead with this cabinet, the compass and the spade in hand. */
function year(artifacts: string[] = enough, seed = 'cache'): GameState {
  const s = newGame({ seed, perks: perksFor({ ...emptyJournal(), generation: 2, artifacts }, []) });
  s.weather = 'clear';
  s.gear.push('compass', 'spade');
  return s;
}

/** Sets out into a zone with these cards on top of its deck, so they're dealt into the first patch in order. */
function setOut(s: GameState, zone: string, round: number, ...top: Card[]): GameState {
  s.round = round;
  const deck = s.decks[zone];
  for (const card of top.slice().reverse()) {
    const at = deck.draw.findIndex((d) => JSON.stringify(d) === JSON.stringify(card));
    deck.draw.unshift(at >= 0 ? deck.draw.splice(at, 1)[0] : card);
  }
  return run(s, { type: 'forage', zone });
}

describe("the Founder's Cellar", () => {
  it('is written down: every artifact carries an inscription, and the cache points at a real ground card', () => {
    expect(content.artifacts.every((a) => a.inscription)).toBe(true);
    const zone = content.zones.find((z) => z.id === content.cache.zone)!;
    expect(zone.deck.some((e) => e.card.type === 'ground' && e.card.name === content.cache.card)).toBe(true);
    expect(zone.seasons).toContain(content.cache.season);
  });

  it('opens under the Yew in the Hollow in winter: the trip ends, and it scores', () => {
    let s = setOut(year(), 'hollow', winter, yew);
    s = run(s, { type: 'flip', index: 0 });
    expect(digStatus(s, 0)).toEqual({ open: true });
    const before = score(s).total;
    const { state, result } = dispatch(s, { type: 'dig', index: 0 });
    expect(result).toEqual({ kind: 'dig', dug: 'found' });
    expect(state.forage!.status).toBe('stopped');
    expect(state.forage!.dug).toBe('found');
    expect(state.cacheFound).toBe(true);
    expect(score(state).cache).toBe(content.cache.points);
    expect(score(state).total).toBe(before + content.cache.points);
  });

  it('turns up nothing in the wrong spot, or the right spot out of season: the trip ends, finds kept, no bust', () => {
    let s = setOut(year(), 'meadow', winter, { type: 'specimen', species: 'winecap' }, { type: 'ground', name: 'Hawthorn', look: 'tree' });
    s = run(s, { type: 'flip', index: 0 }, { type: 'flip', index: 1 });
    expect(s.basket).toHaveLength(1);
    const { state, result } = dispatch(s, { type: 'dig', index: 1 });
    expect(result).toEqual({ kind: 'dig', dug: 'empty' });
    expect(state.forage!.status).toBe('stopped');
    expect(state.forage!.dug).toBe('empty');
    expect(state.basket).toHaveLength(1);
    expect(state.stats.busts).toBe(0);
    expect(state.cacheFound).toBe(false);
    expect(score(state).cache).toBe(0);
    // Every card goes back into the deck, as when you head home.
    expect(state.decks.meadow.discard).toHaveLength(0);

    let f = setOut(year(), 'hollow', fall, yew);
    f = run(f, { type: 'flip', index: 0 }, { type: 'dig', index: 0 });
    expect(f.forage!.dug).toBe('empty');
    expect(f.cacheFound).toBe(false);
  });

  it('brings an artifact pocketed this trip home with it', () => {
    let s = setOut(year(), 'hollow', winter, yew);
    s.forage!.relics.push({ uid: 999, artifact: 'guinea' });
    s = run(s, { type: 'flip', index: 0 }, { type: 'dig', index: 0 });
    expect(s.artifacts).toContain('guinea');
  });

  it('only digs a turned ground card on the surface, mid-trip', () => {
    let s = setOut(year(), 'hollow', winter, yew, { type: 'coins', amount: 1 });
    expect(digStatus(s, 0).open).toBe(false);
    expect(() => dispatch(s, { type: 'dig', index: 0 })).toThrow(/turned card of plain ground/);
    s = run(s, { type: 'flip', index: 0 }, { type: 'flip', index: 1 });
    expect(digStatus(s, 1).open).toBe(false);
    s.forage!.layer = 1;
    expect(digStatus(s, 0)).toEqual({ open: false, reason: 'Dig on the surface, not below it.' });
    s.forage!.layer = 0;
    s = run(s, { type: 'stopForage' });
    expect(() => dispatch(s, { type: 'dig', index: 0 })).toThrow(/not out foraging/);
  });

  it('needs a spade', () => {
    let s = setOut(year(), 'hollow', winter, yew);
    s.gear = s.gear.filter((g) => g !== 'spade');
    s = run(s, { type: 'flip', index: 0 });
    expect(digStatus(s, 0)).toEqual({ open: false, reason: 'You need a Spade to dig.' });
    s.gear.push('spade');
    expect(digStatus(s, 0)).toEqual({ open: true });
  });

  it("can't be found by accident: the marks must point to the tree, the place and the season", () => {
    // Two of the three: the right spot is just ground.
    let s = setOut(year(['droverspenny', 'sixpence']), 'hollow', winter, yew);
    s = run(s, { type: 'flip', index: 0 });
    expect(cacheMarks(s)).toEqual(['tree', 'place']);
    expect(cellarReady(s)).toBe(false);
    const { state, result } = dispatch(s, { type: 'dig', index: 0 });
    expect(result).toEqual({ kind: 'dig', dug: 'empty' });
    expect(state.cacheFound).toBe(false);
    // A mark brought home this year counts as soon as it's home.
    s.artifacts.push('guinea');
    expect(cellarReady(s)).toBe(true);
    expect(dispatch(s, { type: 'dig', index: 0 }).result).toEqual({ kind: 'dig', dug: 'found' });
  });

  it('opens only in a story year, and only once', () => {
    const daily = newGame({ mode: 'daily', seed: 'cache-daily', perks: { ...standardPerks(), clues: enough } });
    daily.weather = 'clear';
    daily.gear.push('compass', 'spade');
    let d = setOut(daily, 'hollow', winter, yew);
    d = run(d, { type: 'flip', index: 0 });
    expect(cellarReady(d)).toBe(false);
    expect(dispatch(d, { type: 'dig', index: 0 }).result).toEqual({ kind: 'dig', dug: 'empty' });

    const j = { ...emptyJournal(), generation: 2, artifacts: enough, cacheFound: true };
    const done = newGame({ seed: 'cache-done', perks: perksFor(j, []) });
    done.weather = 'clear';
    done.gear.push('compass', 'spade');
    let k = setOut(done, 'hollow', winter, yew);
    k = run(k, { type: 'flip', index: 0 });
    expect(cellarReady(k)).toBe(false);
    expect(dispatch(k, { type: 'dig', index: 0 }).result).toEqual({ kind: 'dig', dug: 'empty' });

    // And once found this year, a second dig there finds only earth.
    let t = setOut(year(), 'hollow', winter, yew);
    t = run(t, { type: 'flip', index: 0 }, { type: 'dig', index: 0 }, { type: 'closeTrip' });
    t = setOut(t, 'hollow', winter, yew);
    t = run(t, { type: 'flip', index: 0 });
    expect(dispatch(t, { type: 'dig', index: 0 }).result).toEqual({ kind: 'dig', dug: 'empty' });
  });

  it('goes into the field journal for good, and down the generations', () => {
    let s = setOut(year(), 'hollow', winter, yew);
    s = run(s, { type: 'flip', index: 0 }, { type: 'dig', index: 0 });
    const j0 = { ...emptyJournal(), artifacts: enough };
    const { journal, fresh } = mergeDiscoveries(j0, s);
    expect(journal.cacheFound).toBe(true);
    expect(fresh).toContain('cache:cellar');
    expect(mergeDiscoveries(journal, s).fresh).not.toContain('cache:cellar');
    expect(perksFor(journal, [])).toMatchObject({ clues: enough, cacheFound: true });
    const legend = { ...journal, renown: 1e6 };
    expect(passItOn(legend).cacheFound).toBe(true);
  });

  it('brings older saves up to date', () => {
    const s = newGame({ seed: 'cache-old' }) as any;
    delete s.cacheFound;
    delete s.perks.clues;
    delete s.perks.cacheFound;
    const m = migrateState(s);
    expect(m.cacheFound).toBe(false);
    expect(m.perks).toMatchObject({ clues: [], cacheFound: false });
    // The cabinet used to be a count.
    const counted = newGame({ seed: 'cache-count' }) as any;
    counted.perks.clues = 3;
    expect(migrateState(counted).perks.clues).toEqual([]);
  });
});

describe('digging for truffles', () => {
  it('turns up a truffle under oak in winter, now and then: into the basket, and the trip ends', () => {
    let s = setOut(year([]), 'mixedwoods', winter, oak);
    s = run(s, { type: 'flip', index: 0 });
    const { state, result } = dispatch(s, { type: 'dig', index: 0 }, sure);
    expect(result).toMatchObject({ kind: 'dig', dug: 'truffle', outcome: 'basket' });
    expect(state.basket.map((b) => b.species)).toEqual(['truffle']);
    expect(state.forage!.status).toBe('stopped');
    expect(state.forage!.dug).toBe('truffle');
  });

  it('finds no truffle out of season, or under a tree truffles never grow by', () => {
    let fallDig = setOut(year([]), 'mixedwoods', fall, oak);
    fallDig = run(fallDig, { type: 'flip', index: 0 });
    expect(dispatch(fallDig, { type: 'dig', index: 0 }, sure).result).toEqual({ kind: 'dig', dug: 'empty' });

    let yewDig = setOut(year([]), 'hollow', winter, yew);
    yewDig = run(yewDig, { type: 'flip', index: 0 });
    expect(dispatch(yewDig, { type: 'dig', index: 0 }, sure).result).toEqual({ kind: 'dig', dug: 'empty' });
  });

  it("isn't a sure thing", () => {
    expect(content.rules.dig.chance).toBeGreaterThan(0);
    expect(content.rules.dig.chance).toBeLessThan(1);
    const finds = Array.from({ length: 40 }, (_, i) => {
      let s = setOut(year([], `truffle-${i}`), 'mixedwoods', winter, oak);
      s = run(s, { type: 'flip', index: 0 });
      return dispatch(s, { type: 'dig', index: 0 }).result;
    }).filter((r) => r.kind === 'dig' && r.dug === 'truffle').length;
    expect(finds).toBeGreaterThan(0);
    expect(finds).toBeLessThan(40);
  });

  it('leaves it behind when the basket is full of finds as good', () => {
    let s = setOut(year([]), 'mixedwoods', winter, oak);
    s = run(s, { type: 'flip', index: 0 });
    s.basket = Array.from({ length: 4 }, (_, i) => ({ uid: 900 + i, species: 'truffle', identified: false, trip: 0 }));
    const { state, result } = dispatch(s, { type: 'dig', index: 0 }, sure);
    expect(result).toMatchObject({ kind: 'dig', dug: 'noRoom', outcome: 'basketFull' });
    expect(state.basket).toHaveLength(4);
  });

  it('works in daily years too', () => {
    const daily = newGame({ mode: 'daily', seed: 'truffle-daily' });
    daily.weather = 'clear';
    daily.gear.push('spade');
    let d = setOut(daily, 'mixedwoods', winter, oak);
    d = run(d, { type: 'flip', index: 0 });
    expect(dispatch(d, { type: 'dig', index: 0 }, sure).result).toMatchObject({ kind: 'dig', dug: 'truffle' });
  });

  it('sells the spade in the shop from level 6, and every daily year', () => {
    expect(content.gear.some((g) => g.id === 'spade')).toBe(true);
    expect(standardPerks().shop).toContain('spade');
    expect(gearUnlockLevel('spade')?.level).toBe(6);
  });
});
