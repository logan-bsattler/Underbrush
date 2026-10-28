import { describe, expect, it } from 'vitest';
import {
  achievementProgress,
  achievementsEarned,
  artifactHome,
  basketCapacity,
  completedSets,
  content,
  descendStatus,
  dispatch,
  emptyJournal,
  generationLore,
  glints,
  layerDef,
  layerKey,
  layersOpen,
  mergeDiscoveries,
  migrateState,
  newGame,
  nextClue,
  normalizeJournal,
  passItOn,
  perksFor,
  score,
  standardPerks,
  type Action,
  type Card,
  type GameState,
  type Journal,
} from '../src/core';

const run = (s: GameState, ...actions: Action[]) => {
  for (const a of actions) s = dispatch(s, a).state;
  return s;
};

/** A story year for a homestead in this generation, with this cabinet. */
function year(generation: number, artifacts: string[] = [], seed = 'under'): GameState {
  const s = newGame({ seed, perks: perksFor({ ...emptyJournal(), generation, artifacts }, []) });
  s.weather = 'clear';
  return s;
}

const isWay = (p: { card: Card }) => p.card.type === 'entrance';

/** Walks the Meadow until the patch holds the way down, or to its last patch when there is none. */
function toWayPatch(s: GameState) {
  s = run(s, { type: 'forage', zone: 'meadow' });
  while (!s.forage!.patch.some(isWay) && s.decks.meadow.draw.length) s = run(s, { type: 'deeper' });
  return s;
}

/** Turns the way down in this patch. */
const turnWay = (s: GameState) => run(s, { type: 'flip', index: s.forage!.patch.findIndex(isWay) });

/** Walks the Meadow to the way down and turns it. */
const toWay = (s: GameState) => turnWay(toWayPatch(s));

const hazard: Card = { type: 'hazard', name: 'Cave-in' };
const shroom: Card = { type: 'specimen', species: 'earthstar' };

const set = (id: string) => content.artifacts.filter((a) => a.set === id).map((a) => a.id);

describe('the underground in data', () => {
  it('gives every zone its own layers, each with more hazards per card than the one above', () => {
    for (const z of content.zones) {
      const layers = content.underground[z.id];
      expect(layers?.length, z.id).toBeGreaterThan(0);
      const share = (deck: { card: Card; copies: number }[]) => {
        const all = deck.reduce((n, e) => n + e.copies, 0);
        return deck.filter((e) => e.card.type === 'hazard').reduce((n, e) => n + e.copies, 0) / all;
      };
      const surface = share(z.deck);
      layers.reduce((above, l) => {
        expect(share(l.deck), `${z.id}: ${l.name}`).toBeGreaterThan(above);
        return share(l.deck);
      }, surface);
      // A small deck: enough for one patch, with a few cards left unseen.
      for (const l of layers) expect(l.deck.reduce((n, e) => n + e.copies, 0)).toBeGreaterThanOrEqual(content.rules.patchSize ** 2);
    }
  });

  it('has wild species found only underground, with art', () => {
    const below = new Set(Object.values(content.underground).flatMap((ls) => ls.flatMap((l) => l.deck.flatMap((e) => (e.card.type === 'specimen' ? [e.card.species] : [])))));
    const above = new Set(content.zones.flatMap((z) => [...z.deck.map((e) => e.card), ...z.deep].flatMap((card) => (card.type === 'specimen' ? [card.species] : []))));
    expect(below.size).toBeGreaterThanOrEqual(5);
    for (const id of below) {
      const sp = content.species[id];
      expect(sp, id).toBeDefined();
      expect(sp.kind).toBe('wild');
      expect(sp.seasons).toBe('any');
      expect(sp.art.shape).toBeTruthy();
      expect(above.has(id), `${id} is also found above ground`).toBe(false);
    }
  });

  it('puts every artifact in exactly one layer, and every set within reach', () => {
    for (const a of content.artifacts) {
      expect(artifactHome(a.id), a.id).not.toBeNull();
      expect(content.artifactSets.some((x) => x.id === a.set)).toBe(true);
      expect(a.points).toBeGreaterThan(0);
    }
    const homes = Object.values(content.underground).flatMap((ls) => ls.map((l) => l.artifact));
    expect(new Set(homes).size).toBe(homes.length);
    expect(homes.sort()).toEqual(content.artifacts.map((a) => a.id).sort());
    for (const s of content.artifactSets) expect(set(s.id).length, s.id).toBeGreaterThanOrEqual(2);
  });
});

