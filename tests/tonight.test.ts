import { describe, expect, it } from 'vitest';
import { content, dispatch, newGame, previewNight, type Action, type GameState, type NightEvent } from '../src/core';
import { tonightLines } from '../src/ui/text';
import { playYear } from '../scripts/bot';

/** A fresh game with clear weather and an empty farm. */
function blank(seed = 'tonight'): GameState {
  const s = newGame({ seed });
  s.weather = 'clear';
  s.shed = [];
  for (const sq of s.grid) Object.assign(sq, { substrate: null, species: null, stage: null, hold: 0, dry: 0, blight: false, tree: false });
  return s;
}

function bed(s: GameState, i: number, species: string, stage: 'S' | 'C' | 'P' | 'F' = 'S') {
  Object.assign(s.grid[i], { substrate: content.species[species].substrates[0], species, stage, hold: 0, dry: 0, blight: false });
}

/** The real night's report, cut down to what the preview promises to tell. */
function told(events: NightEvent[]) {
  const filled = new Set(events.flatMap((e) => (e.type === 'spread' || e.type === 'takeover' ? [e.to] : [])));
  return events
    .filter((e) => ['dry', 'blight', 'overripe', 'eat', 'cross', 'moldBloom', 'spoil'].includes(e.type))
    .filter((e) => e.type !== 'cross' || (!filled.has(e.a) && !filled.has(e.b)))
    .map((e) => (e.type === 'eat' ? { ...e, to: -1 } : e));
}

describe('tonight preview', () => {
  it('matches the real night, and leaves the state alone, across bot-played years', () => {
    let nights = 0;
    let warned = 0;
    for (let i = 0; i < 24; i++) {
      const start = newGame({ seed: `tonight-${i}` });
      const actions: Action[] = [];
      playYear(start, { greed: 2 + (i % 4), plan: i % 2 === 0, onResult: (a) => actions.push(a) });
      let s = start;
      for (const a of actions) {
        if (a.type === 'endMonth') {
          const before = structuredClone(s);
          const preview = previewNight(s, content);
          expect(s).toEqual(before);
          const { state, result } = dispatch(s, a);
          if (result.kind !== 'night') throw new Error('endMonth gave no night');
          expect(preview).toEqual(told(result.report.events));
          nights += 1;
          if (preview.length) warned += 1;
          s = state;
        } else s = dispatch(s, a).state;
      }
      expect(s.over).toBe(true);
    }
    expect(nights).toBe(24 * content.rules.rounds);
    // Bots leave beds to dry and fruit to rot on about one night in five, so the comparison isn't vacuous.
    expect(warned).toBeGreaterThan(nights / 8);
  }, 20000);

  it('never says where a spreader lands, or the cross its new bed would offer', () => {
    const s = blank();
    expect(s.size).toBe(4);
    bed(s, 0, 'oyster', 'C'); // fruits tonight and spreads to square 1, its only open neighbor
    s.grid[1].substrate = 'straw';
    bed(s, 2, 'lionsmane', 'C'); // beside square 1, so the new Oyster bed would offer Shaggy Oyster
    s.watered = true;
    const real = dispatch(s, { type: 'endMonth' }).result;
    if (real.kind !== 'night') throw new Error('no night');
    expect(real.report.events).toContainEqual({ type: 'spread', from: 0, to: 1, species: 'oyster' });
    expect(real.report.events).toContainEqual({ type: 'cross', a: 1, b: 2, hybrid: 'shaggyoyster' });
    const preview = previewNight(s, content);
    expect(preview.some((e) => e.type === 'cross')).toBe(false);
    expect(JSON.stringify(preview)).not.toMatch(/spread|takeover/);
    expect(preview).toEqual([]);
  });

  it('warns of spoilage at the turn of a season, unless the Dehydrator keeps it', () => {
    const s = blank();
    s.round = content.rules.roundsPerSeason;
    s.storage = { oyster: 3 };
    expect(previewNight(s, content)).toContainEqual({ type: 'spoil', lost: { oyster: 3 } });
    s.gear = [...s.gear, 'dehydrator'];
    expect(previewNight(s, content).some((e) => e.type === 'spoil')).toBe(false);
  });

  it('is quiet when nothing will go wrong', () => {
    const s = blank();
    bed(s, 0, 'oyster', 'S');
    s.watered = true;
    expect(previewNight(s, content)).toEqual([]);
  });
});

describe('tonight text', () => {
  const grid = [{ species: 'oyster' }, { species: 'lionsmane' }, { species: 'shiitake' }, { species: 'frostoyster' }, { species: 'emberpuff' }];

  it('folds like events together, worst first, each with its fix', () => {
    const lines = tonightLines(
      [
        { type: 'dry', square: 0 },
        { type: 'dry', square: 2 },
        { type: 'dry', square: 3 },
        { type: 'blight', square: 3, cause: 'dry' },
        { type: 'blight', square: 0, cause: 'crowding' },
        { type: 'blight', square: 1, cause: 'spread' },
        { type: 'overripe', square: 2 },
        { type: 'eat', from: 4, to: -1 },
        { type: 'cross', a: 0, b: 1, hybrid: 'shaggyoyster' },
        { type: 'moldBloom', count: 4 },
        { type: 'spoil', lost: { oyster: 2, shiitake: 3 } },
      ],
      grid,
    );
    expect(lines.map((l) => [l.text, l.fix])).toEqual([
      ["Mold bloom: 4 beds blighted. You'd lose an action next month.", 'clear'],
      ['Frost Oyster will dry out and catch blight.', 'water'],
      ['Oyster is too crowded and will catch blight.', null],
      ["Blight will creep into a neighboring Lion's Mane bed.", 'clear'],
      ['Shiitake will go overripe unpicked.', 'harvest'],
      ['The season turns: 5 stored mushrooms will spoil.', 'market'],
      // Frost Oyster's dry mark is already told by its blight line.
      ['2 beds will take a dry mark.', 'water'],
      ['Ember Puff will eat a tile beside it.', null],
      ["Oyster and Lion's Mane will offer a cross.", null],
    ]);
    expect(lines.at(-1)!.good).toBe(true);
    expect(lines.filter((l) => l.good)).toHaveLength(1);
    expect(lines.find((l) => l.text.includes('dry mark'))!.squares).toEqual([0, 2]);
  });

  it('counts beds when there are several', () => {
    const lines = tonightLines(
      [
        { type: 'overripe', square: 0 },
        { type: 'overripe', square: 2 },
        { type: 'blight', square: 0, cause: 'spread' },
        { type: 'blight', square: 2, cause: 'spread' },
        { type: 'spoil', lost: { oyster: 1 } },
      ],
      grid,
    );
    expect(lines.map((l) => l.text)).toEqual([
      'Blight will creep into 2 neighboring beds.',
      '2 beds will go overripe unpicked.',
      'The season turns: 1 stored mushroom will spoil.',
    ]);
  });
});
