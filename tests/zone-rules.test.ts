import { describe, expect, it } from 'vitest';
import { content, dispatch, hazardsNear, nearCells, neighbors, newGame, seasonOf, zoneStatus, type Action, type Card, type GameState } from '../src/core';
import { emptyJournal } from '../src/core/journal';
import { playCampaign } from '../scripts/bot';

const run = (s: GameState, ...actions: Action[]) => {
  for (const a of actions) s = dispatch(s, a).state;
  return s;
};

/** A game with every zone's gear owned, in a round of your choosing, in clear weather. The zone is for the reader. */
function at(_zone: string, round = 1, seed = 'rules'): GameState {
  const s = newGame({ seed });
  s.weather = 'clear';
  s.round = round;
  s.gear.push('lantern', 'trailmap', 'waders', 'compass');
  return s;
}

const stack = (s: GameState, zone: string, cards: Card[]) => {
  s.decks[zone].draw = cards.concat(s.decks[zone].draw.filter((c) => !cards.includes(c)));
};
const h: Card = { type: 'hazard', name: 'Ticks' };
const f = (species: string): Card => ({ type: 'specimen', species });
const g = (name: string): Card => ({ type: 'ground', name, look: 'ground' });

const tally = (cards: Card[]) => cards.map((c) => JSON.stringify(c)).sort();

describe('the fairy ring (Meadow)', () => {
  it("puts a ringed mushroom at the centre of every trip's first patch, from the deck", () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const s0 = at('meadow', 1, seed);
      const before = tally([...s0.decks.meadow.draw, ...s0.decks.meadow.discard]);
      const s = run(s0, { type: 'forage', zone: 'meadow' });
      const centre = s.forage!.patch[4];
      expect(centre.ring).toBe(true);
      expect(centre.card.type).toBe('specimen');
      expect(s.forage!.patch.filter((p) => p.ring)).toHaveLength(1);
      expect(s.forage!.patch).toHaveLength(9);
      // The deck still holds the same cards: the ring's mushroom was dealt from it.
      expect(tally([...s.decks.meadow.draw, ...s.decks.meadow.discard, ...s.forage!.patch.map((p) => p.card)])).toEqual(before);
    }
  });

  it('rings only the first patch', () => {
    const s = run(at('meadow'), { type: 'forage', zone: 'meadow' }, { type: 'deeper' });
    expect(s.forage!.patch.some((p) => p.ring)).toBe(false);
  });

  it('deals as usual when the draw pile has no mushroom left', () => {
    const s0 = at('meadow');
    s0.decks.meadow.draw = s0.decks.meadow.draw.filter((c) => c.type !== 'specimen');
    const s = run(s0, { type: 'forage', zone: 'meadow' });
    expect(s.forage!.patch.some((p) => p.ring)).toBe(false);
  });
});

describe('the mycelium (Mixed Woods)', () => {
  it('marks exactly the face-down mushrooms beside a turned one', () => {
    const s0 = at('mixedwoods');
    stack(s0, 'mixedwoods', [f('oyster'), f('shiitake'), g('Oak'), f('lionsmane'), f('oyster'), h, g('Moss'), f('reishi'), f('enoki')]);
    let s = run(s0, { type: 'forage', zone: 'mixedwoods' });
    const r = dispatch(s, { type: 'flip', index: 4 });
    s = r.state;
    // Beside 4: 1 (mushroom), 5 (hazard), 7 (mushroom), 3 (mushroom). Corners don't count.
    expect(r.result.kind === 'draw' && r.result.marked?.sort()).toEqual([1, 3, 7]);
    expect(s.forage!.patch.map((p, i) => (p.sign === undefined ? null : i)).filter((i) => i !== null)).toEqual([1, 3, 7]);
    expect(s.forage!.patch[1].sign).toBe(4);
    // Turning a marked one marks more: 0 is beside 1 and 3, but 3 is marked already.
    s = run(s, { type: 'flip', index: 1 });
    expect(s.forage!.patch[0].sign).toBe(1);
  });

  it('marks nothing in another zone', () => {
    const s0 = at('meadow');
    stack(s0, 'meadow', [f('puffball'), f('winecap'), f('puffball'), f('winecap'), f('puffball'), f('winecap'), f('puffball'), f('winecap'), f('puffball')]);
    const s = run(s0, { type: 'forage', zone: 'meadow' }, { type: 'flip', index: 0 });
    expect(s.forage!.patch.some((p) => p.sign !== undefined)).toBe(false);
  });
});