describe('plain ground', () => {
  it('makes up 40 to 50% of every zone deck', () => {
    for (const z of content.zones) {
      const all = z.deck.reduce((n, e) => n + e.copies, 0);
      const plain = z.deck.filter((e) => e.card.type === 'ground').reduce((n, e) => n + e.copies, 0);
      expect(plain / all, z.id).toBeGreaterThanOrEqual(0.4);
      expect(plain / all, z.id).toBeLessThanOrEqual(0.5);
    }
  });

  it('gives nothing when turned, but still counts its neighbors and goes back in the deck', () => {
    const s = run(year(1), { type: 'forage', zone: 'meadow' });
    s.forage!.patch[4].card = { type: 'ground', name: 'Tall Grass', look: 'brush' };
    const r = dispatch(s, { type: 'flip', index: 4 });
    expect(r.result).toMatchObject({ outcome: 'nothing' });
    expect(r.state.basket).toEqual(s.basket);
    expect(r.state.coins).toBe(s.coins);
    expect(r.state.shed).toEqual(s.shed);
    expect(r.state.decks.meadow.discard).toContainEqual({ type: 'ground', name: 'Tall Grass', look: 'brush' });
  });
});

describe('generations open the layers', () => {
  it('opens none in the first generation, then one more under every zone each generation', () => {
    for (const z of content.zones) {
      expect(layersOpen(1, z.id)).toBe(0);
      expect(layersOpen(2, z.id)).toBe(1);
      expect(layersOpen(3, z.id)).toBe(2);
      expect(layersOpen(99, z.id)).toBe(content.underground[z.id].length);
    }
  });

  it('deals layer decks only for the open layers, and none for a daily year', () => {
    expect(Object.keys(year(1).decks).filter((k) => k.includes(':'))).toEqual([]);
    expect(Object.keys(newGame({ seed: 'd', mode: 'daily', perks: standardPerks() }).decks).filter((k) => k.includes(':'))).toEqual([]);
    const g3 = Object.keys(year(3).decks).filter((k) => k.includes(':'));
    expect(g3.sort()).toEqual(content.zones.flatMap((z) => [layerKey(z.id, 1), layerKey(z.id, 2)]).sort());
  });

  it('leaves the first generation exactly as before: the same year from the same seed', () => {
    const plain = newGame({ seed: 'same' });
    const gen1 = newGame({ seed: 'same', perks: perksFor(emptyJournal(), []) });
    expect(gen1.decks).toEqual(plain.decks);
  });

  it('opens the next layer right away when the homestead is passed on', () => {
    const legend = { ...emptyJournal(), renown: content.progression.levels[content.progression.levels.length - 1].renown };
    const j = passItOn(legend);
    const s = newGame({ seed: 'next', perks: perksFor(j, []) });
    expect(s.perks.generation).toBe(2);
    expect(s.decks[layerKey('meadow', 1)]).toBeDefined();
  });
});

