import { content as defaultContent } from './content';
import { Rng, hashSeed } from './rng';
import { runGrowth } from './growth';
import { crossKey, farmLayout, hybridFor, inSeason, neighbors, seasonOf } from './board';
import { speciesOpen } from './progression';
import { artifactDef, buildLayerDeck, hasSetEffect, layerDef, layerKey, layersOpen, recoveryCost, setBonus } from './underground';

export * from './board';
import type {
  Action,
  ActionResult,
  CacheMark,
  Card,
  DrawOutcome,
  ForageTrip,
  IdentifyResult,
  Content,
  GameState,
  MealEffect,
  OrderDef,
  PatchCard,
  Perks,
  RecipeDef,
  Specimen,
  Square,
  Substrate,
  ZoneDef,
} from './types';

export class GameError extends Error {}

function fail(message: string): never {
  throw new GameError(message);
}

// ── Queries ──────────────────────────────────────────────────────────────

/** The effect of the dish eaten this month, if any. */
export function mealEffect(s: GameState, c: Content = defaultContent): MealEffect | null {
  return (s.meal && c.recipes.find((r) => r.id === s.meal)?.effect) || null;
}

/** How much this month's dish adds to one kind of effect (0 when it's some other dish, or none). */
function mealBonus(s: GameState, type: 'actions' | 'hazards' | 'basket' | 'market', c: Content): number {
  const e = mealEffect(s, c);
  return e && e.type === type ? e.amount : 0;
}

/** How much this year's Legend challenges add to one kind of effect (negative for a handicap). */
function challengeEffect(perks: Perks, type: 'actions' | 'basket', c: Content): number {
  let n = 0;
  for (const id of perks.challenges) {
    const e = c.progression.challenges.find((x) => x.id === id)?.effect;
    if (e && e.type === type) n += e.amount;
  }
  return n;
}

function isLean(perks: Perks, c: Content): boolean {
  return perks.challenges.some((id) => c.progression.challenges.find((x) => x.id === id)?.effect.type === 'lean');
}

export function basketCapacity(s: GameState, c: Content = defaultContent): number {
  const base = s.gear.includes('biggerbasket') ? c.rules.biggerBasketSize : c.rules.basketSize;
  return (
    base +
    (s.weather === 'goodseason' ? 1 : 0) +
    mealBonus(s, 'basket', c) +
    challengeEffect(s.perks, 'basket', c) +
    setBonus(s.perks.sets, 'basket', c)
  );
}

/** Finds a bust lets you keep: the kit's first two, and one more with the Mushroom Stones. */
export function bustKeep(s: GameState, c: Content = defaultContent): number {
  return c.rules.bustKeep + setBonus(s.perks.sets, 'keep', c);
}

/** Rare finds and artifacts glint face down: the Forager's Lantern. */
export function glints(s: GameState, c: Content = defaultContent): boolean {
  return hasSetEffect(s.perks.sets, 'glint', c);
}

/** Hazards that bust a forage trip this month. */
export function bustAt(s: GameState, c: Content = defaultContent): number {
  return c.rules.bustAt + mealBonus(s, 'hazards', c);
}

/** Beds count as watered tonight: by hand, by rain, by a Drip Line, or by the neighbors after supper. */
export function isWatered(s: GameState, c: Content = defaultContent): boolean {
  return s.watered || s.weather === 'rain' || s.gear.includes('dripline') || mealEffect(s, c)?.type === 'water';
}

export function masteryOf(s: GameState, speciesId: string): number {
  return s.perks.mastery[speciesId] ?? 0;
}

/** The highest identification roll that still turns out to be a lookalike; Familiar species fool you on one fewer. */
export function lookalikeOn(s: GameState, speciesId: string, c: Content = defaultContent): number {
  const on = c.species[speciesId].lookalike?.on ?? 1;
  const sharp = mealEffect(s, c)?.type === 'identify' ? 1 : 0;
  return Math.max(0, on - (masteryOf(s, speciesId) >= 1 ? 1 : 0) - sharp);
}

export function saleValue(s: GameState, speciesId: string, c: Content = defaultContent): number {
  return c.species[speciesId].value + (s.weather === 'marketday' ? 1 : 0) + (masteryOf(s, speciesId) >= 3 ? 1 : 0) + mealBonus(s, 'market', c);
}

/** Coins to swap a festival order off the board: dearer with every swap this year. */
export function swapCost(s: GameState, c: Content = defaultContent): number {
  return c.rules.swapCost + s.orderSwaps;
}

/** Coins to take on a commission: dearer with every one taken this year. */
export function commissionCost(s: GameState, c: Content = defaultContent): number {
  return c.rules.commissionCost * c.rules.commissionGrowth ** s.commission.taken;
}

/** The commissions a year can deal, shuffled from their own seed so the rest of the year's dealing is untouched. */
function commissionDeck(seed: string, perks: Perks, c: Content): string[] {
  return new Rng(hashSeed(`${seed}:commissions`)).shuffle(c.commissions.filter((o) => orderDealable(o, perks, c)).map((o) => o.id));
}

/**
 * Whether a commission could still be filled this year: every species it names is in storage already or comes into
 * season before the year ends, and a zone it draws on is still to open.
 */
export function commissionFillable(s: GameState, order: OrderDef, c: Content = defaultContent): boolean {
  const seasons = new Set(Array.from({ length: c.rules.rounds - s.round + 1 }, (_, i) => seasonOf(s.round + i, c)));
  const need = order.need;
  if (need.kind === 'species') {
    return Object.entries(need.items).every(([id, n]) => (s.storage[id] ?? 0) >= n || [...seasons].some((season) => inSeason(id, season, c)));
  }
  if (need.kind === 'zone') {
    const zone = c.zones.find((z) => z.id === need.zone);
    return !zone?.seasons || zone.seasons.some((season) => seasons.has(season));
  }
  return true;
}

/** The commission taking one would deal: the first waiting that can still be filled, or null if none can. */
export function nextCommission(s: GameState, c: Content = defaultContent): string | null {
  return s.commission.deck.find((id) => commissionFillable(s, orderById(id, c)!, c)) ?? null;
}

/** An order or the open commission, by id. */
export function orderById(id: string, c: Content = defaultContent): OrderDef | undefined {
  return c.orders.find((o) => o.id === id) ?? c.commissions.find((o) => o.id === id);
}

/** Coins to hire a hand: dearer with every hand hired this year. */
export function hireCost(s: GameState, c: Content = defaultContent): number {
  return c.rules.hireCost + c.rules.hireStep * s.hires;
}

/** Coins to deliver an order on this market visit: free for the first, then rules.extraDeliveryCost, growing with each one after. */
export function deliveryCost(s: GameState, c: Content = defaultContent): number {
  const done = s.market?.deliveries ?? 0;
  return done ? c.rules.extraDeliveryCost * c.rules.extraDeliveryGrowth ** (done - 1) : 0;
}

export function spawnCost(speciesId: string, c: Content = defaultContent): number {
  return c.species[speciesId].value + c.rules.spawnMarkup;
}

/** Cultivated species the market sells spawn of: any in your field journal, or identified this year, once the homestead's level has them. */
export function spawnStock(s: GameState, c: Content = defaultContent): string[] {
  return c.speciesOrder.filter(
    (id) => c.species[id].kind === 'cultivated' && (s.perks.spawn.includes(id) || s.discovered.includes(id)) && speciesOpen(id, s.perks, c),
  );
}

/** Mushrooms one harvest of a bed brings in: two for a heavy species. */
export function harvestYield(speciesId: string, c: Content = defaultContent): number {
  return c.species[speciesId].traits.heavy ? 2 : 1;
}

/** Whether storage holds what a dish needs. */
export function canCook(s: GameState, recipe: RecipeDef): boolean {
  return Object.entries(recipe.needs).every(([id, n]) => (s.storage[id] ?? 0) >= n);
}

export function compostSaleValue(s: GameState, c: Content = defaultContent): number {
  return c.rules.compostValue + (s.weather === 'marketday' ? 1 : 0);
}

export function actionsPerMonth(s: GameState, c: Content = defaultContent): number {
  return c.rules.actionsPerRound + s.perks.bonusActions + challengeEffect(s.perks, 'actions', c);
}

