import { crossKey, hybridFor, inSeason, inStream, isShaded, neighbors, seasonOf } from './board';
import type { Rng } from './rng';
import type { Content, GameState, GrowthRate, NightEvent, NightReport, Square, Stage } from './types';

/** Moves a bed one growth step. Returns the new stage, or null if a slow bed spent the phase waiting. */
function advance(sq: Square, rate: GrowthRate): Stage | null {
  const extraC = rate === 'slow' || rate === 'verySlow' ? 1 : 0;
  const extraP = rate === 'verySlow' ? 1 : 0;
  switch (sq.stage) {
    case 'S':
      sq.stage = 'C';
      sq.hold = 0;
      return 'C';
    case 'C':
      if (sq.hold < extraC) {
        sq.hold += 1;
        return null;
      }
      sq.stage = rate === 'fast' ? 'F' : 'P';
      sq.hold = 0;
      return sq.stage;
    case 'P':
      if (sq.hold < extraP) {
        sq.hold += 1;
        return null;
      }
      sq.stage = 'F';
      sq.hold = 0;
      return 'F';
    default:
      return null;
  }
}

/**
 * The growth phase from the solo rules, resolved in the printed order:
 * dry, crowding, blight spread, grow, overripe, spreaders, hybrids, then the Mold Bloom check.
 * Mutates `s`; returns what happened so the app can animate the night.
 */
export function runGrowth(s: GameState, rng: Rng, c: Content): NightReport {
  const events: NightEvent[] = [];
  const grid = s.grid;
  const season = seasonOf(s.round, c);
  const rain = s.weather === 'rain';
  const watered = s.watered || rain;
  const stalled = s.weather === 'dryspell' && !s.watered;
  const cold = s.weather === 'coldsnap';
  const beds = () => grid.map((_, i) => i).filter((i) => grid[i].species);
  const def = (i: number) => c.species[grid[i].species!];

  // 1. Dry
  if (!watered) {
    for (const i of beds()) {
      if (inStream(i, s.size, c)) continue;
      const sq = grid[i];
      sq.dry += 1;
      events.push({ type: 'dry', square: i });
      const limit = def(i).traits.thirsty ? 1 : c.rules.dryMarksToBlight;
      if (sq.dry >= limit && !sq.blight) {
        sq.blight = true;
        events.push({ type: 'blight', square: i, cause: 'dry' });
      }
    }
  }

  // 2. Crowding
  for (const i of beds()) {
    const sq = grid[i];
    const same = neighbors(i, s.size).filter((n) => grid[n].species === sq.species).length;
    if (same >= c.rules.crowdingAt && !sq.blight) {
      sq.blight = true;
      events.push({ type: 'blight', square: i, cause: 'crowding' });
    }
  }

  // 3. Blight spreads one step to same-species neighbors
  const blighted = beds().filter((i) => grid[i].blight);
  for (const i of blighted) {
    for (const n of neighbors(i, s.size)) {
      const nb = grid[n];
      if (nb.species === grid[i].species && !nb.blight) {
        nb.blight = true;
        events.push({ type: 'blight', square: n, cause: 'spread' });
      }
    }
  }

  // 4. Grow
  const wasFruiting = beds().filter((i) => grid[i].stage === 'F');
  for (const i of beds()) {
    const sq = grid[i];
    const sp = def(i);
    if (sq.stage === 'F') continue;
    let reason: 'season' | 'shade' | 'cold' | 'dryspell' | 'blight' | null = null;
    if (sq.blight) reason = 'blight';
    else if (stalled) reason = 'dryspell';
    else if (!sq.tent && !inSeason(sp.id, season, c)) reason = 'season';
    else if (sp.traits.needsShade && !isShaded(grid, i, s.size)) reason = 'shade';
    else if (cold && !sp.traits.coldHardy && !sq.tent) reason = 'cold';
    if (reason) {
      events.push({ type: 'wait', square: i, reason });
      continue;
    }
    sq.dry = 0;
    const from = sq.stage!;
    for (let step = 0; step < (rain ? 2 : 1); step++) {
      if (advance(sq, sp.growth) === 'F') break;
    }
    if (sq.stage !== from) events.push({ type: 'grow', square: i, from, to: sq.stage! });
    else events.push({ type: 'wait', square: i, reason: 'slow' });
  }

  // 5. Overripe: still fruiting from last week, unharvested
  for (const i of wasFruiting) {
    const sq = grid[i];
    if (sq.stage === 'F') {
      sq.stage = 'C';
      sq.hold = 0;
      s.compostPile.push(sq.species!);
      s.stats.scraps += 1;
      events.push({ type: 'overripe', square: i });
    }
  }

  // 6. Spreaders and hungry beds act on fresh fruit
  const fruiting = beds().filter((i) => grid[i].stage === 'F' && !grid[i].blight);
  for (const i of fruiting) {
    const sp = def(i);
    if (sp.traits.spreader) {
      const open = neighbors(i, s.size).filter((n) => {
        const nb = grid[n];
        return !nb.tree && !nb.species && nb.substrate !== null && sp.substrates.includes(nb.substrate);
      });
      if (open.length) {
        const n = rng.pick(open);
        Object.assign(grid[n], { species: sp.id, stage: 'C', hold: 0, dry: 0, blight: false });
        events.push({ type: 'spread', from: i, to: n, species: sp.id });
      } else if (sp.traits.spreader === 'aggressive') {
        const prey = neighbors(i, s.size).filter((n) => grid[n].species === 'puffball');
        if (prey.length) {
          const n = rng.pick(prey);
          Object.assign(grid[n], { species: sp.id, stage: 'C', hold: 0, dry: 0, blight: false });
          events.push({ type: 'takeover', from: i, to: n, species: sp.id });
        }
      }
    }
    if (sp.traits.hungry) {
      const food = neighbors(i, s.size).filter((n) => {
        const nb = grid[n];
        return !nb.species && (nb.substrate === 'compost' || nb.substrate === 'woodchip');
      });
      if (food.length) {
        const n = rng.pick(food);
        grid[n].substrate = null;
        events.push({ type: 'eat', from: i, to: n });
      }
    }
  }

  // 7. Hybrids: offer every compatible adjacent pair, both colonized or later
  s.pendingCrosses = [];
  const mature = (sq: Square) => sq.species && !sq.blight && (sq.stage === 'C' || sq.stage === 'P' || sq.stage === 'F');
  for (const i of beds()) {
    for (const n of neighbors(i, s.size)) {
      if (n <= i) continue;
      const a = grid[i];
      const b = grid[n];
      if (!mature(a) || !mature(b)) continue;
      const hybrid = hybridFor(a.species!, b.species!, c);
      if (!hybrid) continue;
      if (s.declinedCrosses.includes(crossKey(i, n, a.species!, b.species!))) continue;
      s.pendingCrosses.push({ a: i, b: n, hybrid });
      events.push({ type: 'cross', a: i, b: n, hybrid });
    }
  }

  // Mold Bloom
  const blightCount = grid.filter((sq) => sq.blight).length;
  if (blightCount >= c.rules.moldBloomAt) {
    s.moldPenalty = c.rules.moldBloomPenalty;
    events.push({ type: 'moldBloom', count: blightCount });
  } else {
    s.moldPenalty = 0;
  }

  return { round: s.round, events };
}