describe('descending', () => {
  it('is closed to the first generation, with no way down dealt', () => {
    const s = toWayPatch(year(1));
    expect(s.forage!.patch.some(isWay)).toBe(false);
    expect(descendStatus(s)).toMatchObject({ open: false, reason: expect.stringMatching(/Nothing under the Meadow/) });
    expect(() => dispatch(s, { type: 'descend' })).toThrow(/Nothing under the Meadow/);
  });

  it('hides the way down in the zone’s last patch, and opens once it is turned', () => {
    const s = run(year(2), { type: 'forage', zone: 'meadow' });
    expect(() => dispatch(s, { type: 'descend' })).toThrow(/in the last patch/);
    const deep = run(s, { type: 'deeper' }, { type: 'deeper' });
    expect(deep.forage!.patch.some(isWay)).toBe(false);
    const last = run(deep, { type: 'deeper' });
    expect(last.decks.meadow.draw).toHaveLength(0);
    const way = last.forage!.patch.filter(isWay);
    expect(way).toHaveLength(1);
    expect(way[0].deep).toBeFalsy();
    expect(() => dispatch(last, { type: 'descend' })).toThrow(/Turn it to descend/);
    const turned = dispatch(last, { type: 'flip', index: last.forage!.patch.findIndex(isWay) });
    expect(turned.result).toMatchObject({ outcome: 'wayDown' });
    expect(turned.state.basket).toEqual(last.basket);
    expect(descendStatus(turned.state).open).toBe(true);
  });

  it('means no descent on a trip that walks past it', () => {
    const s = run(toWayPatch(year(2)), { type: 'stopForage' });
    expect(descendStatus(s).open).toBe(false);
    expect(s.decks.meadow.draw).toHaveLength(32);
  });

  it('deals one patch from the layer deck with its artifact in it, and records the layer', () => {
    const s = run(toWay(year(2)), { type: 'descend' });
    const t = s.forage!;
    expect(t.layer).toBe(1);
    expect(t.patch).toHaveLength(9);
    expect(t.patch.filter((p) => p.deep).map((p) => p.card)).toEqual([{ type: 'artifact', artifact: layerDef('meadow', 1)!.artifact }]);
    expect(s.decks[layerKey('meadow', 1)].draw).toHaveLength(12 - 8);
    expect(s.layersReached).toEqual(['meadow:1']);
    expect(s.stats.descents).toBe(1);
    expect(() => dispatch(s, { type: 'deeper' })).toThrow(/single patch/);
  });

  it('goes only as deep as the generation has opened, through a way down in each layer above', () => {
    const two = run(toWay(year(2)), { type: 'descend' });
    expect(two.forage!.patch.some(isWay)).toBe(false);
    expect(() => dispatch(two, { type: 'descend' })).toThrow(/as deep as your generation/);
    const first = run(toWay(year(3)), { type: 'descend' });
    expect(first.forage!.patch.filter(isWay)).toHaveLength(1);
    expect(first.decks[layerKey('meadow', 1)].draw).toHaveLength(12 - 7);
    expect(() => dispatch(first, { type: 'descend' })).toThrow(/Turn it to descend/);
    const three = run(turnWay(first), { type: 'descend' });
    expect(three.forage!.layer).toBe(2);
    expect(three.layersReached).toEqual(['meadow:1', 'meadow:2']);
  });

  it('carries the hazards met above down with you', () => {
    let s = toWay(year(2));
    s.forage!.hazards = 1;
    s = run(s, { type: 'descend' });
    const at = s.forage!.patch.findIndex((p) => !p.deep);
    s.forage!.patch[at].card = hazard;
    s = run(s, { type: 'flip', index: at });
    expect(s.forage!.status).toBe('busted');
  });

  it('puts every card back in every deck it walked when the trip ends', () => {
    const total = (s: GameState, key: string) => s.decks[key].draw.length + s.decks[key].discard.length;
    let s = run(turnWay(run(toWay(year(3)), { type: 'descend' })), { type: 'descend' });
    s = run(s, { type: 'flip', index: s.forage!.patch.findIndex((p) => p.deep) }, { type: 'stopForage' });
    expect(total(s, 'meadow')).toBe(32);
    expect(total(s, 'meadow:1')).toBe(12);
    expect(total(s, 'meadow:2')).toBe(12);
  });

  it('never counts the layers toward clearing the zone', () => {
    const s = run(toWay(year(2)), { type: 'descend' });
    expect(s.forage!.cleared).toBe(false);
    const flipped = s.forage!.patch.reduce((g, _, i) => (g.forage!.status === 'open' ? run(g, { type: 'flip', index: i }) : g), s);
    expect(flipped.zonesCleared).toEqual([]);
  });

  it('moves the way down to the first deep patch with the Mapmaker’s Case', () => {
    const s = run(year(2, set('maps')), { type: 'forage', zone: 'meadow' }, { type: 'deeper' }, { type: 'deeper' });
    expect(s.forage!.patch.filter(isWay)).toHaveLength(1);
    expect(run(turnWay(s), { type: 'descend' }).forage!.layer).toBe(1);
    expect(run(s, { type: 'deeper' }).forage!.patch.some(isWay)).toBe(false);
  });
});

