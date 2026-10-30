import { describe, expect, it } from 'vitest';
import { newGame, orderById, orderPayment, orderProgress, standardPerks, type GameState } from '../src/core';

/** A year with the farm's starting beds cleared, so only what a test grows counts. */
function game(): GameState {
  const g = newGame({ mode: 'daily', seed: 'order-progress', perks: standardPerks() });
  for (const sq of g.grid) sq.species = null;
  return g;
}

/** Puts a species on the first free beds, as if planted and growing. */
function grow(g: GameState, species: string, n: number, blight = false) {
  for (const sq of g.grid) {
    if (!n) break;
    if (sq.tree || sq.species) continue;
    sq.substrate = 'log';
    sq.species = species;
    sq.stage = 'C';
    sq.blight = blight;
    n -= 1;
  }
}

describe('order progress', () => {
  it('counts storage first, then identified finds in the basket, then beds growing', () => {
    const g = game();
    const order = orderById('o-oyster3')!;
    g.storage = { oyster: 1 };
    g.basket = [
      { uid: 900, species: 'oyster', identified: true, trip: 1 },
      // Not identified yet: it might be a lookalike, so it doesn't count.
      { uid: 901, species: 'oyster', identified: false, trip: 1 },
    ];
    grow(g, 'oyster', 3);
    expect(orderProgress(g, order)).toEqual({ need: 3, stored: 1, basket: 1, growing: 1 });
  });

  it('never counts past what the order takes, and skips blighted beds', () => {
    const g = game();
    const order = orderById('o-oyster3')!;
    g.storage = { oyster: 5 };
    expect(orderProgress(g, order)).toEqual({ need: 3, stored: 3, basket: 0, growing: 0 });
    g.storage = {};
    grow(g, 'oyster', 2, true);
    expect(orderProgress(g, order)).toEqual({ need: 3, stored: 0, basket: 0, growing: 0 });
  });

  it("agrees with a delivery: full storage progress means it's ready", () => {
    const g = game();
    const order = orderById('o-four')!;
    g.storage = { oyster: 3, shiitake: 1 };
    // Different species, one each: three of one kind count once.
    expect(orderProgress(g, order)).toMatchObject({ need: 4, stored: 2 });
    expect(orderPayment(g.storage, order)).toBeNull();
    g.basket = [{ uid: 900, species: 'oyster', identified: true, trip: 1 }];
    grow(g, 'winecap', 1);
    // Another Oyster in the basket is no new species; a Wine Cap bed is.
    expect(orderProgress(g, order)).toEqual({ need: 4, stored: 2, basket: 0, growing: 1 });
    g.storage = { oyster: 1, shiitake: 1, winecap: 1, lionsmane: 1 };
    expect(orderProgress(g, order)).toMatchObject({ stored: 4 });
    expect(orderPayment(g.storage, order)).not.toBeNull();
  });

  it('fills an "any N from a zone" order from its pool only', () => {
    const g = game();
    const order = orderById('o-woods2')!;
    g.storage = { oyster: 4 };
    expect(orderProgress(g, order).stored).toBe(0);
    expect(orderPayment(g.storage, order)).toBeNull();
  });
});