/** How far this year's festival tiers sit above the printed ones: the homestead's level, and each generation it has been passed on. */
export function tierLift(perks: Perks, c: Content = defaultContent): { level: number; generation: number } {
  const level = c.progression.levels.find((l) => l.level === perks.level)?.tierLift ?? 0;
  return { level, generation: (perks.generation - 1) * c.progression.legacy.tierStep };
}

/** The festival tiers for this year: every threshold rises with the homestead's level and with each generation. */
export function tiersFor(s: GameState, c: Content = defaultContent) {
  const { level, generation } = tierLift(s.perks, c);
  const lift = level + generation;
  return c.rules.tiers.map((t) => ({ ...t, min: t.min + lift }));
}

export function isDamp(s: GameState, index: number): boolean {
  return s.grid[index]?.damp ?? false;
}

export type ZoneStatus = { open: true } | { open: false; reason: string; notStocked?: boolean };

export function zoneStatus(s: GameState, zone: ZoneDef, c: Content = defaultContent): ZoneStatus {
  if (zone.unlock && !s.gear.includes(zone.unlock)) {
    const gear = c.gear.find((g) => g.id === zone.unlock);
    if (!s.perks.shop.includes(zone.unlock)) return { open: false, reason: 'Not on your map yet', notStocked: true };
    return { open: false, reason: `Needs the ${gear?.name ?? zone.unlock}` };
  }
  const season = seasonOf(s.round, c);
  if (zone.seasons && !zone.seasons.includes(season)) {
    const open = zone.seasons.length > 1 ? `${zone.seasons.slice(0, -1).join(', ')} and ${zone.seasons[zone.seasons.length - 1]}` : zone.seasons[0];
    return { open: false, reason: `Only open in ${open}` };
  }
  const weather = c.weather.find((w) => w.id === s.weather);
  if (weather?.closes?.includes(zone.id)) return { open: false, reason: `Closed by ${weather.name.toLowerCase()}` };
  return { open: true };
}

/** Whether this trip can go down into the next layer below its zone: once the way down in this patch has been turned. */
export function descendStatus(s: GameState, c: Content = defaultContent): ZoneStatus {
  const trip = s.forage;
  if (!trip || trip.status !== 'open') return { open: false, reason: 'You are not out foraging.' };
  const open = layersOpen(s.perks.generation, trip.zone, c);
  if (trip.layer >= open) {
    const zone = c.zones.find((z) => z.id === trip.zone)!;
    return { open: false, reason: open ? 'This is as deep as your generation can go.' : `Nothing under the ${zone.name.replace(/^The /, '')} is open to your generation.` };
  }
  const way = trip.patch.find((p) => p.card.type === 'entrance');
  if (way?.flipped) return { open: true };
  if (way) return { open: false, reason: 'One card in this patch hides the way down. Turn it to descend.' };
  // On the surface, the way down lies in the zone's last patch; the Mapmaker's Case knows a shorter one.
  return { open: false, reason: `The way down is in the ${hasSetEffect(s.perks.sets, 'shortcut', c) ? 'first deep' : 'last'} patch of the zone.` };
}

/** Whether this trip can dig under a patch card: a turned ground card on the surface, with a Spade. */
export function digStatus(s: GameState, index: number): ZoneStatus {
  const trip = s.forage;
  if (!trip || trip.status !== 'open') return { open: false, reason: 'You are not out foraging.' };
  if (!s.gear.includes('spade')) return { open: false, reason: 'You need a Spade to dig.' };
  if (trip.layer) return { open: false, reason: 'Dig on the surface, not below it.' };
  const spot = trip.patch[index];
  if (!spot?.flipped || spot.card.type !== 'ground') return { open: false, reason: 'Dig under a turned card of plain ground.' };
  return { open: true };
}

/** What the family's marks point to so far: the cabinet's artifacts and any brought home this year. */
export function cacheMarks(s: GameState, c: Content = defaultContent): CacheMark[] {
  const ids = new Set([...s.perks.clues, ...s.artifacts]);
  const marks = c.artifacts.flatMap((a) => (ids.has(a.id) && a.mark ? [a.mark] : []));
  return (['tree', 'place', 'season'] as const).filter((m) => marks.includes(m));
}

/**
 * Whether a dig in the right spot would open the Founder's Cellar: a story year, not yet found, and
 * marks pointing to the tree, the place and the season, so it's never found by accident.
 */
export function cellarReady(s: GameState, c: Content = defaultContent): boolean {
  return s.mode === 'story' && !s.perks.cacheFound && !s.cacheFound && cacheMarks(s, c).length === 3;
}

/**
 * What a fall in the next layer down would cost next month, so the stakes can be named before descending.
 * Null when this trip can't go any deeper.
 */
export function descendCost(s: GameState, c: Content = defaultContent): number | 'month' | null {
  const trip = s.forage;
  if (!trip || trip.status !== 'open' || trip.layer >= layersOpen(s.perks.generation, trip.zone, c)) return null;
  return recoveryCost(trip.layer + 1, s.perks.sets, c);
}

export function canPlantOn(s: GameState, speciesId: string, index: number, c: Content = defaultContent): boolean {
  const sq = s.grid[index];
  const sp = c.species[speciesId];
  return !sq.tree && !sq.species && sq.substrate !== null && sp.substrates.includes(sq.substrate);
}

export function plantableSquares(s: GameState, speciesId: string, c: Content = defaultContent): number[] {
  return s.grid.map((_, i) => i).filter((i) => canPlantOn(s, speciesId, i, c));
}

export function emptyGround(s: GameState): number[] {
  return s.grid.map((_, i) => i).filter((i) => !s.grid[i].tree && s.grid[i].substrate === null);
}

/**
 * With the basket full, a rare find or a wild one bumps out a lesser specimen: rare outranks wild,
 * and wild outranks cultivated. It takes the lowest-ranked, then the cheapest. Null if nothing ranks lower.
 */
export function bumpFor(s: GameState, wild: boolean, rare: boolean, c: Content = defaultContent): Specimen | null {
  const rank = (isWild: boolean, isRare: boolean) => (isRare ? 2 : isWild ? 1 : 0);
  const mine = rank(wild, rare);
  const rankOf = (b: Specimen) => rank(c.species[b.species].kind === 'wild', !!b.rare);
  const lesser = s.basket.filter((b) => rankOf(b) < mine);
  lesser.sort((a, b) => rankOf(a) - rankOf(b) || c.species[a.species].value - c.species[b.species].value);
  return lesser[0] ?? null;
}

/** The species an "any N of these" order takes, in content order; null for orders that name their species or take anything. */
export function orderSpecies(order: OrderDef, c: Content = defaultContent): string[] | null {
  const need = order.need;
  if (need.kind === 'hybrids') return c.speciesOrder.filter((id) => c.species[id].kind === 'hybrid');
  if (need.kind === 'zone') {
    const zone = c.zones.find((z) => z.id === need.zone);
    const cards = [...(zone?.deck.map((e) => e.card) ?? []), ...(zone?.deep ?? [])];
    const found = new Set(cards.flatMap((card) => (card.type === 'specimen' ? [card.species] : [])));
    return c.speciesOrder.filter((id) => found.has(id) && c.species[id].kind === 'wild');
  }
  if (need.kind === 'below') {
    const cards = Object.values(c.underground).flatMap((layers) => layers.flatMap((l) => l.deck.map((e) => e.card)));
    const found = new Set(cards.flatMap((card) => (card.type === 'specimen' ? [card.species] : [])));
    return c.speciesOrder.filter((id) => found.has(id));
  }
  return null;
}

/** Whether an order may be dealt this year: its zone's gear is in the shop, and a below-ground order needs a layer open. */
export function orderDealable(order: OrderDef, perks: Perks, c: Content = defaultContent): boolean {
  if (order.requires && !perks.shop.includes(order.requires) && !perks.species.includes(order.requires)) return false;
  if (order.need.kind === 'below') return c.zones.some((z) => layersOpen(perks.generation, z.id, c) > 0);
  return true;
}

/** How many mushrooms an order takes in all. */
export function orderSize(order: OrderDef): number {
  const need = order.need;
  return need.kind === 'species' ? Object.values(need.items).reduce((a, b) => a + b, 0) : need.count;
}

const tally = (pay: Record<string, number>) => Object.values(pay).reduce((a, b) => a + b, 0);

/**
 * What a stock of mushrooms would give toward an order, picking the cheapest that fit, on top of what
 * `taken` already covers. It may fall short.
 */