describe('artifacts', () => {
  /** Descends under the Meadow and turns the artifact. */
  function findIt(s: GameState) {
    s = run(toWay(s), { type: 'descend' });
    const at = s.forage!.patch.findIndex((p) => p.card.type === 'artifact');
    const r = dispatch(s, { type: 'flip', index: at });
    return { s: r.state, outcome: r.result.kind === 'draw' ? r.result.outcome : null };
  }

  it('pockets an artifact as a find, brought home when the trip ends', () => {
    const { s, outcome } = findIt(year(2));
    expect(outcome).toBe('artifact');
    expect(s.basket).toHaveLength(0);
    expect(s.forage!.relics).toHaveLength(1);
    expect(s.artifacts).toEqual([]);
    const home = run(s, { type: 'stopForage' });
    expect(home.artifacts).toEqual(['droverspenny']);
  });

  it('scores festival points for each artifact brought home this year', () => {
    const s = year(2);
    s.coins = 0;
    const before = score(s).total;
    s.artifacts = ['droverspenny', 'blueribbon'];
    expect(score(s)).toMatchObject({ artifacts: 5, total: before + 5 });
  });

  it("isn't dealt again once it's home this year", () => {
    const { s } = findIt(year(2));
    const again = run(toWay(run(s, { type: 'stopForage' }, { type: 'closeTrip' })), { type: 'descend' });
    expect(again.forage!.patch.some((p) => p.card.type === 'artifact')).toBe(false);
    expect(again.forage!.patch).toHaveLength(9);
  });

  it('is lost in a bust unless it was one of your first finds, and waits below for the next trip', () => {
    // Two finds before it: the bust keeps only those.
    let s = toWay(year(2));
    s = run(s, { type: 'descend' });
    const t = s.forage!;
    const art = t.patch.findIndex((p) => p.deep);
    const others = t.patch.map((_, i) => i).filter((i) => i !== art);
    t.patch[others[0]].card = shroom;
    t.patch[others[1]].card = shroom;
    t.patch[others[2]].card = hazard;
    t.patch[others[3]].card = hazard;
    s = run(s, ...[others[0], others[1], art, others[2], others[3]].map((index) => ({ type: 'flip', index }) as Action));
    expect(s.forage!.status).toBe('busted');
    expect(s.basket).toHaveLength(2);
    expect(s.artifacts).toEqual([]);
    // Turned first, it's kept.
    let k = run(toWay(year(2)), { type: 'descend' });
    const kt = k.forage!;
    const ka = kt.patch.findIndex((p) => p.deep);
    const rest = kt.patch.map((_, i) => i).filter((i) => i !== ka);
    kt.patch[rest[0]].card = hazard;
    kt.patch[rest[1]].card = hazard;
    k = run(k, { type: 'flip', index: ka }, { type: 'flip', index: rest[0] }, { type: 'flip', index: rest[1] });
    expect(k.forage!.status).toBe('busted');
    expect(k.artifacts).toEqual(['droverspenny']);
  });

  it('counts toward the Cabinet of Curiosities achievement and Below Ground', () => {
    const s = year(2);
    const cabinet = content.achievements.find((a) => a.id === 'curiosities')!;
    expect(achievementProgress(cabinet.check, s)).toEqual({ have: 0, need: 4 });
    expect(achievementProgress(cabinet.check, year(1))).toBeNull();
    s.artifacts = ['droverspenny', 'sixpence', 'guinea', 'lanternframe'];
    s.layersReached = ['meadow:1'];
    expect(achievementsEarned(s)).toEqual(expect.arrayContaining(['curiosities', 'belowGround']));
    expect(achievementsEarned(s)).not.toContain('bedrock');
    s.layersReached.push('hollow:3');
    expect(achievementsEarned(s)).toContain('bedrock');
  });
});

describe('the cabinet of curiosities', () => {
  it('keeps artifacts and layers in the field journal, and announces a completed set', () => {
    const s = year(2);
    s.artifacts = ['droverspenny', 'sixpence'];
    s.layersReached = ['meadow:1'];
    const first = mergeDiscoveries(emptyJournal(), s);
    expect(first.journal).toMatchObject({ artifacts: ['droverspenny', 'sixpence'], layers: ['meadow:1'] });
    expect(first.fresh).toEqual(expect.arrayContaining(['artifact:droverspenny', 'artifact:sixpence', 'layer:meadow:1']));
    expect(first.fresh.some((f) => f.startsWith('set:'))).toBe(false);
    s.artifacts.push('guinea');
    const second = mergeDiscoveries(first.journal, s);
    expect(second.fresh).toEqual(['artifact:guinea', 'set:purse']);
    expect(mergeDiscoveries(second.journal, s).fresh).toEqual([]);
  });

  it('fills in the cabinet for a journal saved before it existed', () => {
    const old = { ...emptyJournal() } as Partial<Journal>;
    delete old.artifacts;
    delete old.layers;
    expect(normalizeJournal(old)).toMatchObject({ artifacts: [], layers: [] });
  });

  it('only counts a set once every piece is in', () => {
    expect(completedSets(set('purse').slice(0, 2))).toEqual([]);
    expect(completedSets([...set('purse'), ...set('lantern')]).sort()).toEqual(['lantern', 'purse']);
  });
});

