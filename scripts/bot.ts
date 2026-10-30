import {
  basketCapacity,
  commissionCost,
  content,
  deliveryCost,
  descendStatus,
  dispatch,
  emptyGround,
  heirloomChoices,
  heirloomSlots,
  hireCost,
  inSeason,
  isDamp,
  isWatered,
  layersOpen,
  levelFor,
  newGame,
  orderById,
  orderPayment,
  orderSpecies,
  perksFor,
  recordYear,
  plantableSquares,
  seasonOf,
  spawnCost,
  spawnStock,
  stageLength,
  swapCost,
  zoneStatus,
  type Action,
  hazardsNear,
  type ForageTrip,
  type GameState,
  type Journal,
  type NightReport,
  type Substrate,
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

const orderDef = (id: string) => orderById(id)!;
/** The orders on the board and the open commission, if any. */
const board = (s: GameState) => [...s.orders.visible, ...(s.commission.open ? [s.commission.open] : [])];

/** Where each species turns up: the zones whose forest floor or deep patches deal it. */
const SOURCES: Record<string, { zone: string; copies: number; deep: boolean }[]> = {};
for (const z of content.zones) {
  for (const e of z.deck) if (e.card.type === 'specimen') (SOURCES[e.card.species] ??= []).push({ zone: z.id, copies: e.copies, deep: false });
  for (const card of z.deep ?? []) if (card.type === 'specimen') (SOURCES[card.species] ??= []).push({ zone: z.id, copies: 1, deep: true });
}

/** Nights a bed of this species needs from planting to fruit: spawn, colonize (longer when slow), pin unless fast. */
function nightsToFruit(id: string): number {
  const rate = content.species[id].growth;
  return 1 + stageLength('C', rate) + stageLength('P', rate);
}

/**
 * How much each species is worth to the orders on the board right now, in festival points per specimen still missing.
 * A species two orders want takes the better of the two. Zone and below-ground orders spread their points over any species
 * that fits; a "different species" order wants one of anything not in storage yet.
 */
export function orderWants(s: GameState): Record<string, number> {
  const want: Record<string, number> = {};
  const add = (id: string, v: number) => (want[id] = Math.max(want[id] ?? 0, v));
  const have = (id: string) => s.storage[id] ?? 0;
  for (const o of board(s).map(orderDef)) {
    const need = o.need;
    if (need.kind === 'species') {
      const short = Object.entries(need.items).reduce((n, [id, k]) => n + Math.max(0, k - have(id)), 0);
      for (const [id, k] of Object.entries(need.items)) if (have(id) < k) add(id, o.points / short);
    } else if (need.kind === 'zone' || need.kind === 'below' || need.kind === 'hybrids') {
      const pool = orderSpecies(o)!;
      const short = need.count - pool.reduce((n, id) => n + have(id), 0);
      if (short > 0) for (const id of pool) add(id, o.points / short);
    } else if (need.kind === 'distinct') {
      const short = need.count - Object.keys(s.storage).length;
      if (short > 0) for (const id of content.speciesOrder) if (!have(id) && content.species[id].kind !== 'hybrid') add(id, o.points / short / 2);
    }
  }
  return want;
}

/** Whether a wild species can still be found this year: some month left in its season, in a zone this year can open. */
function stillFindable(s: GameState, id: string): boolean {
  for (let r = s.round; r <= content.rules.rounds; r++) {
    const season = seasonOf(r);
    if (!inSeason(id, season)) continue;
    for (const src of SOURCES[id] ?? []) {
      const z = content.zones.find((x) => x.id === src.zone)!;
      if (z.unlock && !s.gear.includes(z.unlock) && !s.perks.shop.includes(z.unlock)) continue;
      if (z.seasons && !z.seasons.includes(season)) continue;
      return true;
    }
  }
  return false;
}

/**
 * An order the planner gives up on: something it needs can no longer be had this year. Wild species past their season
 * or in a zone the shop never stocks; cultivated ones with too few months left to grow; hybrids, which it doesn't breed for.
 */
function deadOrder(s: GameState, id: string): boolean {
  const o = orderDef(id);
  const need = o.need;
  if (orderPayment(s.storage, o)) return false;
  const left = content.rules.rounds - s.round + 1;
  const growing = (sp: string) => s.grid.some((q) => q.species === sp && !q.blight);
  if (need.kind === 'hybrids') return true;
  if (need.kind === 'species') {
    return Object.entries(need.items).some(([sp, k]) => {
      if ((s.storage[sp] ?? 0) >= k) return false;
      const def = content.species[sp];
      if (def.kind === 'wild') return !stillFindable(s, sp);
      return !growing(sp) && left < nightsToFruit(sp);
    });
  }
  if (need.kind === 'zone') return !orderSpecies(o)!.some((sp) => stillFindable(s, sp));
  return false;
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
 * With `plan`, it chases orders the way a player who plans does: it forages the zone most likely to deal what the board
 * wants, keeps order mushrooms out of the sale, buys spawn and substrate for a cultivated order, delivers every order it
 * can on a visit while it can pay for the extra ones, swaps away orders it can no longer fill, hires a hand once leftover
 * coins have stopped scoring, and cooks Truffle Shavings.
 */
export function playYear(
  start: GameState,
  opts: { greed?: number; dive?: boolean; careful?: boolean; forager?: boolean; swap?: boolean; plan?: boolean; onNight?: (report: NightReport) => void } = {},
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
  const wantedGear = ['biggerbasket', 'knife', 'lantern', 'dehydrator', 'fieldguide', 'growtent', 'trailmap', 'blightspray', 'dripline', 'waders', 'compass'];
  const gearCost = (g: string) => content.gear.find((x) => x.id === g)!.cost;
  const fillableOrders = () =>
    board(s)
      .map(orderDef)
      .filter((o) => orderPayment(s.storage, o))
      .sort((a, b) => b.points - a.points);
  /** Every order storage can fill, best first, while the extra deliveries are affordable. */
  const deliverAll = () => {
    for (let o = fillableOrders()[0]; o && s.coins >= deliveryCost(s); o = fillableOrders()[0]) act({ type: 'fillOrder', order: o.id });
  };
  /** Sells what the board doesn't want: everything when it would spoil anyway, otherwise only what no order names. */
  const sellSurplus = (all: boolean) => {
    const want = orderWants(s);
    const distinct = s.orders.visible.some((o) => orderDef(o).need.kind === 'distinct');
    const keep = (id: string) => {
      if (all) return 0;
      const named = board(s).some((o) => {
        const need = orderDef(o).need;
        return (need.kind === 'species' && id in need.items) || ((need.kind === 'zone' || need.kind === 'below') && orderSpecies(orderDef(o))!.includes(id));
      });
      return named || want[id] ? s.storage[id] : distinct ? 1 : 0;
    };
    for (const id of Object.keys(s.storage)) {
      const n = s.storage[id] - keep(id);
      if (n > 0) act({ type: 'sell', species: id, count: n });
    }
  };
  /** A cultivated species an order wants that spawn can still bring to fruit this year, and what it costs to start. */
  const spawnPlan = (): { species: string; substrate: Substrate | null } | null => {
    if (s.basket.length >= basketCapacity(s)) return null;
    const want = orderWants(s);
    for (const id of spawnStock(s).filter((x) => want[x]).sort((a, b) => want[b] - want[a])) {
      if (s.grid.some((q) => q.species === id)) continue;
      const nights = nightsToFruit(id);
      if (s.round + nights - 1 > content.rules.rounds) continue;
      let ok = true;
      for (let r = s.round; r < s.round + nights; r++) if (!inSeason(id, seasonOf(r))) ok = false;
      if (!ok) continue;
      const bed = plantableSquares(s, id).length > 0;
      if (!bed && !emptyGround(s).length) continue;
      const sub = content.species[id].substrates[0];
      const cost = spawnCost(id) + (bed ? 0 : content.rules.substrateCost[sub]);
      if (s.coins >= cost) return { species: id, substrate: bed ? null : sub };
    }
    return null;
  };
  /** One planned market visit; false if nothing there was worth the action. */
  const planMarket = (): boolean => {
    const dehydrated = s.gear.includes('dehydrator');
    const spoiling = s.round % 3 === 0 && !dehydrated && Object.keys(s.storage).length > 0;
    const gear = wantedGear.find((g) => !s.gear.includes(g) && s.perks.shop.includes(g) && s.coins >= gearCost(g));
    const canSwap = () => s.orders.deck.length > 0 && s.coins >= swapCost(s);
    const dead = s.orders.visible.filter((o) => deadOrder(s, o));
    const stored = Object.values(s.storage).reduce((a, b) => a + b, 0);
    const stuck = !fillableOrders().length && stored >= 2 && swappedIn !== s.round;
    if (!fillableOrders().length && !gear && !spoiling && !spawnPlan() && !((dead.length || stuck) && canSwap())) return false;
    deliverAll();
    for (const o of s.orders.visible.filter((x) => deadOrder(s, x))) if (canSwap()) act({ type: 'swapOrder', order: o });
    if (stuck && !fillableOrders().length && canSwap()) {
      swappedIn = s.round;
      act({ type: 'swapOrder', order: s.orders.visible[0] });
    }
    deliverAll();
    if (spoiling || !dehydrated || s.coins < 20) sellSurplus(spoiling);
    deliverAll();
    for (const g of wantedGear) if (!s.gear.includes(g) && s.perks.shop.includes(g) && s.coins >= gearCost(g)) act({ type: 'buyGear', gear: g });
    // A commission once the coins would otherwise sit idle, early enough in the year to fill it.
    const cap = content.rules.coinsPerPoint * content.rules.maxCoinPoints;
    if (s.perks.commissions && !s.commission.open && s.commission.deck.length && s.round <= 9 && s.coins >= commissionCost(s) + Math.min(cap, 20)) {
      act({ type: 'takeCommission' });
    }
    const sp = spawnPlan();
    if (sp) {
      if (sp.substrate) act({ type: 'buySubstrate', substrate: sp.substrate });
      act({ type: 'buySpawn', species: sp.species });
    }
    if (s.market) act({ type: 'leaveMarket' });
    return true;
  };
  /** The open zone most likely to deal what the board wants this season, or null if none deals anything it wants. */
  const planZone = (zones: { id: string }[]): string | null => {
    const want = orderWants(s);
    const season = seasonOf(s.round);
    let best: { id: string; v: number } | null = null;
    for (const { id } of zones) {
      const z = content.zones.find((x) => x.id === id)!;
      const size = z.deck.reduce((n, e) => n + e.copies, 0);
      let v = 0;
      for (const e of z.deck) {
        if (e.card.type !== 'specimen') continue;
        const sp = e.card.species;
        if (content.species[sp].kind === 'wild' && !inSeason(sp, season)) continue;
        v += (e.copies / size) * (want[sp] ?? 0);
      }
      for (const card of z.deep ?? []) if (card.type === 'specimen' && inSeason(card.species, season)) v += 0.3 * (want[card.species] ?? 0);
      if (v > 0 && (!best || v > best.v)) best = { id, v };
    }
    return best?.id ?? null;
  };

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
      // A planner sells what no order takes first, so the coins pay for more deliveries.
      if (opts.plan) {
        sellSurplus(false);
        deliverAll();
      }
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

    if (opts.plan) {
      // Coins past the festival's cap buy time instead.
      const cap = content.rules.coinsPerPoint * content.rules.maxCoinPoints;
      if (s.hiredRound !== s.round && s.coins >= cap + hireCost(s)) act({ type: 'hireHand' });
      if (!s.meal && (s.storage.truffle ?? 0) > 0 && !orderWants(s).truffle) act({ type: 'cook', recipe: 'truffle' });
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
      } else if (opts.plan) {
        const want = orderWants(s);
        const ready = s.basket
          .filter((b) => b.identified && plantableSquares(s, b.species).length)
          .sort((a, b) => (want[b.species] ?? 0) - (want[a.species] ?? 0));
        if (ready.length) {
          act({ type: 'plant', uid: ready[0].uid, square: plantableSquares(s, ready[0].species)[0] });
          continue;
        }
        // A find no bed can take only blocks the basket: onto the compost, where it feeds the Puffball beds.
        for (const b of s.basket.filter((x) => x.identified && !want[x.species])) act({ type: 'discard', uid: b.uid });
      } else {
        const plantable = s.basket.find((b) => b.identified && plantableSquares(s, b.species).length);
        if (plantable) {
          act({ type: 'plant', uid: plantable.uid, square: plantableSquares(s, plantable.species)[0] });
          continue;
        }
      }
      if (opts.plan && planMarket()) {
        while (s.shed.length && emptyGround(s).length) act({ type: 'placeSubstrate', index: 0, square: emptyGround(s)[0] });
        continue;
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
      if (!opts.plan && (s.market || fillable || affordable || (lastMonthOfSeason && Object.keys(s.storage).length && !s.gear.includes('dehydrator')))) {
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
      const zone =
        (opts.plan ? planZone(zones) : null) ??
        (zones[zones.length - 1].id === 'burnscar' ? 'burnscar' : zones[(s.round + s.actionsLeft) % zones.length].id);
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
export function playCampaign(years: number, seed: string, journal: Journal, opts: Parameters<typeof playYear>[1] = {}): { journal: Journal; games: GameState[] } {
  const games: GameState[] = [];
  for (let y = 0; y < years; y++) {
    const slots = heirloomSlots(levelFor(journal.renown).level);
    const choices = heirloomChoices(journal);
    const heirlooms = HEIRLOOM_PREFERENCE.filter((g) => choices.includes(g)).slice(0, slots);
    const end = playYear(newGame({ seed: `${seed}-y${y}`, perks: perksFor(journal, heirlooms) }), opts);
    journal = recordYear(journal, end);
    games.push(end);
  }
  return { journal, games };
}
