import {
  content,
  descendStatus,
  dispatch,
  emptyGround,
  heirloomChoices,
  heirloomSlots,
  isDamp,
  isWatered,
  layersOpen,
  levelFor,
  newGame,
  orderPayment,
  orderSpecies,
  perksFor,
  recordYear,
  plantableSquares,
  swapCost,
  zoneStatus,
  type Action,
  hazardsNear,
  type ForageTrip,
  type GameState,
  type Journal,
  type NightReport,
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
    // A patch at the end of the deck can be short: only the cards actually dealt are neighbors.
    const around = neighbors(i, size).filter((n) => n < t.patch.length);
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
 * With `dive`, every other trip to a zone with layers open walks straight to the patch with the
 * way down, turns cards until it finds it, and goes underground; the baseline never does.
 * With `careful` as well, below ground it heads home after the first counted hazard and won't descend
 * with one already counted, so it never falls; without it, `dive` is the careless worst case.
 * With `forager`, it plays a year mostly in the woods: it never plants a find (cultivated ones go on the
 * compost). With `swap`, or `forager`, when no order on the board can be filled from storage it swaps one, once a month.
 */
export function playYear(
  start: GameState,
  opts: { greed?: number; dive?: boolean; careful?: boolean; forager?: boolean; swap?: boolean; onNight?: (report: NightReport) => void } = {},
): GameState {
  const greed = opts.greed ?? 3;
  let s = start;
  const act = (a: Action) => {
    const r = dispatch(s, a);
    s = r.state;
    if (r.result.kind === 'night') opts.onNight?.(r.result.report);
  };
  const value = (id: string | null) => (id ? content.species[id].value : 0);
  let swappedIn = 0;

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
      const compost = s.shed.filter((x) => x === 'compost').length;
      if (compost) act({ type: 'sellCompost', count: compost });
      act({ type: 'festival' });
      continue;
    }
    // Out recovering from a fall: nothing to do but come home at the month's end.
    if (s.away) {
      act({ type: 'endMonth' });
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
      const thirsty = s.grid.filter((sq, i) => sq.species && !isDamp(s, i)).length;
      if (!isWatered(s) && (s.weather === 'dryspell' ? s.grid.some((q) => q.species) : thirsty >= 2)) {
        act({ type: 'water' });
        continue;
      }
      const unknown = s.basket.find((b) => !b.identified);
      if (unknown) {
        act({ type: 'identify' });
        continue;
      }
      if (opts.forager) {
        for (const b of s.basket.filter((x) => x.identified)) act({ type: 'discard', uid: b.uid });
      } else {
        const plantable = s.basket.find((b) => b.identified && plantableSquares(s, b.species).length);
        if (plantable) {
          act({ type: 'plant', uid: plantable.uid, square: plantableSquares(s, plantable.species)[0] });
          continue;
        }
      }
      const fillableNow = () => s.orders.visible.find((o) => orderPayment(s.storage, content.orders.find((x) => x.id === o)!));
      const stored = Object.values(s.storage).reduce((a, b) => a + b, 0);
      if (
        (opts.swap || opts.forager) &&
        !fillableNow() &&
        swappedIn !== s.round &&
        stored >= 2 &&
        s.orders.deck.length &&
        s.coins >= swapCost(s)
      ) {
        swappedIn = s.round;
        act({ type: 'swapOrder', order: s.orders.visible[0] });
      }
      const fillable = fillableNow();
      const wanted = ['biggerbasket', 'knife', 'lantern', 'dehydrator', 'fieldguide', 'growtent', 'trailmap', 'blightspray', 'dripline', 'waders', 'compass'];
      const affordable = wanted.find(
        (g) => !s.gear.includes(g) && s.perks.shop.includes(g) && s.coins >= content.gear.find((x) => x.id === g)!.cost,
      );
      const lastMonthOfSeason = s.round % 3 === 0;
      if (s.market || fillable || affordable || (lastMonthOfSeason && Object.keys(s.storage).length && !s.gear.includes('dehydrator'))) {
        if (fillable) act({ type: 'fillOrder', order: fillable });
        if (lastMonthOfSeason || affordable) {
          for (const id of Object.keys(s.storage)) {
            const neededSomewhere = s.orders.visible.some((o) => {
              const order = content.orders.find((x) => x.id === o)!;
              const need = order.need;
              if (need.kind === 'zone' || need.kind === 'below') return orderSpecies(order)!.includes(id);
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
      const dive = !!opts.dive && layersOpen(s.perks.generation, zone) > 0 && s.tripCount % 2 === 1;
      act({ type: 'forage', zone });
      while (s.forage?.status === 'open') {
        const t: ForageTrip = s.forage;
        const way = t.patch.find((p) => p.card.type === 'entrance');
        // A careful diver heads home from below after the first counted hazard, and won't go down with one counted.
        if (opts.careful && t.hazards >= 1 && t.layer > 0) {
          act({ type: 'stopForage' });
          continue;
        }
        if (dive && !(opts.careful && t.hazards >= 1) && (t.layer === 0 || way)) {
          // The message says which patch hides the way down; the bot still has to turn cards to find it.
          if (way?.flipped) act({ type: 'descend' });
          else if (way) act({ type: 'flip', index: safestCard(t)!.index });
          else if (s.decks[t.zone].draw.length) act({ type: 'deeper' });
          else act({ type: 'stopForage' });
          continue;
        }
        const full = s.basket.length >= (s.gear.includes('biggerbasket') ? 6 : 4);
        const pick = safestCard(t);
        // Plain ground is no find: greed counts what the trip has actually brought in.
        const finds = t.drawn.filter((d) => d.card.type !== 'ground' && d.card.type !== 'entrance').length;
        if (full || (t.hazards >= 1 && finds >= greed)) act({ type: 'stopForage' });
        else if (pick && (pick.risk < 0.35 || t.hazards === 0)) act({ type: 'flip', index: pick.index });
        else if (t.layer === 0 && t.depth < 3 && t.hazards === 0) act({ type: 'deeper' });
        // From a later generation on, a clean trip that has walked the deep patches goes underground.
        else if (t.hazards === 0 && descendStatus(s).open) act({ type: 'descend' });
        else act({ type: 'stopForage' });
      }
      act({ type: 'closeTrip' });
    }
    act({ type: 'endMonth' });
  }
  return s;
}

export const HEIRLOOM_PREFERENCE = ['biggerbasket', 'knife', 'lantern', 'dripline', 'fieldguide', 'dehydrator', 'growtent', 'trailmap', 'blightspray', 'compass'];

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