describe('the quiet (Old-growth)', () => {
  it('counts the corners too on the surface', () => {
    expect(neighbors(4, 3, true).sort()).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(neighbors(0, 3, true).sort()).toEqual([1, 3, 4]);
    expect(neighbors(1, 3, true).sort()).toEqual([0, 2, 3, 4, 5]);
    const s0 = at('oldgrowth');
    stack(s0, 'oldgrowth', [h, g('Moss'), h, g('Moss'), g('Moss'), g('Moss'), h, g('Moss'), h]);
    const s = run(s0, { type: 'forage', zone: 'oldgrowth' });
    expect(hazardsNear(s.forage!, 4)).toBe(4);
    expect(hazardsNear(s.forage!, 1)).toBe(2);
    // The same patch in the Mixed Woods counts only up, down, left and right.
    const m0 = at('mixedwoods');
    stack(m0, 'mixedwoods', [h, g('Moss'), h, g('Moss'), g('Moss'), g('Moss'), h, g('Moss'), h]);
    const m = run(m0, { type: 'forage', zone: 'mixedwoods' });
    expect(hazardsNear(m.forage!, 4)).toBe(0);
  });

  it('keeps the plain count below ground', () => {
    const s = run(at('oldgrowth'), { type: 'forage', zone: 'oldgrowth' });
    const trip = { ...s.forage!, layer: 1 };
    expect(nearCells(trip, 4).sort()).toEqual([1, 3, 5, 7]);
    expect(nearCells(s.forage!, 4)).toHaveLength(8);
  });
});

describe('open sky (Burn Scar)', () => {
  it('deals the Ash face up, turned but not logged, and leaves the rest face down', () => {
    expect(seasonOf(1)).toBe('spring');
    const s0 = at('burnscar');
    const ash = g('Ash');
    stack(s0, 'burnscar', [ash, f('morel'), { type: 'ground', name: 'Fireweed', look: 'brush' }, h, ash, f('morel'), f('morel'), ash, f('morel')]);
    const s = run(s0, { type: 'forage', zone: 'burnscar' });
    const up = s.forage!.patch.map((p, i) => (p.faceUp ? i : -1)).filter((i) => i >= 0);
    expect(up).toEqual([0, 4, 7]);
    expect(s.forage!.patch.filter((p) => p.flipped)).toHaveLength(3);
    expect(s.forage!.drawn).toHaveLength(0);
    // Turning one shows a card is still a choice; flipping Ash again is refused.
    expect(() => dispatch(s, { type: 'flip', index: 0 })).toThrow();
  });

  it('still lets Nothing Left Unturned clear the zone', () => {
    const s0 = at('burnscar');
    // Leave the deck as one patch: the Ash face up, everything else turned by hand.
    s0.decks.burnscar.draw = [g('Ash'), f('morel'), g('Ash'), h, f('morel'), g('Ash'), f('morel'), g('Ash'), h];
    let s = run(s0, { type: 'forage', zone: 'burnscar' });
    for (const i of [1, 4, 6]) s = run(s, { type: 'flip', index: i });
    expect(s.forage!.cleared).toBe(true);
    expect(s.zonesCleared).toContain('burnscar');
  });
});