function orderTake(stock: Record<string, number>, order: OrderDef, taken: Record<string, number>, c: Content): Record<string, number> {
  const need = order.need;
  const have = (id: string) => stock[id] ?? 0;
  const byValue = (ids: string[]) => ids.slice().sort((a, b) => c.species[a].value - c.species[b].value);
  const pay: Record<string, number> = {};
  if (need.kind === 'species') {
    for (const [id, n] of Object.entries(need.items)) {
      const take = Math.min(have(id), n - (taken[id] ?? 0));
      if (take > 0) pay[id] = take;
    }
    return pay;
  }
  let left = need.count - tally(taken);
  const pool = orderSpecies(order, c);
  if (pool) {
    for (const id of byValue(Object.keys(stock).filter((id) => pool.includes(id)))) {
      const take = Math.min(have(id), left);
      if (take > 0) pay[id] = take;
      left -= Math.max(take, 0);
    }
    return pay;
  }
  // Different species, one of each: any already counted can't count again.
  for (const id of byValue(Object.keys(stock).filter((id) => have(id) > 0 && !taken[id])).slice(0, Math.max(left, 0))) pay[id] = 1;
  return pay;
}

/** Which stored mushrooms an order would take, picking the cheapest that fit; null if it can't be filled. */
export function orderPayment(
  storage: Record<string, number>,
  order: OrderDef,
  c: Content = defaultContent,
): Record<string, number> | null {
  const pay = orderTake(storage, order, {}, c);
  return tally(pay) === orderSize(order) ? pay : null;
}

/** How far along an order is: what storage would give it, then what's identified in the basket, then the beds growing toward it. */
export interface OrderProgress {
  need: number;
  stored: number;
  basket: number;
  growing: number;
}

/** An order's progress, taken in the same way a delivery takes from storage, so the farm and the market agree. */
export function orderProgress(s: GameState, order: OrderDef, c: Content = defaultContent): OrderProgress {
  const taken: Record<string, number> = {};
  const count = (ids: string[]) => {
    const stock: Record<string, number> = {};
    for (const id of ids) stock[id] = (stock[id] ?? 0) + 1;
    return stock;
  };
  const add = (stock: Record<string, number>) => {
    const pay = orderTake(stock, order, taken, c);
    for (const [id, n] of Object.entries(pay)) taken[id] = (taken[id] ?? 0) + n;
    return tally(pay);
  };
  const stored = add(s.storage);
  // Only what's been identified: an unknown specimen might be a lookalike.
  const basket = add(count(s.basket.filter((b) => b.identified).map((b) => b.species)));
  const growing = add(count(s.grid.flatMap((sq) => (sq.species && !sq.blight ? [sq.species] : []))));
  return { need: orderSize(order), stored, basket, growing };
}

/** What an artifact brought up this year scores: full the first time, half (rounded up) once it's already in the cabinet. */
export function artifactPoints(s: GameState, id: string, c: Content = defaultContent): number {
  const points = artifactDef(id, c)?.points ?? 0;
  return s.perks.clues.includes(id) ? Math.ceil(points / 2) : points;
}

export function score(s: GameState, c: Content = defaultContent) {
  const hybrids = s.hybridsMade.length * c.rules.hybridPoints;
  const planted = s.planted.length * c.rules.plantedPoints;
  const coins = Math.min(Math.floor(s.coins / c.rules.coinsPerPoint), c.rules.maxCoinPoints);
  const feast = s.feastPoints;
  const artifacts = s.artifacts.reduce((sum, id) => sum + artifactPoints(s, id, c), 0);
  // The Festival Ribbons: the judges remember the family.
  const family = setBonus(s.perks.sets, 'points', c);
  const cache = s.cacheFound ? c.cache.points : 0;
  const total = s.orderPoints + hybrids + planted + coins + feast + artifacts + family + cache;
  const tier = [...tiersFor(s, c)].reverse().find((t) => total >= t.min) ?? null;
  return { orders: s.orderPoints, hybrids, planted, coins, feast, artifacts, family, cache, total, tier };
}

// ── Setup ────────────────────────────────────────────────────────────────

export interface NewGameOptions {
  seed?: string;
  mode?: GameState['mode'];
  perks?: Perks;
  /** The farm layout; daily years pick one from the date, story years default to the first. */
  board?: string;
}

/** The board a daily year is played on: the same for everyone on the same day. */
export function dailyBoard(seed: string, c: Content = defaultContent): string {
  return c.boards[hashSeed(`${seed}:board`) % c.boards.length].id;
}

/** The kit as printed: every gear in the shop, a 4×4 farm, no mastery. Daily years always use this. */
export function standardPerks(c: Content = defaultContent): Perks {
  return {
    shop: c.gear.map((g) => g.id),
    heirlooms: [],
    mastery: {},
    bonusCoins: 0,
    bonusActions: 0,
    size: c.rules.gridSize,
    autoHarvest: false,
    spawn: [],
    generation: 1,
    level: 1,
    challenges: [],
    sets: [],
    clues: [],
    cacheFound: false,
    commissions: false,
    hybrids: [],
    species: [],
  };
}

/** Brings a save from an older build up to the current shape. */
export function migrateState(s: GameState, c: Content = defaultContent): GameState {
  if (!s.size) s.size = c.rules.gridSize;
  if (!s.perks) s.perks = standardPerks(c);
  s.perks.bonusActions ??= 0;
  s.perks.autoHarvest ??= false;
  s.perks.spawn ??= [];
  s.perks.generation ??= 1;
  s.perks.level ??= 1;
  s.perks.challenges ??= [];
  s.perks.sets ??= [];
  // Saves from before the marks counted held the cabinet as a number: the year starts without them.
  if (!Array.isArray(s.perks.clues)) s.perks.clues = [];
  s.perks.cacheFound ??= false;
  // Saves from before level-gated hybrids: the gated ones stay locked this year.
  s.perks.hybrids ??= [];
  // Saves from before level-gated species: King Oyster stays locked this year.
  s.perks.species ??= [];
  // Saves from before boards were all on Streamside, with the stream down the left column.
  s.board ??= 'streamside';
  s.grid.forEach((sq, i) => (sq.damp ??= i % s.size === 0));
  s.orderSwaps ??= 0;
  s.perks.commissions ??= false;
  s.commission ??= { open: null, deck: commissionDeck(s.seed, s.perks, c), taken: 0 };
  s.hires ??= 0;
  s.hiredRound ??= 0;
  s.meal ??= null;
  s.feastPoints ??= 0;
  for (const z of c.zones) s.decks[z.id] ??= { draw: new Rng(hashSeed(`${s.seed}:${z.id}`)).shuffle(buildDeck(z, s.perks, c)), discard: [] };
  // A deck printed at another size (the 24-card decks before they grew to 32) is dealt afresh, unless a trip there is under way.
  for (const z of c.zones) {
    const deck = s.decks[z.id];
    const printed = buildDeck(z, s.perks, c);
    const out = s.forage?.status === 'open' && s.forage.zone === z.id;
    if (!out && deck.draw.length + deck.discard.length !== printed.length) {
      s.decks[z.id] = { draw: new Rng(hashSeed(`${s.seed}:${z.id}:${printed.length}`)).shuffle(printed), discard: [] };
    }
  }
  // Saves from before the underground have no layer decks.
  dealLayerDecks(s, c);
  s.artifacts ??= [];
  s.layersReached ??= [];
  s.cacheFound ??= false;
  s.stats.descents ??= 0;
  if (!s.stats.identified) s.stats.identified = {};
  s.compostPile ??= [];
  s.finale ??= null;
  s.recovery ??= null;
  s.away ??= false;
  s.stats.deepBusts ??= [0, 0, 0, 0];
  s.stats.monthsAway ??= 0;
  // Market visits saved before deliveries were counted only knew whether one had been made.
  if (s.market && s.market.deliveries === undefined) s.market = { deliveries: (s.market as { orderFilled?: boolean }).orderFilled ? 1 : 0 };
  s.stats.scraps ??= s.compostPile.length;
  s.stats.compostTiles ??= 0;
  s.stats.rareFinds ??= 0;
  s.stats.dishes ??= s.meal ? [s.meal] : [];
  s.zonesCleared ??= [];
  s.layersCleared ??= [];
  if (s.forage) {
    // A trip saved before clears were tracked can't say what it walked past, so one already deeper than the first patch can't clear.
    s.forage.missed ??= s.forage.depth > 1 ? 1 : 0;
    s.forage.cleared ??= false;
    s.forage.layer ??= 0;
    s.forage.relics ??= [];
  }
  // A trip saved by the older draw-one-card build ends where it stood; its finds are already in the basket.
  if (s.forage && !s.forage.patch) {
    s.forage.patch = [];
    s.forage.depth = 1;
    if (s.forage.status === 'open') s.forage.status = 'stopped';
  }
  return s;
}

