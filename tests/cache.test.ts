import { describe, expect, it } from 'vitest';
import {
  content,
  digStatus,
  dispatch,
  emptyJournal,
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

const run = (s: GameState, ...actions: Action[]) => {
  for (const a of actions) s = dispatch(s, a).state;
  return s;
};

const yew: Card = { type: 'ground', name: 'Yew', look: 'tree' };
const winter = 10;
const fall = 7;

/** A story year for a second-generation homestead with this cabinet, out in a zone in this month, the compass in hand. */
function year(artifacts: string[] = ['droverspenny'], seed = 'cache'): GameState {
  const s = newGame({ seed, perks: perksFor({ ...emptyJournal(), generation: 2, artifacts }, []) });
  s.weather = 'clear';
  s.gear.push('compass');
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
    expect(result).toEqual({ kind: 'dig', found: true });
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
    expect(result).toEqual({ kind: 'dig', found: false });
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

  it('needs a clue first, a story year, and a cellar not yet found', () => {
    // No artifact in the cabinet or brought home this year: nothing to go on.
    let s = setOut(year([]), 'hollow', winter, yew);
    s = run(s, { type: 'flip', index: 0 });
    expect(digStatus(s, 0)).toEqual({ open: false, reason: 'Nothing to go on yet.' });
    s.artifacts.push('droverspenny');
    expect(digStatus(s, 0).open).toBe(true);

    const daily = newGame({ mode: 'daily', seed: 'cache-daily', perks: { ...standardPerks(), clues: 3 } });
    daily.weather = 'clear';
    daily.gear.push('compass');
    let d = setOut(daily, 'hollow', winter, yew);
    d = run(d, { type: 'flip', index: 0 });
    expect(digStatus(d, 0).open).toBe(false);

    const j = { ...emptyJournal(), generation: 2, artifacts: ['droverspenny'], cacheFound: true };
    const done = newGame({ seed: 'cache-done', perks: perksFor(j, []) });
    done.weather = 'clear';
    done.gear.push('compass');
    let k = setOut(done, 'hollow', winter, yew);
    k = run(k, { type: 'flip', index: 0 });
    expect(digStatus(k, 0)).toEqual({ open: false, reason: "The family has already found the Founder's Cellar." });

    // And once found this year, there's no second dig.
    let t = setOut(year(), 'hollow', winter, yew);
    t = run(t, { type: 'flip', index: 0 }, { type: 'dig', index: 0 }, { type: 'closeTrip' });
    t = setOut(t, 'hollow', winter, yew);
    t = run(t, { type: 'flip', index: 0 });
    expect(digStatus(t, 0).open).toBe(false);
  });

  it('goes into the field journal for good, and down the generations', () => {
    let s = setOut(year(), 'hollow', winter, yew);
    s = run(s, { type: 'flip', index: 0 }, { type: 'dig', index: 0 });
    const j0 = { ...emptyJournal(), artifacts: ['droverspenny'] };
    const { journal, fresh } = mergeDiscoveries(j0, s);
    expect(journal.cacheFound).toBe(true);
    expect(fresh).toContain('cache:cellar');
    expect(mergeDiscoveries(journal, s).fresh).not.toContain('cache:cellar');
    expect(perksFor(journal, [])).toMatchObject({ clues: 1, cacheFound: true });
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
    expect(m.perks).toMatchObject({ clues: 0, cacheFound: false });
  });
});