describe('the creek (Riverbank)', () => {
  it('closes the Riverbank in a month of Rain', () => {
    const s = at('riverbank');
    const river = content.zones.find((z) => z.id === 'riverbank')!;
    s.weather = 'rain';
    expect(zoneStatus(s, river)).toEqual({ open: false, reason: 'Closed by high water' });
    s.weather = 'clear';
    expect(zoneStatus(s, river).open).toBe(true);
  });

  it('washes up a rare find for the first trip the month after Rain, and only that one', () => {
    let s = at('riverbank');
    s.weather = 'rain';
    // Spend the month, so the next one rolls its weather after Rain.
    while (s.round === 1) s = run(s, { type: 'endMonth' }, { type: 'dismissNight' });
    expect(s.washed).toBe(true);
    s.weather = 'clear';
    s = run(s, { type: 'forage', zone: 'riverbank' });
    expect(s.forage!.patch.filter((p) => p.deep)).toHaveLength(1);
    expect(s.washed).toBe(false);
    s = run(s, { type: 'stopForage' }, { type: 'closeTrip' }, { type: 'forage', zone: 'riverbank' });
    expect(s.forage!.patch.some((p) => p.deep)).toBe(false);
  });

  it('washes nothing up in other zones', () => {
    const s0 = at('mixedwoods');
    s0.washed = true;
    const s = run(s0, { type: 'forage', zone: 'mixedwoods' });
    expect(s.forage!.patch.some((p) => p.deep)).toBe(false);
    expect(s.washed).toBe(true);
  });
});

describe('turned around (The Hollow)', () => {
  const lost: Card = { type: 'hazard', name: 'Lost Trail' };
  function hollow(cards: Card[], knife = false) {
    const s0 = at('hollow', 7);
    if (knife) s0.gear.push('knife');
    stack(s0, 'hollow', cards);
    return run(s0, { type: 'forage', zone: 'hollow' });
  }

  it("doesn't count toward a bust or use the knife, and blocks more flips", () => {
    expect(seasonOf(7)).toBe('fall');
    const s0 = hollow([lost, f('hen'), h, g('Yew'), g('Yew'), g('Yew'), g('Yew'), g('Yew'), g('Yew')], true);
    const r = dispatch(s0, { type: 'flip', index: 0 });
    expect(r.result.kind === 'draw' && r.result.outcome).toBe('turnedAround');
    const s = r.state;
    expect(s.forage!.hazards).toBe(0);
    expect(s.forage!.knifeUsed).toBe(false);
    expect(s.forage!.turnedAround).toBe(true);
    expect(() => dispatch(s, { type: 'flip', index: 1 })).toThrow(/turned you around/);
    // Still a hazard for the numbers.
    expect(hazardsNear(s.forage!, 1)).toBe(2);
    // Walk on: the next patch can be turned again.
    const on = run(s, { type: 'deeper' });
    expect(on.forage!.turnedAround).toBe(false);
    expect(() => dispatch(on, { type: 'flip', index: 0 })).not.toThrow();
    // Or head home with the finds.
    expect(run(s, { type: 'stopForage' }).forage!.status).toBe('stopped');
  });

  it('on the last patch, only home', () => {
    const s0 = at('hollow', 7);
    s0.decks.hollow.draw = [lost, f('hen'), g('Yew'), g('Yew'), g('Yew'), g('Yew'), g('Yew'), g('Yew'), g('Yew')];
    const s = run(s0, { type: 'forage', zone: 'hollow' }, { type: 'flip', index: 0 });
    expect(() => dispatch(s, { type: 'deeper' })).toThrow();
    expect(run(s, { type: 'stopForage' }).forage!.status).toBe('stopped');
  });

  it('other hazards in the Hollow still count', () => {
    const s = run(hollow([h, f('hen'), g('Yew'), g('Yew'), g('Yew'), g('Yew'), g('Yew'), g('Yew'), g('Yew')]), { type: 'flip', index: 0 });
    expect(s.forage!.hazards).toBe(1);
  });
});

describe('the bot', () => {
  it('plays ten years, every zone open in time, without an illegal move', () => {
    const { games } = playCampaign(10, 'zone-rules', emptyJournal(), { plan: true });
    expect(games).toHaveLength(10);
  }, 30000);
});
