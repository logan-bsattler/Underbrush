import {
  content,
  dispatch,
  emptyGround,
  heirloomChoices,
  heirloomSlots,
  inStream,
  levelFor,
  newGame,
  orderPayment,
  perksFor,
  recordYear,
  plantableSquares,
  zoneStatus,
  type Action,
  hazardsNear,
  type ForageTrip,
  type GameState,
  type Journal,
} from '../src/core';
import { neighbors } from '../src/core/board';

/**
 * Reads the forest floor the way a careful player would: a turned card's number says how many
 * hazards sit beside it, so spread each number's remaining hazards over its hidden neighbors
 * and turn the card that looks least risky. Unknown cards count as the zone's base rate.
 */
function safestCard(t: ForageTrip): { index: number; risk: number } | null {
  const size = content.rules.patchSize;
  const risk = t.patch.map(() => 0.25);
  t.patch.forEach((p, i) => {
    if (!p.flipped || p.card.type === 'hazard') return;
    const around = neighbors(i, size);
    const hidden = around.filter((n) => !t.patch[n].flipped);
    const found = around.filter((n) => t.patch[n].flipped && t.patch[n].card.type === 'hazard').length;
    const left = hazardsNear(t, i) - found;
    for (const n of hidden) risk[n] = left === 0 ? 0 : Math.max(risk[n] === 0 ? 0 : risk[n], left / hidden.length);
  });
  let best: { index: number; risk: number } | null = null;
  t.patch.forEach((p, i) => {
    if (!p.flipped && (!best || risk[i] < best.risk)) best = { index: i, risk: risk[i] };
  });
  return best;
}

/**
 * A simple greedy player used to fuzz the rules and to estimate pacing.
 * It is deliberately unclever: the point is a repeatable baseline, not a strong strategy.
 */