/** A zone's printed deck, leaving out cards for species the homestead's level hasn't unlocked. */
function buildDeck(zone: ZoneDef, perks: Perks, c: Content): Card[] {
  const cards: Card[] = [];
  for (const entry of zone.deck) {
    if (entry.unlock && !speciesOpen(entry.unlock, perks, c)) continue;
    for (let i = 0; i < entry.copies; i++) cards.push({ ...entry.card });
  }
  return cards;
}

/** Deals a deck for every layer this generation has opened, each from its own seed so the rest of the year's dealing is untouched. */
function dealLayerDecks(s: GameState, c: Content) {
  for (const z of c.zones) {
    for (let d = 1; d <= layersOpen(s.perks.generation, z.id, c); d++) {
      const key = layerKey(z.id, d);
      s.decks[key] ??= { draw: new Rng(hashSeed(`${s.seed}:${key}`)).shuffle(buildLayerDeck(layerDef(z.id, d, c)!)), discard: [] };
    }
  }
}

function rollWeather(s: GameState, rng: Rng, c: Content) {
  const roll = rng.die(12);
  const w = c.weather.find((w) => roll >= w.from && roll <= w.to);
  s.weather = w ? w.id : 'clear';
  if (s.weather === 'windfall') s.shed.push('log');
}

export function newGame(opts: NewGameOptions = {}, c: Content = defaultContent): GameState {
  const seed = opts.seed ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const rng = new Rng(hashSeed(seed));
  const r = c.rules;
  const perks = opts.perks ?? standardPerks(c);
  const size = perks.size;
  const mode = opts.mode ?? 'story';
  const lean = isLean(perks, c);
  const board = opts.board ?? (mode === 'daily' ? dailyBoard(seed, c) : c.boards[0].id);
  const layout = farmLayout(board, size, c);
  const grid: Square[] = Array.from({ length: size * size }, (_, i) => ({
    tree: layout.trees.includes(i),
    substrate: null,
    species: null,
    stage: null,
    hold: 0,
    dry: 0,
    blight: false,
    tent: false,
    damp: layout.damp.includes(i),
  }));
  for (const sq of layout.start) {
    grid[sq.index].substrate = sq.substrate;
    if (sq.species) {
      grid[sq.index].species = sq.species;
      grid[sq.index].stage = sq.stage ?? 'S';
    }
  }
  const decks: GameState['decks'] = {};
  for (const z of c.zones) decks[z.id] = { draw: rng.shuffle(buildDeck(z, perks, c)), discard: [] };
  const orderDeck = rng.shuffle(c.orders.filter((o) => orderDealable(o, perks, c)).map((o) => o.id));

  const s: GameState = {
    version: 1,
    mode,
    seed,
    size,
    board,
    perks,
    rng: 0,
    round: 1,
    actionsLeft: r.actionsPerRound + perks.bonusActions + challengeEffect(perks, 'actions', c),
    weather: 'clear',
    coins: lean ? 0 : r.startCoins + perks.bonusCoins,
    grid,
    basket: [],
    shed: [],
    compostPile: [],
    storage: {},
    gear: lean ? [] : perks.heirlooms.slice(),
    tentPlaced: false,
    decks,
    orders: { visible: orderDeck.slice(0, r.ordersVisible), deck: orderDeck.slice(r.ordersVisible), filled: [] },
    orderPoints: 0,
    orderSwaps: 0,
    commission: { open: null, deck: commissionDeck(seed, perks, c), taken: 0 },
    hires: 0,
    hiredRound: 0,
    meal: null,
    feastPoints: 0,
    planted: [],
    hybridsMade: [],
    discovered: [],
    lookalikesFound: [],
    zonesCleared: [],
    artifacts: [],
    layersReached: [],
    layersCleared: [],
    cacheFound: false,
    watered: false,
    market: null,
    forage: null,
    pendingCrosses: [],
    declinedCrosses: [],
    night: null,
    moldPenalty: 0,
    recovery: null,
    away: false,
    finale: null,
    nextUid: 1,
    tripCount: 0,
    stats: {
      identified: {},
      tendActions: [0],
      idleActions: [],
      busts: 0,
      trips: 0,
      lookalikes: 0,
      coinsEarned: 0,
      scraps: 0,
      compostTiles: 0,
      rareFinds: 0,
      dishes: [],
      descents: 0,
      deepBusts: [0, 0, 0, 0],
      monthsAway: 0,
    },
    over: false,
  };
  dealLayerDecks(s, c);
  rollWeather(s, rng, c);
  s.rng = rng.state;
  return s;
}

// ── Actions ──────────────────────────────────────────────────────────────

function spendAction(s: GameState) {
  if (s.actionsLeft <= 0) fail('No actions left this month. End the month to rest.');
  s.actionsLeft -= 1;
}

function addStorage(s: GameState, id: string, n = 1) {
  s.storage[id] = (s.storage[id] ?? 0) + n;
}

function takeStorage(s: GameState, id: string, n: number) {
  s.storage[id] = (s.storage[id] ?? 0) - n;
  if (s.storage[id] <= 0) delete s.storage[id];
}

function noteTend(s: GameState) {
  const i = s.round - 1;
  s.stats.tendActions[i] = (s.stats.tendActions[i] ?? 0) + 1;
}

function openMarketVisit(s: GameState) {
  if (s.market) return;
  if (s.finale) {
    if (s.finale.marketed) fail("You've had your last market visit. Time for the festival.");
    s.finale.marketed = true;
  } else {
    spendAction(s);
  }
  s.market = { deliveries: 0 };
}

/** On festival morning only the last harvest and market visit are open. */
function guardFinale(s: GameState) {
  if (s.finale) fail('It is festival morning: there is time for one last harvest and a market visit, nothing more.');
}

/** A month out recovering from a fall in a third layer: nothing at the homestead, even the moves that cost no action. */
function guardAway(s: GameState) {
  if (s.away) fail("You're out recovering this month.");
}

/** The deck the trip is dealing from: the zone's own on the surface, or the layer's below it. */
function tripDeck(trip: ForageTrip): string {
  return trip.layer ? layerKey(trip.zone, trip.layer) : trip.zone;
}

/** The decks each dispatched state has copied; the rest are still shared with the state it was made from. */
const ownDecks = new WeakMap<GameState, Set<string>>();

/** A zone or layer deck about to change. In a dispatch, the first change copies it so the previous state keeps its own. */
function deckOf(s: GameState, key: string) {
  const own = ownDecks.get(s);
  if (own && !own.has(key) && s.decks[key]) {
    const d = s.decks[key];
    s.decks[key] = { draw: [...d.draw], discard: [...d.discard] };
    own.add(key);
  }
  return s.decks[key];
}

/** Takes the top card of a zone or layer deck. A trip is one pass through it, so null once it runs out. */
function takeCard(s: GameState, deck: string): Card | null {
  return deckOf(s, deck).draw.shift() ?? null;
}

/** Wild mushrooms out of season aren't dealt at all: they wait in the discard until the trip's restock shuffles them back. */
function setAsideOutOfSeason(s: GameState, deck: string, c: Content) {
  const season = seasonOf(s.round, c);
  const d = deckOf(s, deck);
  const out = (card: Card) => card.type === 'specimen' && c.species[card.species].kind === 'wild' && !inSeason(card.species, season, c);
  d.discard.push(...d.draw.filter(out));
  d.draw = d.draw.filter((card) => !out(card));
}

/** Whether a patch card came from the deck: deep finds, artifacts and the way down never did, so they never go back. */
function fromDeck(p: PatchCard): boolean {
  return !p.deep && p.card.type !== 'entrance';
}