describe('set perks', () => {
  const j = (sets: string[]): Journal => ({ ...emptyJournal(), generation: 2, artifacts: sets.flatMap(set) });

  it('come through perksFor, for story years only', () => {
    expect(perksFor(j(['purse', 'stones']), []).sets.sort()).toEqual(['purse', 'stones']);
    expect(standardPerks().sets).toEqual([]);
  });

  it('The Drover’s Purse: 2 more coins every year', () => {
    expect(perksFor(j(['purse']), []).bonusCoins - perksFor(j([]), []).bonusCoins).toBe(2);
  });

  it('The Forager’s Lantern: rare finds glint', () => {
    expect(glints(year(2, set('lantern')))).toBe(true);
    expect(glints(year(2))).toBe(false);
  });

  it('The Festival Ribbons: 2 festival points every year', () => {
    const plain = year(2);
    const proud = year(2, set('ribbons'));
    expect(score(proud).family).toBe(2);
    expect(score(proud).total - score(plain).total).toBe(2);
  });

  it('The First Homestead: one more basket slot', () => {
    expect(basketCapacity(year(2, set('homestead'))) - basketCapacity(year(2))).toBe(1);
  });

  it('The Mushroom Stones: a bust keeps one more find', () => {
    const bust = (s: GameState) => {
      s.decks.meadow.draw.splice(0, 5, shroom, shroom, shroom, hazard, hazard);
      // Patch order is deck order: three finds, then two hazards.
      return run(s, { type: 'forage', zone: 'meadow' }, ...[0, 1, 2, 3, 4].map((index) => ({ type: 'flip', index }) as Action));
    };
    expect(bust(year(2)).basket).toHaveLength(2);
    expect(bust(year(2, set('stones'))).basket).toHaveLength(3);
  });
});

describe('family lore', () => {
  it('hints at the next layer each generation has yet to open, and falls silent once all are open', () => {
    expect(nextClue(1, 'hollow')!.layer.clue).toMatch(/^Grandpa used to speak of an old ruin in the forest/);
    expect(nextClue(2, 'meadow')).toMatchObject({ depth: 2, layer: { name: 'The Old Well' } });
    expect(nextClue(99, 'meadow')).toBeNull();
  });

  it('tells one of the newly opened layers as each generation begins', () => {
    expect(generationLore(1)).toBeNull();
    expect(generationLore(2)).toMatchObject({ zone: 'hollow', depth: 1 });
    expect(generationLore(3)).toMatchObject({ zone: 'meadow', depth: 2 });
    expect(generationLore(4)).toMatchObject({ zone: 'hollow', depth: 3 });
    expect(generationLore(99)).toBeNull();
  });

  it('has a clue and a payoff for every layer and every set', () => {
    for (const layers of Object.values(content.underground)) for (const l of layers) expect(l.clue && l.payoff && l.blurb).toBeTruthy();
    for (const s of content.artifactSets) expect(s.clue && s.payoff && s.rule).toBeTruthy();
  });
});

describe('old saves', () => {
  it('brings a save from before the underground up to date', () => {
    const s = year(2) as Partial<GameState> & GameState;
    for (const key of Object.keys(s.decks)) if (key.includes(':')) delete s.decks[key];
    delete (s as Partial<GameState>).artifacts;
    delete (s as Partial<GameState>).layersReached;
    delete (s.perks as Partial<GameState['perks']>).sets;
    delete (s.stats as Partial<GameState['stats']>).descents;
    const m = migrateState(structuredClone(s));
    expect(m).toMatchObject({ artifacts: [], layersReached: [], stats: { descents: 0 }, perks: { sets: [] } });
    expect(m.decks['meadow:1'].draw).toHaveLength(12);
  });

  it('gives an open trip saved before layers a surface layer and empty pockets', () => {
    const s = run(year(2), { type: 'forage', zone: 'meadow' });
    delete (s.forage as Partial<GameState['forage']> & object).layer;
    delete (s.forage as Partial<GameState['forage']> & object).relics;
    expect(migrateState(s).forage).toMatchObject({ layer: 0, relics: [] });
  });
});