export function playYear(start: GameState, opts: { greed?: number } = {}): GameState {
  const greed = opts.greed ?? 3;
  let s = start;
  const act = (a: Action) => {
    s = dispatch(s, a).state;
  };
  const value = (id: string | null) => (id ? content.species[id].value : 0);

  let guard = 0;
  while (!s.over) {
    if (++guard > 2000) throw new Error('bot stuck');
    if (s.night) act({ type: 'dismissNight' });
    while (s.pendingCrosses.length) {
      const x = s.pendingCrosses[0];
      act({ type: 'resolveCross', index: 0, replace: value(s.grid[x.a].species) <= value(s.grid[x.b].species) ? 'a' : 'b' });
    }
    if (s.finale) {
      // Festival morning: bring in the last harvest, deliver what an order takes, sell the rest.
      if (s.grid.some((sq) => sq.stage === 'F' && !sq.blight && sq.species)) act({ type: 'harvest' });
      const best = s.orders.visible
        .map((o) => content.orders.find((x) => x.id === o)!)
        .filter((o) => orderPayment(s.storage, o))
        .sort((a, b) => b.points - a.points)[0];
      if (best) act({ type: 'fillOrder', order: best.id });
      for (const id of Object.keys(s.storage)) act({ type: 'sell', species: id, count: s.storage[id] });
      act({ type: 'festival' });
      continue;
    }
    while (s.shed.length && emptyGround(s).length) act({ type: 'placeSubstrate', index: 0, square: emptyGround(s)[0] });
    if (s.gear.includes('growtent') && !s.tentPlaced) {
      const bed = s.grid.findIndex((sq) => sq.species && !sq.tree);
      act({ type: 'placeTent', square: bed >= 0 ? bed : s.grid.findIndex((sq) => !sq.tree) });
    }

    while (s.actionsLeft > 0) {
      const blighted = s.grid.findIndex((sq) => sq.blight);
      if (blighted >= 0) {
        act({ type: 'clearBlight', square: blighted });
        continue;
      }
      if (s.grid.some((sq) => sq.stage === 'F' && !sq.blight)) {
        act({ type: 'harvest' });
        continue;
      }
      const thirsty = s.grid.filter((sq, i) => sq.species && !inStream(i, s.size)).length;
      if (!s.watered && s.weather !== 'rain' && (s.weather === 'dryspell' ? s.grid.some((q) => q.species) : thirsty >= 2)) {
        act({ type: 'water' });
        continue;
      }
      const unknown = s.basket.find((b) => !b.identified);
      if (unknown) {
        act({ type: 'identify' });
        continue;
      }
      const plantable = s.basket.find((b) => b.identified && plantableSquares(s, b.species).length);
      if (plantable) {
        act({ type: 'plant', uid: plantable.uid, square: plantableSquares(s, plantable.species)[0] });
        continue;
      }
      const fillable = s.orders.visible.find((o) => orderPayment(s.storage, content.orders.find((x) => x.id === o)!));
      const wanted = ['biggerbasket', 'knife', 'lantern', 'dehydrator', 'fieldguide', 'growtent', 'trailmap'];
      const affordable = wanted.find(
        (g) => !s.gear.includes(g) && s.perks.shop.includes(g) && s.coins >= content.gear.find((x) => x.id === g)!.cost,
      );
      const lastMonthOfSeason = s.round % 3 === 0;
      if (fillable || affordable || (lastMonthOfSeason && Object.keys(s.storage).length && !s.gear.includes('dehydrator'))) {
        if (fillable) act({ type: 'fillOrder', order: fillable });
        if (lastMonthOfSeason || affordable) {
          for (const id of Object.keys(s.storage)) {
            const neededSomewhere = s.orders.visible.some((o) => {
              const need = content.orders.find((x) => x.id === o)!.need;
              return need.kind === 'species' && id in need.items;
            });
            if (!neededSomewhere || lastMonthOfSeason) act({ type: 'sell', species: id, count: s.storage[id] });
          }
        }
        for (const g of wanted) {
          const def = content.gear.find((x) => x.id === g)!;
          if (!s.gear.includes(g) && s.perks.shop.includes(g) && s.coins >= def.cost) act({ type: 'buyGear', gear: g });
        }
        if (s.market) {
          act({ type: 'leaveMarket' });
          continue;
        }
      }
      const zones = content.zones.filter((z) => zoneStatus(s, z).open);
      if (!zones.length) break;
      const zone = zones[zones.length - 1].id === 'burnscar' ? 'burnscar' : zones[(s.round + s.actionsLeft) % zones.length].id;
      act({ type: 'forage', zone });
      while (s.forage?.status === 'open') {
        const t: ForageTrip = s.forage;
        const full = s.basket.length >= (s.gear.includes('biggerbasket') ? 6 : 4);
        const pick = safestCard(t);
        if (full || (t.hazards >= 1 && t.drawn.length >= greed)) act({ type: 'stopForage' });
        else if (pick && (pick.risk < 0.35 || t.hazards === 0)) act({ type: 'flip', index: pick.index });
        else if (t.depth < 3 && t.hazards === 0) act({ type: 'deeper' });
        else act({ type: 'stopForage' });
      }
      act({ type: 'closeTrip' });
    }
    act({ type: 'endMonth' });
  }
  return s;
}

const HEIRLOOM_PREFERENCE = ['biggerbasket', 'knife', 'lantern', 'fieldguide', 'dehydrator', 'growtent', 'trailmap'];

/** Plays a story campaign of several years, carrying the journal (and so the progression) forward. */
export function playCampaign(years: number, seed: string, journal: Journal): { journal: Journal; games: GameState[] } {
  const games: GameState[] = [];
  for (let y = 0; y < years; y++) {
    const slots = heirloomSlots(levelFor(journal.renown).level);
    const choices = heirloomChoices(journal);
    const heirlooms = HEIRLOOM_PREFERENCE.filter((g) => choices.includes(g)).slice(0, slots);
    const end = playYear(newGame({ seed: `${seed}-y${y}`, perks: perksFor(journal, heirlooms) }));
    journal = recordYear(journal, end);
    games.push(end);
  }
  return { journal, games };
}