/** Going deeper or down leaves the unturned cards behind for the rest of the trip. */
function leaveHidden(s: GameState, trip: ForageTrip) {
  for (const p of trip.patch) {
    if (p.flipped || !fromDeck(p)) continue;
    deckOf(s, tripDeck(trip)).discard.push(p.card);
    if (p.card.type !== 'hazard') trip.missed += 1;
  }
}

/** Whether every card in the zone's deck but its hazards has been turned on this trip. Rare finds and the layers below don't count. */
export function zoneCleared(s: GameState, trip: ForageTrip): boolean {
  return (
    trip.layer === 0 &&
    trip.missed === 0 &&
    s.decks[trip.zone].draw.every((card) => card.type === 'hazard') &&
    trip.patch.every((p) => p.flipped || !fromDeck(p) || p.card.type === 'hazard')
  );
}

/** When a trip ends, every card goes back and each deck it walked is shuffled, so the next trip walks the whole zone again. */
function restockDeck(s: GameState, trip: ForageTrip, rng: Rng) {
  for (let layer = 0; layer <= trip.layer; layer++) {
    const deck = deckOf(s, layer ? layerKey(trip.zone, layer) : trip.zone);
    const unturned = layer === trip.layer ? trip.patch.filter((p) => !p.flipped && fromDeck(p)).map((p) => p.card) : [];
    deck.draw = rng.shuffle([...deck.draw, ...deck.discard, ...unturned]);
    deck.discard = [];
  }
}

/** Artifacts carried home: into the year's finds, so they score and aren't dealt again this year. A bust's lost ones stay below. */
function bankRelics(s: GameState, trip: ForageTrip) {
  for (const r of trip.relics) if (!trip.lost.includes(r.uid) && !s.artifacts.includes(r.artifact)) s.artifacts.push(r.artifact);
}

/** A rare find for a patch this deep: usually a wild species in season now, sometimes a forager's cache of coins. */
function deepFind(s: GameState, zone: ZoneDef, rng: Rng, c: Content): Card | null {
  const season = seasonOf(s.round, c);
  const finds = zone.deep.filter((card) => card.type === 'specimen' && inSeason(card.species, season, c));
  const caches = zone.deep.filter((card) => card.type !== 'specimen');
  const pool = finds.length && (!caches.length || rng.next() >= c.rules.deepCoinChance) ? finds : caches;
  return pool.length ? { ...rng.pick(pool) } : null;
}

/** A layer's artifact, until it's been brought home this year. */
function layerRelic(s: GameState, trip: ForageTrip, c: Content): Card | null {
  const id = layerDef(trip.zone, trip.layer, c)?.artifact;
  return id && !s.artifacts.includes(id) ? { type: 'artifact', artifact: id } : null;
}

/**
 * The way down to the next layer, when this generation has one open: in a layer's only patch, or in
 * the zone's last patch (its first deep one, with the Mapmaker's Case).
 */
function wayDown(s: GameState, trip: ForageTrip, last: boolean, c: Content): Card | null {
  if (trip.layer >= layersOpen(s.perks.generation, trip.zone, c)) return null;
  if (!trip.layer && !(hasSetEffect(s.perks.sets, 'shortcut', c) ? trip.depth === c.rules.deepAt : last)) return null;
  return { type: 'entrance', zone: trip.zone, depth: trip.layer + 1 };
}

function dealPatch(s: GameState, trip: ForageTrip, rng: Rng, c: Content) {
  const n = c.rules.patchSize * c.rules.patchSize;
  const zone = c.zones.find((z) => z.id === trip.zone)!;
  const deck = deckOf(s, tripDeck(trip));
  // Underground, the one card from outside the deck is the layer's artifact rather than a deep find.
  const deep = trip.layer ? layerRelic(s, trip, c) : trip.depth >= c.rules.deepAt ? deepFind(s, zone, rng, c) : null;
  const last = !trip.layer && deck.draw.length <= n - (deep ? 1 : 0);
  const way = wayDown(s, trip, last, c);
  const room = n - (deep ? 1 : 0) - (way ? 1 : 0);
  trip.patch = [];
  for (let i = 0; i < room; i++) {
    const card = takeCard(s, tripDeck(trip));
    if (!card) break;
    trip.patch.push({ card, flipped: false, outcome: null });
  }
  // The zone's last patch ends the trip's pass: a card the way down crowds out is walked past.
  if (way && last) deck.discard.push(...deck.draw.splice(0));
  if (deep) trip.patch.splice(Math.floor(rng.next() * (trip.patch.length + 1)), 0, { card: deep, flipped: false, outcome: null, deep: true });
  if (way) trip.patch.splice(Math.floor(rng.next() * (trip.patch.length + 1)), 0, { card: way, flipped: false, outcome: null });
}

/** Hazards orthogonally beside a patch card: the rustle you notice once you've turned it. */
export function hazardsNear(trip: ForageTrip, index: number, c: Content = defaultContent): number {
  return neighbors(index, c.rules.patchSize).filter((n) => trip.patch[n]?.card.type === 'hazard').length;
}

/**
 * A picked specimen in season: an Expert's wild find goes straight to storage, full basket or not;
 * otherwise into the basket, bumping a lesser find when it's full, or left behind if nothing ranks lower.
 */
function pickSpecimen(s: GameState, trip: ForageTrip, species: string, rare: boolean, c: Content): { outcome: DrawOutcome; dropped?: Specimen } {
  const sp = c.species[species];
  const full = s.basket.length >= basketCapacity(s, c);
  const bump = full ? bumpFor(s, sp.kind === 'wild', rare, c) : null;
  if (masteryOf(s, sp.id) >= 2 && sp.kind === 'wild') {
    addStorage(s, sp.id);
    s.stats.identified[sp.id] = (s.stats.identified[sp.id] ?? 0) + 1;
    return { outcome: 'known' };
  }
  if (full && !bump) return { outcome: 'basketFull' };
  if (bump) {
    // The lesser find is left on the forest floor to make room.
    s.basket = s.basket.filter((b) => b !== bump);
    trip.picked = trip.picked.filter((u) => u !== bump.uid);
  }
  const uid = s.nextUid++;
  const known = masteryOf(s, sp.id) >= 2;
  s.basket.push({ uid, species, identified: known, trip: trip.id, ...(rare ? { rare: true } : {}) });
  trip.picked.push(uid);
  if (known) s.stats.identified[sp.id] = (s.stats.identified[sp.id] ?? 0) + 1;
  if (bump) return { outcome: 'swapped', dropped: bump };
  return { outcome: known ? 'known' : 'basket' };
}

function specimenFor(s: GameState, uid: number) {
  const spec = s.basket.find((b) => b.uid === uid);
  if (!spec) fail('That specimen is not in your basket.');
  return spec;
}

function guardIdle(s: GameState) {
  if (s.over) fail('The year is over.');
  if (s.forage && s.forage.status === 'open') fail('Finish your forage trip first.');
  if (s.pendingCrosses.length) fail('Decide on the hybrids first.');
}

/**
 * Applies one action to a copy of the state. Throws GameError for illegal moves;
 * the input state is never mutated, so the UI can keep it for undo or diffing.
 */
