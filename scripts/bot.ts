import {
  basketCapacity,
  canCook,
  cellarReady,
  commissionCost,
  content,
  deliveryCost,
  descendStatus,
  dispatch,
  emptyGround,
  harvestYield,
  heirloomChoices,
  heirloomSlots,
  hireCost,
  inSeason,
  isDamp,
  isWatered,
  layersOpen,
  levelFor,
  newGame,
  nextCommission,
  orderById,
  orderPayment,
  orderSpecies,
  perksFor,
  recordYear,
  plantableSquares,
  seasonOf,
  spawnCost,
  spawnStock,
  speciesOpen,
  stageLength,
  swapCost,
  zoneStatus,
  type Action,
  type ActionResult,
  hazardsNear,
  nearCells,
  type ForageTrip,
  type GameState,
  type Journal,
  type NightReport,
  type OrderDef,
  type Substrate,
} from '../src/core';
import { isShaded, neighbors } from '../src/core/board';

/**
 * Reads the forest floor the way a careful player would: a turned card's number says how many
 * hazards sit beside it, so spread each number's remaining hazards over its hidden neighbors
 * and turn the card that looks least risky. Unknown cards count as the zone's base rate.
 */
function safestCard(t: ForageTrip): { index: number; risk: number } | null {
  // A zone rule can say outright that a card is a mushroom: the fairy ring's centre, or one the mycelium shows.
  const known = (p: ForageTrip['patch'][number]) => !!p.ring || p.sign !== undefined;
  const risk: number[] = t.patch.map(() => 0.25);
  t.patch.forEach((p, i) => {
    if (!p.flipped || p.card.type === 'hazard') return;
    // The cards the number counts, as the engine counts them: only those actually dealt, and the corners too in the Old-growth.
    const around = nearCells(t, i);
    const hidden = around.filter((n) => !t.patch[n].flipped);
    const found = around.filter((n) => t.patch[n].flipped && t.patch[n].card.type === 'hazard').length;
    const left = hazardsNear(t, i) - found;
    for (const n of hidden) risk[n] = left === 0 ? 0 : Math.max(risk[n] === 0 ? 0 : risk[n], left / hidden.length);
  });
  t.patch.forEach((p, i) => known(p) && (risk[i] = 0));
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
      if (short > 0)
        for (const id of content.speciesOrder) if (!have(id) && content.species[id].kind !== 'hybrid' && speciesOpen(id, s.perks)) add(id, o.points / short / 2);
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

/** Months left this year, this one included, in which a wild species is in season in a zone open now. */
function findableMonths(s: GameState, id: string): number {
  let n = 0;
  for (let r = s.round; r <= content.rules.rounds; r++) {
    const season = seasonOf(r);
    if (!inSeason(id, season)) continue;
    if ((SOURCES[id] ?? []).some((src) => zoneStatus(s, content.zones.find((z) => z.id === src.zone)!).open)) n++;
  }
  return n;
}

/**
 * What a bed will bring in before the festival if nothing goes wrong: a fruiting each time it steps through a month in
 * season (or under the tent), none at all if it needs shade and has none, two a harvest if it's heavy. A bed already
 * fruiting is picked this month.
 */
function bedYield(s: GameState, id: string, from: 'S' | 'C' | 'P' | 'F', shaded: boolean, tent = false): number {
  const def = content.species[id];
  if (def.traits.needsShade && !shaded) return 0;
  const cycle = stageLength('C', def.growth) + stageLength('P', def.growth);
  let need = from === 'S' ? 1 + cycle : from === 'C' ? cycle : from === 'P' ? stageLength('P', def.growth) : 0;
  let n = 0;
  if (need === 0) [n, need] = [1, cycle];
  for (let r = s.round; r <= content.rules.rounds; r++) {
    if (!tent && !inSeason(id, seasonOf(r))) continue;
    if (--need <= 0) [n, need] = [n + 1, cycle];
  }
  return n * harvestYield(id);
}

/** What the beds of a species on the farm will bring in before the festival. */
function bedsYield(s: GameState, id: string): number {
  return s.grid.reduce((n, q, i) => (q.species === id && !q.blight ? n + bedYield(s, id, q.stage!, isShaded(s.grid, i, s.size), q.tent) : n), 0);
}

/** How much of an order storage covers: specimens toward each species it names, or toward its count. */
function progress(storage: Record<string, number>, o: OrderDef): number {
  const need = o.need;
  const have = (id: string) => storage[id] ?? 0;
  if (need.kind === 'species') return Object.entries(need.items).reduce((n, [id, k]) => n + Math.min(k, have(id)), 0);
  if (need.kind === 'distinct') return Math.min(need.count, Object.keys(storage).filter((id) => have(id) > 0).length);
  const pool = orderSpecies(o);
  return pool && 'count' in need ? Math.min(need.count, pool.reduce((n, id) => n + have(id), 0)) : 0;
}

/**
 * Whether the planner can expect to fill a commission before the festival. Stricter than deadOrder, since a commission
 * is paid for up front and can't be swapped: what storage holds, what the beds will fruit in season, what up to two new
 * beds could add, and for wild finds the months left in season in a zone open now.
 */
function commissionInReach(s: GameState, id: string): boolean {
  const o = orderDef(id);
  const need = o.need;
  if (orderPayment(s.storage, o)) return true;
  if (deadOrder(s, id) && need.kind !== 'hybrids') return false;
  const have = (sp: string) => s.storage[sp] ?? 0;
  const room = Math.min(1, emptyGround(s).length);
  const fresh = (sp: string) => (spawnStock(s).includes(sp) ? Math.min(room, Math.max(0, (need.kind === 'species' ? need.items[sp] : 1) - have(sp) - bedsYield(s, sp))) * bedYield(s, sp, 'S', true) : 0);
  if (need.kind === 'species') {
    return Object.entries(need.items).every(([sp, k]) => {
      if (have(sp) >= k) return true;
      if (content.species[sp].kind === 'wild') return have(sp) + findableMonths(s, sp) / 2 >= k;
      return have(sp) + bedsYield(s, sp) + fresh(sp) >= k;
    });
  }
  if (need.kind === 'hybrids') return orderSpecies(o)!.reduce((n, sp) => n + have(sp) + bedsYield(s, sp), 0) >= need.count;
  if (need.kind === 'distinct') {
    // Wild species still to be found count for half: the planner forages most months, but finds aren't certain.
    const kinds = new Set([...Object.keys(s.storage), ...content.speciesOrder.filter((sp) => bedsYield(s, sp) > 0)]);
    const wild = content.speciesOrder.filter((sp) => !kinds.has(sp) && content.species[sp].kind === 'wild' && findableMonths(s, sp) > 0).length;
    return kinds.size + wild / 2 >= need.count;
  }
  if (need.kind === 'zone') {
    // Each month a species the zone's floor deals is in season counts as a find; its deep patches are too long a shot.
    const zone = content.zones.find((z) => z.id === need.zone)!;
    if (!zoneStatus(s, zone).open) return false;
    const floor = new Set(zone.deck.flatMap((e) => (e.card.type === 'specimen' ? [e.card.species] : [])));
    let expect = orderSpecies(o)!.reduce((n, sp) => n + have(sp), 0);
    for (let r = s.round; r <= content.rules.rounds; r++) {
      for (const sp of orderSpecies(o)!) if (floor.has(sp) && inSeason(sp, seasonOf(r))) expect += 1;
    }
    return expect >= need.count;
  }
  return !deadOrder(s, id);
}

/** What the open commission still lacks of each species it names, beyond storage. */
function commissionShort(s: GameState): Record<string, number> {
  const need = s.commission.open ? orderDef(s.commission.open).need : null;
  const short: Record<string, number> = {};
  if (need?.kind === 'species') for (const [sp, k] of Object.entries(need.items)) if (k > (s.storage[sp] ?? 0)) short[sp] = k - (s.storage[sp] ?? 0);
  return short;
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
 * coins have stopped scoring, and cooks a points dish (Truffle Shavings and the like) from finds no order wants.
 * With `cache`, it buys the Spade and, once the family's marks point to the tree, the place and the season, goes to dig
 * out the Founder's Cellar at the first chance.
 * With `rare` as well, the planner goes after a points dish's makings: it buys the gear that opens their zones first,
 * forages where they grow, and walks a clean trip down to the deep patches when the deep card could be one.
 */
export function playYear(
  start: GameState,
  opts: {
    greed?: number;
    dive?: boolean;
    careful?: boolean;
    forager?: boolean;
    swap?: boolean;
    plan?: boolean;
    /** Buy the Spade and dig for truffles: only on a trip's way home ('exit'), or by heading for oak and hazel in winter ('hunt'). */
    spade?: 'exit' | 'hunt';
    /** Solve the Founder's Cache on schedule: dig at the answer as soon as the marks are all in and the season comes. */
    cache?: boolean;
    /** A planner after the makings of a points dish: the gear that opens their zones first, and deep walks to find them. */
    rare?: boolean;
    onNight?: (report: NightReport) => void;
    onResult?: (action: Action, result: ActionResult) => void;
  } = {},
): GameState {
  const greed = opts.greed ?? 3;
  let s = start;
  const act = (a: Action) => {
    const r = dispatch(s, a);
    s = r.state;
    if (r.result.kind === 'night') opts.onNight?.(r.result.report);
    opts.onResult?.(a, r.result);
  };
  const value = (id: string | null) => (id ? content.species[id].value : 0);
  let swappedIn = 0;
  // The Spade comes after the gear that pays every trip.
  const usualGear = ['biggerbasket', 'knife', 'lantern', 'dehydrator', 'fieldguide', 'growtent', 'trailmap', 'blightspray', 'dripline', 'waders', ...(opts.spade || opts.cache ? ['spade'] : []), 'compass'];
  const wantedGear = opts.rare ? [...RARE_GEAR, ...usualGear.filter((g) => !RARE_GEAR.includes(g))] : usualGear;
  const gearCost = (g: string) => content.gear.find((x) => x.id === g)!.cost;
  /** Whether delivering this order would set back the open commission while it can still be filled; never on festival morning. */
  const robsCommission = (o: OrderDef) => {
    const open = s.commission.open;
    if (!opts.plan || !open || o.id === open || s.finale || !commissionInReach(s, open)) return false;
    const after = { ...s.storage };
    for (const [id, n] of Object.entries(orderPayment(s.storage, o)!)) after[id] -= n;
    return progress(after, orderDef(open)) < progress(s.storage, orderDef(open));
  };
  const fillableOrders = () =>
    board(s)
      .map(orderDef)
      .filter((o) => orderPayment(s.storage, o) && !robsCommission(o))
      .sort((a, b) => b.points - a.points);
  /** Every order storage can fill, best first, while the extra deliveries are affordable. */
  const deliverAll = () => {
    for (let o = fillableOrders()[0]; o && s.coins >= deliveryCost(s); o = fillableOrders()[0]) act({ type: 'fillOrder', order: o.id });
  };
  const feasts = content.recipes.filter((r) => r.effect.type === 'points');
  /** The planner's dish for the month: a points dish from finds no order wants. Cooking costs no action. */
  const feast = () => {
    if (!opts.plan || s.meal || s.finale || s.feastPoints >= content.rules.maxFeastPoints) return;
    const wants = orderWants(s);
    const dish = feasts.find((r) => canCook(s, r) && Object.keys(r.needs).every((id) => !wants[id]));
    if (dish) act({ type: 'cook', recipe: dish.id });
  };
  /** What the planner forages for: the orders' wants, and a points dish's points spread over the makings it still lacks. */
  const huntWants = () => {
    const want = orderWants(s);
    if (s.feastPoints >= content.rules.maxFeastPoints) return want;
    for (const r of feasts) {
      const missing = Object.keys(r.needs).filter((id) => (s.storage[id] ?? 0) < r.needs[id]);
      const points = r.effect.type === 'points' ? r.effect.amount : 0;
      for (const id of missing) want[id] = Math.max(want[id] ?? 0, points / missing.length);
    }
    return want;
  };
  /** Sells what the board doesn't want: everything when it would spoil anyway, otherwise only what no order names or a points dish needs. */
  const sellSurplus = (all: boolean) => {
    const want = orderWants(s);
    if (s.feastPoints < content.rules.maxFeastPoints) for (const r of feasts) for (const id of Object.keys(r.needs)) want[id] ??= 1;
    const distinct = board(s).some((o) => orderDef(o).need.kind === 'distinct');
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
    const short = commissionShort(s);
    for (const id of spawnStock(s).filter((x) => want[x]).sort((a, b) => want[b] - want[a])) {
      // One bed for an order; for the commission, more while the beds won't fruit what it still lacks.
      if (s.grid.some((q) => q.species === id) && bedsYield(s, id) >= (short[id] ?? 0)) continue;
      const nights = nightsToFruit(id);
      // A bed for the commission may wait out of season for its next one; a bed for an order has to grow straight through.
      let ok = s.round + nights - 1 <= content.rules.rounds;
      for (let r = s.round; r < s.round + nights; r++) if (!inSeason(id, seasonOf(r))) ok = false;
      if (!ok && !(short[id] && bedYield(s, id, 'S', true) > 0)) continue;
      const shade = content.species[id].traits.needsShade;
      const bed = plantableSquares(s, id).some((i) => !shade || isShaded(s.grid, i, s.size));
      if (!bed && !emptyGround(s).some((i) => !shade || isShaded(s.grid, i, s.size))) continue;
      const sub = content.species[id].substrates[0];
      const cost = spawnCost(id) + (bed ? 0 : content.rules.substrateCost[sub]);
      if (s.coins >= cost) return { species: id, substrate: bed ? null : sub };
    }
    return null;
  };
  /** A commission worth taking now: one the planner can expect to fill, and the coins for it. */
  const commissionDue = () => {
    const commission = s.perks.commissions && !s.commission.open && s.round <= 10 ? nextCommission(s) : null;
    return !!commission && commissionInReach(s, commission) && s.coins >= commissionCost(s);
  };
  /** One planned market visit; false if nothing there was worth the action. */
  const planMarket = (): boolean => {
    // Gear waits for the year's first commission while the planner can fill it and the coins can't cover both.
    const commissionAhead = s.perks.commissions && !s.commission.taken && s.round <= 10 && !!nextCommission(s) && commissionInReach(s, nextCommission(s)!);
    const saving = () => (commissionAhead && !s.commission.taken ? commissionCost(s) : 0);
    const dehydrated = s.gear.includes('dehydrator');
    const spoiling = s.round % 3 === 0 && !dehydrated && Object.keys(s.storage).length > 0;
    const gear = wantedGear.find((g) => !s.gear.includes(g) && s.perks.shop.includes(g) && s.coins >= gearCost(g) + saving());
    const canSwap = () => s.orders.deck.length > 0 && s.coins >= swapCost(s);
    const dead = s.orders.visible.filter((o) => deadOrder(s, o));
    const stored = Object.values(s.storage).reduce((a, b) => a + b, 0);
    const stuck = !fillableOrders().length && stored >= 2 && swappedIn !== s.round;
    if (!fillableOrders().length && !gear && !spoiling && !spawnPlan() && !commissionDue() && !((dead.length || stuck) && canSwap())) return false;
    deliverAll();
    for (const o of s.orders.visible.filter((x) => deadOrder(s, x))) if (canSwap()) act({ type: 'swapOrder', order: o });
    if (stuck && !fillableOrders().length && canSwap()) {
      swappedIn = s.round;
      act({ type: 'swapOrder', order: s.orders.visible[0] });
    }
    deliverAll();
    if (spoiling || !dehydrated || s.coins < 20) sellSurplus(spoiling);
    deliverAll();
    // A commission comes before gear: it pays 12-14 points for 6 coins, if the one it would deal is one the planner can fill.
    if (commissionDue()) act({ type: 'takeCommission' });
    for (const g of wantedGear) if (!s.gear.includes(g) && s.perks.shop.includes(g) && s.coins >= gearCost(g) + saving()) act({ type: 'buyGear', gear: g });
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
    const want = opts.rare ? huntWants() : orderWants(s);
    const season = seasonOf(s.round);
    let best: { id: string; v: number } | null = null;
    for (const { id } of zones) {
      const z = content.zones.find((x) => x.id === id)!;
      // The deck as dealt this year: no cards for species the level hasn't unlocked.
      const deck = z.deck.filter((e) => !e.unlock || speciesOpen(e.unlock, s.perks));
      const size = deck.reduce((n, e) => n + e.copies, 0);
      let v = 0;
      for (const e of deck) {
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

  const shaded = (i: number) => isShaded(s.grid, i, s.size);
  /**
   * Where the next substrate from the shed goes: the first empty ground, but for a planner holding a find that needs shade
   * and has no shaded bed to go to, beside a tree.
   */
  const groundFor = (): number => {
    const ground = emptyGround(s);
    const sub = s.shed[0];
    const shy = (id: string) => content.species[id].traits.needsShade && content.species[id].substrates.includes(sub) && !plantableSquares(s, id).some(shaded);
    const spot = ground.find(shaded);
    return opts.plan && spot !== undefined && s.basket.some((b) => b.identified && shy(b.species)) ? spot : ground[0];
  };
  /** The planner's bed for a find: shaded first if it needs shade, then away from its own kind, since crowding blights. */
  const bestSquare = (id: string): number => {
    const shade = content.species[id].traits.needsShade;
    const cost = (i: number) => (shade && !shaded(i) ? 10 : 0) + neighbors(i, s.size).filter((n) => s.grid[n].species === id).length;
    return plantableSquares(s, id).sort((a, b) => cost(a) - cost(b))[0];
  };

  const truffleSeason = () => inSeason(content.rules.dig.species, seasonOf(s.round));
  /** With `cache`, whether this month the answer can be dug: every mark in, a Spade, and the cache's season. */
  const cellarDue = () => !!opts.cache && s.gear.includes('spade') && cellarReady(s) && seasonOf(s.round) === content.cache.season;
  /**
   * Where to dig in this surface patch with a Spade in hand: the cache's tree when the cellar is due there,
   * else a turned oak or hazel in truffle season.
   */
  const digSpot = (): number => {
    const t = s.forage;
    if (!t || t.status !== 'open' || t.layer || !s.gear.includes('spade')) return -1;
    const turned = (names: string[]) => t.patch.findIndex((p) => p.flipped && p.card.type === 'ground' && names.includes(p.card.name));
    if (cellarDue() && t.zone === content.cache.zone) {
      const i = turned([content.cache.card]);
      if (i >= 0) return i;
    }
    return opts.spade && truffleSeason() ? turned(content.rules.dig.hosts) : -1;
  };
  /** Whether this trip is out to dig the cellar and has its tree turned. */
  const cellarSpot = () => cellarDue() && s.forage?.zone === content.cache.zone && digSpot() >= 0;
  /** Heads home, digging on the way out when there's a truffle spot turned. */
  const leave = () => {
    const i = digSpot();
    act(i >= 0 ? { type: 'dig', index: i } : { type: 'stopForage' });
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
      const best = fillableOrders()[0];
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
    while (s.shed.length && emptyGround(s).length) act({ type: 'placeSubstrate', index: 0, square: groundFor() });
    if (s.gear.includes('growtent') && !s.tentPlaced) {
      const bed = s.grid.findIndex((sq) => sq.species && !sq.tree);
      act({ type: 'placeTent', square: bed >= 0 ? bed : s.grid.findIndex((sq) => !sq.tree) });
    }

    if (opts.plan) {
      // Coins past the festival's cap buy time instead.
      const cap = content.rules.coinsPerPoint * content.rules.maxCoinPoints;
      if (s.hiredRound !== s.round && s.coins >= cap + hireCost(s)) act({ type: 'hireHand' });
    }
    while (s.actionsLeft > 0) {
      feast();
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
          act({ type: 'plant', uid: ready[0].uid, square: bestSquare(ready[0].species) });
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
        while (s.shed.length && emptyGround(s).length) act({ type: 'placeSubstrate', index: 0, square: groundFor() });
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
      const affordable = wantedGear.find(
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
        for (const g of wantedGear) {
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
      // A truffle hunter heads for the oak and hazel woods in winter, taking turns between them.
      const hosts = zones.filter((z) => z.id === 'mixedwoods' || z.id === 'hollow');
      const hunt = opts.spade === 'hunt' && s.gear.includes('spade') && truffleSeason() && hosts.length ? hosts[s.tripCount % hosts.length].id : null;
      const cellar = cellarDue() && zones.some((z) => z.id === content.cache.zone) ? content.cache.zone : null;
      const zone =
        cellar ??
        hunt ??
        (opts.plan ? planZone(zones) : null) ??
        (zones[zones.length - 1].id === 'burnscar' ? 'burnscar' : zones[(s.round + s.actionsLeft) % zones.length].id);
      const dive = !!opts.dive && !cellar && layersOpen(s.perks.generation, zone) > 0 && s.tripCount % 2 === 1;
      act({ type: 'forage', zone });
      while (s.forage?.status === 'open') {
        const t: ForageTrip = s.forage;
        const way = t.patch.find((p) => p.card.type === 'entrance');
        // Turned around in the Hollow: walk on if the zone has cards left, or else head home.
        if (t.turnedAround) {
          if (s.decks[t.zone].draw.length) act({ type: 'deeper' });
          else leave();
          continue;
        }
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
          else leave();
          continue;
        }
        if (cellarSpot() || (opts.spade === 'hunt' && digSpot() >= 0)) {
          leave();
          continue;
        }
        // After a points dish, a clean trip walks down to the deep patches when the deep card could be one of its makings.
        if (opts.rare && t.layer === 0 && t.depth < content.rules.deepAt && t.hazards === 0 && s.decks[t.zone].draw.length) {
          const want = huntWants();
          const deep = content.zones.find((z) => z.id === t.zone)!.deep;
          if (deep.some((c) => c.type === 'specimen' && inSeason(c.species, seasonOf(s.round)) && feasts.some((r) => r.needs[c.species] && want[c.species]))) {
            act({ type: 'deeper' });
            continue;
          }
        }
        const full = s.basket.length >= (s.gear.includes('biggerbasket') ? 6 : 4);
        const pick = safestCard(t);
        // Plain ground is no find: greed counts what the trip has actually brought in.
        const finds = t.drawn.filter((d) => d.card.type !== 'ground' && d.card.type !== 'entrance').length;
        if (full || (t.hazards >= 1 && finds >= greed)) leave();
        else if (pick && (pick.risk < 0.35 || t.hazards === 0)) act({ type: 'flip', index: pick.index });
        else if (t.layer === 0 && t.depth < 3 && t.hazards === 0) act({ type: 'deeper' });
        // From a later generation on, a clean trip that has walked the deep patches goes underground.
        else if (t.hazards === 0 && descendStatus(s).open) act({ type: 'descend' });
        else leave();
      }
      act({ type: 'closeTrip' });
    }
    feast();
    act({ type: 'endMonth' });
  }
  return s;
}

/** The gear that opens the zones where a points dish's makings grow: the Burn Scar, the Old-growth and the Hollow. */
export const RARE_GEAR = ['trailmap', 'lantern', 'compass'];
export const HEIRLOOM_PREFERENCE = ['biggerbasket', 'knife', 'lantern', 'dripline', 'fieldguide', 'dehydrator', 'growtent', 'trailmap', 'blightspray', 'compass', 'spade'];

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