export function dispatch(
  prev: GameState,
  action: Action,
  c: Content = defaultContent,
): { state: GameState; result: ActionResult } {
  // Everything but the decks is copied now. Most actions touch one deck at most, and the decks are most of the
  // state, so each is copied only when the action first changes it (deckOf).
  const s: GameState = structuredClone({ ...prev, decks: {} });
  s.decks = { ...prev.decks };
  ownDecks.set(s, new Set());
  const rng = new Rng(s.rng);
  let result: ActionResult = { kind: 'none' };

  switch (action.type) {
    case 'forage': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      if (s.forage) s.forage = null;
      const zone = c.zones.find((z) => z.id === action.zone) ?? fail('Unknown zone.');
      const status = zoneStatus(s, zone, c);
      if (!status.open) fail(status.reason);
      spendAction(s);
      s.market = null;
      // Saves from before trips were a single pass can still hold discards: shuffle them back in first.
      const deck = deckOf(s, zone.id);
      if (deck.discard.length) {
        deck.draw = rng.shuffle([...deck.draw, ...deck.discard]);
        deck.discard = [];
      }
      setAsideOutOfSeason(s, zone.id, c);
      s.tripCount += 1;
      s.stats.trips += 1;
      s.forage = {
        id: s.tripCount,
        zone: zone.id,
        patch: [],
        depth: 1,
        layer: 0,
        relics: [],
        drawn: [],
        hazards: 0,
        knifeUsed: false,
        picked: [],
        status: 'open',
        lost: [],
        missed: 0,
        cleared: false,
      };
      dealPatch(s, s.forage, rng, c);
      break;
    }

    case 'deeper': {
      const trip = s.forage;
      if (!trip || trip.status !== 'open') fail('You are not out foraging.');
      if (trip.layer) fail('Each layer is a single patch. Descend further, or head home.');
      if (!s.decks[trip.zone].draw.length) fail("You've walked the whole zone. Time to head home.");
      leaveHidden(s, trip);
      trip.depth += 1;
      dealPatch(s, trip, rng, c);
      break;
    }

    case 'descend': {
      const status = descendStatus(s, c);
      if (!status.open) fail(status.reason);
      const trip = s.forage!;
      leaveHidden(s, trip);
      trip.layer += 1;
      const key = layerKey(trip.zone, trip.layer);
      if (!s.layersReached.includes(key)) s.layersReached.push(key);
      s.stats.descents += 1;
      setAsideOutOfSeason(s, key, c);
      dealPatch(s, trip, rng, c);
      break;
    }

    case 'flip': {
      const trip = s.forage;
      if (!trip || trip.status !== 'open') fail('You are not out foraging.');
      const spot = trip.patch[action.index] ?? fail('There is no card there.');
      if (spot.flipped) fail('You already turned that one.');
      const card = spot.card;
      spot.flipped = true;
      if (fromDeck(spot)) deckOf(s, tripDeck(trip)).discard.push(card);
      let outcome: ActionResult & { kind: 'draw' } = { kind: 'draw', index: action.index, card, outcome: 'basket' };
      if (card.type === 'specimen') {
        const sp = c.species[card.species];
        if (sp.kind === 'wild' && !inSeason(sp.id, seasonOf(s.round, c), c)) {
          outcome.outcome = 'emptyPatch';
        } else {
          const picked = pickSpecimen(s, trip, sp.id, !!spot.deep, c);
          outcome.outcome = picked.outcome;
          if (picked.dropped) outcome.dropped = picked.dropped;
        }
        if (spot.deep && outcome.outcome !== 'emptyPatch' && outcome.outcome !== 'basketFull') s.stats.rareFinds += 1;
      } else if (card.type === 'coins') {
        s.coins += card.amount;
        s.stats.coinsEarned += card.amount;
        outcome.outcome = 'coins';
      } else if (card.type === 'substrate') {
        s.shed.push(card.substrate);
        outcome.outcome = 'substrate';
      } else if (card.type === 'ground') {
        outcome.outcome = 'nothing';
      } else if (card.type === 'entrance') {
        outcome.outcome = 'wayDown';
      } else if (card.type === 'artifact') {
        // Pocketed, not basketed: it counts as a find, so only a bust can cost it.
        const uid = s.nextUid++;
        trip.relics.push({ uid, artifact: card.artifact });
        trip.picked.push(uid);
        outcome.outcome = 'artifact';
      } else {
        if (s.gear.includes('knife') && !trip.knifeUsed) {
          trip.knifeUsed = true;
          outcome.outcome = 'hazardIgnored';
        } else {
          trip.hazards += 1;
          outcome.outcome = 'hazard';
          if (trip.hazards >= bustAt(s, c)) {
            outcome.outcome = 'bust';
            trip.status = 'busted';
            s.stats.busts += 1;
            if (trip.layer) {
              // Hurt below ground: the time comes off next month. Two falls in one month don't add up; the worst counts.
              s.stats.deepBusts[trip.layer] = (s.stats.deepBusts[trip.layer] ?? 0) + 1;
              if (!s.recovery || trip.layer > s.recovery.layer) s.recovery = { zone: trip.zone, layer: trip.layer };
            }
            trip.lost = trip.picked.slice(bustKeep(s, c));
            s.basket = s.basket.filter((b) => !trip.lost.includes(b.uid));
            bankRelics(s, trip);
            restockDeck(s, trip, rng);
          }
        }
      }
      if (trip.status === 'open' && !trip.cleared && zoneCleared(s, trip)) {
        trip.cleared = true;
        outcome.cleared = true;
        if (!s.zonesCleared.includes(trip.zone)) s.zonesCleared.push(trip.zone);
      }
      // A layer is one patch: the last card on it that isn't a hazard clears it, heirloom and way down included.
      if (trip.status === 'open' && trip.layer && card.type !== 'hazard' && trip.patch.every((p) => p.flipped || p.card.type === 'hazard')) {
        outcome.cleared = true;
        const key = layerKey(trip.zone, trip.layer);
        if (!s.layersCleared.includes(key)) s.layersCleared.push(key);
      }
      spot.outcome = outcome.outcome;
      trip.drawn.push({ card, outcome: outcome.outcome, ...(outcome.dropped ? { dropped: outcome.dropped } : {}) });
      result = outcome;
      break;
    }

    case 'stopForage': {
      if (!s.forage || s.forage.status !== 'open') fail('You are not out foraging.');
      bankRelics(s, s.forage);
      restockDeck(s, s.forage, rng);
      s.forage.status = 'stopped';
      break;
    }

    case 'dig': {
      const status = digStatus(s, action.index);
      if (!status.open) fail(status.reason);
      const trip = s.forage!;
      const spot = trip.patch[action.index];
      const { cache, rules } = c;
      const name = spot.card.type === 'ground' ? spot.card.name : '';
      const season = seasonOf(s.round, c);
      const dig: ActionResult & { kind: 'dig' } = { kind: 'dig', dug: 'empty' };
      if (cellarReady(s, c) && trip.zone === cache.zone && name === cache.card && season === cache.season) {
        dig.dug = 'found';
        s.cacheFound = true;
      } else if (rules.dig.hosts.includes(name) && inSeason(rules.dig.species, season, c) && rng.next() < rules.dig.chance) {
        const picked = pickSpecimen(s, trip, rules.dig.species, false, c);
        dig.dug = picked.outcome === 'basketFull' ? 'noRoom' : 'truffle';
        dig.outcome = picked.outcome;
        if (picked.dropped) dig.dropped = picked.dropped;
      }
      // Whatever it turns up, the day is spent: the trip ends as if you headed home, finds and all.
      bankRelics(s, trip);
      restockDeck(s, trip, rng);
      trip.status = 'stopped';
      trip.dug = dig.dug;
      result = dig;
      break;
    }

    case 'closeTrip': {
      if (s.forage && s.forage.status === 'open') fail('Head home first.');
      s.forage = null;
      break;
    }

    case 'identify': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      const unknown = s.basket.filter((b) => !b.identified);
      if (!unknown.length) fail('Nothing in your basket needs identifying.');
      spendAction(s);
      s.market = null;
      const results: IdentifyResult[] = [];
      for (const spec of unknown) {
        const sp = c.species[spec.species];
        const rolls = s.gear.includes('fieldguide') ? [rng.die(6), rng.die(6)] : [rng.die(6)];
        const kept = Math.max(...rolls);
        const real = kept > lookalikeOn(s, sp.id, c);
        if (real) {
          spec.identified = true;
          s.stats.identified[sp.id] = (s.stats.identified[sp.id] ?? 0) + 1;
          if (!s.discovered.includes(sp.id)) s.discovered.push(sp.id);
          if (sp.kind === 'wild') {
            s.basket = s.basket.filter((b) => b.uid !== spec.uid);
            addStorage(s, sp.id);
          }
        } else {
          s.basket = s.basket.filter((b) => b.uid !== spec.uid);
          s.shed.push('compost');
          s.stats.lookalikes += 1;
          if (!s.lookalikesFound.includes(sp.id)) s.lookalikesFound.push(sp.id);
        }
        results.push({ uid: spec.uid, species: sp.id, real, rolls, kept });
      }
      result = { kind: 'identify', results };
      break;
    }

    case 'plant': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      const spec = specimenFor(s, action.uid);
      if (!spec.identified) fail('Identify it before you plant it.');
      if (c.species[spec.species].kind === 'wild') fail("That one can't be planted.");
      if (!canPlantOn(s, spec.species, action.square, c)) fail('It needs an empty square of the right substrate.');
      spendAction(s);
      s.market = null;
      const sq = s.grid[action.square];
      sq.species = spec.species;
      sq.stage = 'S';
      sq.hold = 0;
      sq.dry = 0;
      sq.blight = false;
      s.basket = s.basket.filter((b) => b.uid !== spec.uid);
      if (!s.planted.includes(spec.species)) s.planted.push(spec.species);
      break;
    }

    case 'discard': {
      guardAway(s);
      if (s.forage && s.forage.status === 'open') fail('Finish your forage trip first.');
      const spec = specimenFor(s, action.uid);
      s.basket = s.basket.filter((b) => b.uid !== spec.uid);
      s.compostPile.push(spec.species);
      s.stats.scraps += 1;
      break;
    }

    case 'compostBasket': {
      guardAway(s);
      if (s.forage && s.forage.status === 'open') fail('Finish your forage trip first.');
      if (!s.basket.length) fail('Your basket is empty.');
      for (const spec of s.basket) s.compostPile.push(spec.species);
      s.stats.scraps += s.basket.length;
      s.basket = [];
      break;
    }

    case 'placeSubstrate': {
      guardAway(s);
      if (s.forage && s.forage.status === 'open') fail('Finish your forage trip first.');
      const sub: Substrate | undefined = s.shed[action.index];
      if (!sub) fail('Nothing in the shed there.');
      const sq = s.grid[action.square];
      if (!sq || sq.tree || sq.substrate !== null) fail('Pick an empty patch of ground.');
      sq.substrate = sub;
      s.shed.splice(action.index, 1);
      break;
    }

    case 'water': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      if (s.watered) fail('Already watered this month.');
      spendAction(s);
      s.market = null;
      s.watered = true;
      noteTend(s);
      break;
    }

    case 'clearBlight': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      const sq = s.grid[action.square];
      if (!sq?.blight) fail('That bed has no blight.');
      spendAction(s);
      s.market = null;
      // Blight Spray treats every blighted bed in one pass.
      for (const bed of s.gear.includes('blightspray') ? s.grid.filter((x) => x.blight) : [sq]) {
        bed.blight = false;
        bed.dry = 0;
      }
      noteTend(s);
      break;
    }

    case 'compostSquare': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      const sq = s.grid[action.square];
      if (!sq || sq.tree || sq.substrate === null) fail('There is nothing to compost there.');
      spendAction(s);
      s.market = null;
      // The bed and its tile both go on the pile, leaving empty ground for a fresh tile from the shed.
      if (sq.species) s.compostPile.push(sq.species);
      s.compostPile.push(sq.substrate);
      s.stats.scraps += sq.species ? 2 : 1;
      Object.assign(sq, { substrate: null, species: null, stage: null, hold: 0, dry: 0, blight: false });
      noteTend(s);
      break;
    }

    case 'harvest': {
      guardAway(s);
      guardIdle(s);
      if (s.finale?.harvested) fail("You've brought in the last harvest. Time for the festival.");
      const ready = s.grid.filter((sq) => sq.stage === 'F' && !sq.blight && sq.species);
      if (!ready.length) fail('Nothing is fruiting yet.');
      if (s.finale) s.finale.harvested = true;
      else spendAction(s);
      s.market = null;
      const gained: Record<string, number> = {};
      const squares = ready.map((sq) => s.grid.indexOf(sq));
      for (const sq of ready) {
        const n = harvestYield(sq.species!, c);
        addStorage(s, sq.species!, n);
        gained[sq.species!] = (gained[sq.species!] ?? 0) + n;
        sq.stage = 'C';
        sq.hold = 0;
      }
      result = { kind: 'harvest', gained, squares };
      break;
    }

    case 'sell': {
      guardAway(s);
      guardIdle(s);
      const have = s.storage[action.species] ?? 0;
      const n = Math.min(action.count, have);
      if (n <= 0) fail('Nothing of that kind to sell.');
      openMarketVisit(s);
      const each = saleValue(s, action.species, c);
      takeStorage(s, action.species, n);
      s.coins += each * n;
      s.stats.coinsEarned += each * n;
      result = { kind: 'sell', coins: each * n };
      break;
    }

    case 'sellCompost': {
      guardAway(s);
      guardIdle(s);
      const have = s.shed.filter((x) => x === 'compost').length;
      const n = Math.min(action.count, have);
      if (n <= 0) fail('No Compost tiles in your shed to sell.');
      openMarketVisit(s);
      const each = compostSaleValue(s, c);
      for (let i = 0; i < n; i++) s.shed.splice(s.shed.lastIndexOf('compost'), 1);
      s.coins += each * n;
      s.stats.coinsEarned += each * n;
      result = { kind: 'sell', coins: each * n };
      break;
    }

    case 'fillOrder': {
      guardAway(s);
      guardIdle(s);
      const commission = s.commission.open === action.order;
      if (!s.orders.visible.includes(action.order) && !commission) fail('That order is not on the board.');
      const order = orderById(action.order, c)!;
      const pay = orderPayment(s.storage, order, c);
      if (!pay) fail("You don't have what this order needs.");
      const extra = deliveryCost(s, c);
      if (s.coins < extra) fail(`Another delivery this visit costs ${extra} coins.`);
      openMarketVisit(s);
      s.coins -= extra;
      for (const [id, n] of Object.entries(pay)) takeStorage(s, id, n);
      s.market!.deliveries += 1;
      s.orderPoints += order.points;
      s.orders.filled.push(order.id);
      if (commission) {
        s.commission.open = null;
      } else {
        s.orders.visible = s.orders.visible.filter((o) => o !== order.id);
        const next = s.orders.deck.shift();
        if (next) s.orders.visible.push(next);
      }
      result = { kind: 'order', points: order.points };
      break;
    }

    case 'swapOrder': {
      guardAway(s);
      guardIdle(s);
      if (!s.orders.visible.includes(action.order)) fail('That order is not on the board.');
      if (!s.orders.deck.length) fail('No other orders are waiting.');
      const cost = swapCost(s, c);
      if (s.coins < cost) fail(`Swapping an order costs ${cost} coins.`);
      openMarketVisit(s);
      s.coins -= cost;
      s.orderSwaps += 1;
      const at = s.orders.visible.indexOf(action.order);
      // Deal the first waiting order that storage can fill right now, if any; otherwise the top of the pile.
      const ready = s.orders.deck.findIndex((id) => orderPayment(s.storage, c.orders.find((o) => o.id === id)!, c));
      s.orders.visible[at] = s.orders.deck.splice(Math.max(ready, 0), 1)[0];
      s.orders.deck.push(action.order);
      break;
    }

    case 'takeCommission': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      if (!s.perks.commissions) fail("The village doesn't bring you commissions yet.");
      if (s.commission.open) fail('Deliver the commission you have first.');
      const next = nextCommission(s, c);
      if (!next) fail(s.commission.deck.length ? 'Nothing the village wants can still be found this year.' : 'No more commissions this year.');
      const cost = commissionCost(s, c);
      if (s.coins < cost) fail(`A commission costs ${cost} coins this time.`);
      openMarketVisit(s);
      s.coins -= cost;
      s.commission.taken += 1;
      // Any passed over need what can't be found again this year: they stay in the pile, never dealt.
      s.commission.deck.splice(s.commission.deck.indexOf(next), 1);
      s.commission.open = next;
      break;
    }

    case 'hireHand': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      if (s.hiredRound === s.round) fail("You've already hired a hand this month.");
      const cost = hireCost(s, c);
      if (s.coins < cost) fail(`A hand costs ${cost} coins this time.`);
      s.coins -= cost;
      s.hires += 1;
      s.hiredRound = s.round;
      s.actionsLeft += 1;
      break;
    }

    case 'buySubstrate': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      const cost = c.rules.substrateCost[action.substrate] ?? fail("The stall doesn't sell that.");
      if (s.coins < cost) fail(`A tile costs ${cost} coins.`);
      openMarketVisit(s);
      s.coins -= cost;
      s.shed.push(action.substrate);
      break;
    }

    case 'buySpawn': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      const sp = c.species[action.species] ?? fail('Unknown species.');
      if (!spawnStock(s, c).includes(sp.id)) fail("The market doesn't sell that spawn. Identify one first.");
      const cost = spawnCost(sp.id, c);
      if (s.coins < cost) fail(`${sp.name} spawn costs ${cost} coins.`);
      if (s.basket.length >= basketCapacity(s, c)) fail('Your basket is full.');
      openMarketVisit(s);
      s.coins -= cost;
      s.basket.push({ uid: s.nextUid++, species: sp.id, identified: true, trip: 0 });
      break;
    }

    case 'saveSpawn': {
      guardAway(s);
      if (s.forage && s.forage.status === 'open') fail('Finish your forage trip first.');
      guardFinale(s);
      const sp = c.species[action.species] ?? fail('Unknown species.');
      if (sp.kind === 'wild') fail("Wild mushrooms can't be grown from spawn.");
      if (!(s.storage[sp.id] > 0)) fail(`No ${sp.name} in storage.`);
      if (s.basket.length >= basketCapacity(s, c)) fail('Your basket is full.');
      takeStorage(s, sp.id, 1);
      s.basket.push({ uid: s.nextUid++, species: sp.id, identified: true, trip: 0 });
      break;
    }

    case 'cook': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      const recipe = c.recipes.find((r) => r.id === action.recipe) ?? fail('Unknown dish.');
      if (s.meal) fail("You've already cooked this month.");
      if (!canCook(s, recipe)) fail(`${recipe.name} needs ${Object.entries(recipe.needs).map(([id, n]) => `${n} ${c.species[id].name}`).join(' and ')}.`);
      for (const [id, n] of Object.entries(recipe.needs)) takeStorage(s, id, n);
      s.meal = recipe.id;
      if (!s.stats.dishes.includes(recipe.id)) s.stats.dishes.push(recipe.id);
      if (recipe.effect.type === 'actions') s.actionsLeft += recipe.effect.amount;
      if (recipe.effect.type === 'points') s.feastPoints = Math.min(s.feastPoints + recipe.effect.amount, c.rules.maxFeastPoints);
      break;
    }

    case 'buyGear': {
      guardAway(s);
      guardIdle(s);
      const gear = c.gear.find((g) => g.id === action.gear) ?? fail('Unknown gear.');
      if (s.finale) fail("The shop isn't selling gear on festival day.");
      if (s.gear.includes(gear.id)) fail('You already own that.');
      if (!s.perks.shop.includes(gear.id)) fail("The market doesn't stock that yet.");
      if (s.coins < gear.cost) fail(`${gear.name} costs ${gear.cost} coins.`);
      openMarketVisit(s);
      s.coins -= gear.cost;
      s.gear.push(gear.id);
      break;
    }

    case 'leaveMarket': {
      s.market = null;
      break;
    }

    case 'placeTent': {
      guardAway(s);
      if (!s.gear.includes('growtent')) fail('You need the Grow Tent.');
      if (s.tentPlaced) fail('The tent is already pitched.');
      const sq = s.grid[action.square];
      if (!sq || sq.tree) fail('Pick a square for the tent.');
      sq.tent = true;
      s.tentPlaced = true;
      break;
    }

    case 'moveTent': {
      guardAway(s);
      guardIdle(s);
      guardFinale(s);
      if (!s.tentPlaced) fail('Pitch the tent first.');
      const sq = s.grid[action.square];
      if (!sq || sq.tree) fail('Pick a square for the tent.');
      if (sq.tent) fail('The tent is already there.');
      spendAction(s);
      s.market = null;
      for (const other of s.grid) other.tent = false;
      sq.tent = true;
      noteTend(s);
      break;
    }

    case 'resolveCross': {
      const cross = s.pendingCrosses[action.index] ?? fail('No such cross.');
      s.pendingCrosses.splice(action.index, 1);
      const a = s.grid[cross.a];
      const b = s.grid[cross.b];
      if (action.replace === null) {
        s.declinedCrosses.push(crossKey(cross.a, cross.b, a.species ?? '', b.species ?? ''));
        break;
      }
      const target = action.replace === 'a' ? a : b;
      const other = action.replace === 'a' ? b : a;
      const valid =
        a.species && b.species && hybridFor(a.species, b.species, c, s.perks.hybrids) === cross.hybrid && !a.blight && !b.blight && other.species;
      if (!valid) break; // an earlier cross used one of these beds
      target.species = cross.hybrid;
      target.stage = 'C';
      target.hold = 0;
      target.dry = 0;
      if (!s.hybridsMade.includes(cross.hybrid)) s.hybridsMade.push(cross.hybrid);
      if (!s.discovered.includes(cross.hybrid)) s.discovered.push(cross.hybrid);
      // Drop any other offer that relied on the bed that just changed.
      const changed = action.replace === 'a' ? cross.a : cross.b;
      s.pendingCrosses = s.pendingCrosses.filter((x) => x.a !== changed && x.b !== changed);
      break;
    }

    case 'endMonth': {
      guardIdle(s);
      guardFinale(s);
      s.forage = null;
      s.market = null;
      s.stats.idleActions[s.round - 1] = s.actionsLeft;
      const fell = s.recovery;
      s.recovery = null;
      s.away = false;
      const report = runGrowth(s, rng, c);
      s.meal = null;
      const final = s.round >= c.rules.rounds;
      const seasonTurns = !final && s.round % c.rules.roundsPerSeason === 0;
      if (seasonTurns && !s.gear.includes('dehydrator') && Object.keys(s.storage).length) {
        report.events.push({ type: 'spoil', lost: { ...s.storage } });
        for (const [id, n] of Object.entries(s.storage)) for (let i = 0; i < n; i++) s.compostPile.push(id);
        s.stats.scraps += Object.values(s.storage).reduce((a, b) => a + b, 0);
        s.storage = {};
      }
      // Discards, overripe fruit and spoiled stock all rot down together.
      const tiles = Math.floor(s.compostPile.length / c.rules.scrapsPerCompost);
      if (tiles > 0) {
        s.compostPile.splice(0, tiles * c.rules.scrapsPerCompost);
        for (let i = 0; i < tiles; i++) s.shed.push('compost');
        s.stats.compostTiles += tiles;
        report.events.push({ type: 'compost', tiles });
      }
      // Picked at first light, after any spoilage, so the fresh harvest makes it into the new season.
      if (s.perks.autoHarvest) {
        const gained: Record<string, number> = {};
        const squares: number[] = [];
        for (const [i, sq] of s.grid.entries()) {
          if (sq.stage !== 'F' || sq.blight || !sq.species) continue;
          squares.push(i);
          const n = harvestYield(sq.species, c);
          addStorage(s, sq.species, n);
          gained[sq.species] = (gained[sq.species] ?? 0) + n;
          sq.stage = 'C';
          sq.hold = 0;
        }
        if (Object.keys(gained).length) report.events.push({ type: 'autoHarvest', gained, squares });
      }
      if (final) {
        // No month 13: the morning after is the festival, with time for one last harvest and market visit.
        s.finale = { harvested: false, marketed: false };
        s.actionsLeft = 0;
        s.watered = false;
        s.weather = 'clear';
        // A fall in month 12 has no month to take: festival morning comes anyway. Only a month away costs the last harvest.
        if (fell && recoveryCost(fell.layer, s.perks.sets, c) === 'month') {
          s.finale.harvested = true;
          report.events.push({ type: 'recovering', zone: fell.zone, layer: fell.layer, actions: 'month' });
        }
      } else {
        if (seasonTurns) report.events.push({ type: 'season', season: seasonOf(s.round + 1, c) });
        s.round += 1;
        s.actionsLeft = Math.max(0, actionsPerMonth(s, c) - s.moldPenalty);
        const cost = fell ? recoveryCost(fell.layer, s.perks.sets, c) : 0;
        if (cost === 'month') {
          s.away = true;
          s.actionsLeft = 0;
          s.stats.monthsAway += 1;
        } else {
          s.actionsLeft = Math.max(0, s.actionsLeft - cost);
        }
        if (fell && cost) report.events.push({ type: 'recovering', zone: fell.zone, layer: fell.layer, actions: cost });
        s.watered = false;
        s.stats.tendActions[s.round - 1] = 0;
        rollWeather(s, rng, c);
        if (s.weather === 'windfall') report.events.push({ type: 'windfall' });
      }
      s.night = report;
      result = { kind: 'night', report };
      break;
    }

    case 'festival': {
      if (!s.finale) fail('The festival is at the end of the year.');
      if (s.pendingCrosses.length) fail('Decide on the hybrids first.');
      s.market = null;
      s.finale = null;
      s.over = true;
      break;
    }

    case 'dismissNight': {
      s.night = null;
      break;
    }
  }

  s.rng = rng.state;
  return { state: s, result };
}
