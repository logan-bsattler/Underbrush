import { content as defaultContent } from './content';
import { Rng, hashSeed } from './rng';
import { runGrowth } from './growth';
import { crossKey, farmLayout, hybridFor, inSeason, neighbors, seasonOf } from './board';

export * from './board';
import type {
  Action,
  ActionResult,
  Card,
  ForageTrip,
  IdentifyResult,
  Content,
  GameState,
  MealEffect,
  OrderDef,
  Perks,
  RecipeDef,
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

export function basketCapacity(s: GameState, c: Content = defaultContent): number {
  const base = s.gear.includes('biggerbasket') ? c.rules.biggerBasketSize : c.rules.basketSize;
  return base + (s.weather === 'goodseason' ? 1 : 0) + mealBonus(s, 'basket', c);
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

export function spawnCost(speciesId: string, c: Content = defaultContent): number {
  return c.species[speciesId].value + c.rules.spawnMarkup;
}

/** Cultivated species the market sells spawn of: any in your field journal, or identified this year. */
export function spawnStock(s: GameState, c: Content = defaultContent): string[] {
  return c.speciesOrder.filter((id) => c.species[id].kind === 'cultivated' && (s.perks.spawn.includes(id) || s.discovered.includes(id)));
}

/** Whether storage holds what a dish needs. */
export function canCook(s: GameState, recipe: RecipeDef): boolean {
  return Object.entries(recipe.needs).every(([id, n]) => (s.storage[id] ?? 0) >= n);
}

export function compostSaleValue(s: GameState, c: Content = defaultContent): number {
  return c.rules.compostValue + (s.weather === 'marketday' ? 1 : 0);
}

export function actionsPerMonth(s: GameState, c: Content = defaultContent): number {
  return c.rules.actionsPerRound + s.perks.bonusActions;
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
    return { open: false, reason: `Only open in ${zone.seasons.join(' and ')}` };
  }
  const weather = c.weather.find((w) => w.id === s.weather);
  if (weather?.closes?.includes(zone.id)) return { open: false, reason: `Closed by ${weather.name.toLowerCase()}` };
  return { open: true };
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

/** Which stored mushrooms an order would take, picking the cheapest that fit; null if it can't be filled. */
export function orderPayment(
  storage: Record<string, number>,
  order: OrderDef,
  c: Content = defaultContent,
): Record<string, number> | null {
  const need = order.need;
  const have = (id: string) => storage[id] ?? 0;
  const byValue = (ids: string[]) => ids.slice().sort((a, b) => c.species[a].value - c.species[b].value);
  if (need.kind === 'species') {
    for (const [id, n] of Object.entries(need.items)) if (have(id) < n) return null;
    return { ...need.items };
  }
  if (need.kind === 'hybrids') {
    const pay: Record<string, number> = {};
    let left = need.count;
    for (const id of byValue(Object.keys(storage).filter((id) => c.species[id].kind === 'hybrid'))) {
      const take = Math.min(have(id), left);
      if (take > 0) pay[id] = take;
      left -= take;
    }
    return left === 0 ? pay : null;
  }
  const ids = byValue(Object.keys(storage).filter((id) => have(id) > 0)).slice(0, need.count);
  if (ids.length < need.count) return null;
  return Object.fromEntries(ids.map((id) => [id, 1]));
}

export function score(s: GameState, c: Content = defaultContent) {
  const hybrids = s.hybridsMade.length * c.rules.hybridPoints;
  const planted = s.planted.length * c.rules.plantedPoints;
  const coins = Math.floor(s.coins / c.rules.coinsPerPoint);
  const feast = s.feastPoints;
  const total = s.orderPoints + hybrids + planted + coins + feast;
  const tier = [...c.rules.tiers].reverse().find((t) => total >= t.min) ?? null;
  return { orders: s.orderPoints, hybrids, planted, coins, feast, total, tier };
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
  };
}

/** Brings a save from an older build up to the current shape. */
export function migrateState(s: GameState, c: Content = defaultContent): GameState {
  if (!s.size) s.size = c.rules.gridSize;
  if (!s.perks) s.perks = standardPerks(c);
  s.perks.bonusActions ??= 0;
  s.perks.autoHarvest ??= false;
  s.perks.spawn ??= [];
  // Saves from before boards were all on Streamside, with the stream down the left column.
  s.board ??= 'streamside';
  s.grid.forEach((sq, i) => (sq.damp ??= i % s.size === 0));
  s.orderSwaps ??= 0;
  s.meal ??= null;
  s.feastPoints ??= 0;
  for (const z of c.zones) s.decks[z.id] ??= { draw: new Rng(hashSeed(`${s.seed}:${z.id}`)).shuffle(buildDeck(z)), discard: [] };
  if (!s.stats.identified) s.stats.identified = {};
  s.compostPile ??= [];
  s.finale ??= null;
  s.stats.scraps ??= s.compostPile.length;
  s.stats.compostTiles ??= 0;
  // A trip saved by the older draw-one-card build ends where it stood; its finds are already in the basket.
  if (s.forage && !s.forage.patch) {
    s.forage.patch = [];
    s.forage.depth = 1;
    if (s.forage.status === 'open') s.forage.status = 'stopped';
  }
  return s;
}

function buildDeck(zone: ZoneDef): Card[] {
  const cards: Card[] = [];
  for (const entry of zone.deck) for (let i = 0; i < entry.copies; i++) cards.push({ ...entry.card });
  return cards;
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
  for (const z of c.zones) decks[z.id] = { draw: rng.shuffle(buildDeck(z)), discard: [] };
  const orderDeck = rng.shuffle(c.orders.filter((o) => !o.requires || perks.shop.includes(o.requires)).map((o) => o.id));

  const s: GameState = {
    version: 1,
    mode,
    seed,
    size,
    board,
    perks,
    rng: 0,
    round: 1,
    actionsLeft: r.actionsPerRound + perks.bonusActions,
    weather: 'clear',
    coins: r.startCoins + perks.bonusCoins,
    grid,
    basket: [],
    shed: [],
    compostPile: [],
    storage: {},
    gear: perks.heirlooms.slice(),
    tentPlaced: false,
    decks,
    orders: { visible: orderDeck.slice(0, r.ordersVisible), deck: orderDeck.slice(r.ordersVisible), filled: [] },
    orderPoints: 0,
    orderSwaps: 0,
    meal: null,
    feastPoints: 0,
    planted: [],
    hybridsMade: [],
    discovered: [],
    lookalikesFound: [],
    watered: false,
    market: null,
    forage: null,
    pendingCrosses: [],
    declinedCrosses: [],
    night: null,
    moldPenalty: 0,
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
    },
    over: false,
  };
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
  s.market = { orderFilled: false };
}

/** On festival morning only the last harvest and market visit are open. */
function guardFinale(s: GameState) {
  if (s.finale) fail('It is festival morning: there is time for one last harvest and a market visit, nothing more.');
}

/** Takes the top card of a zone deck. A trip is one pass through it, so null once it runs out. */
function takeCard(s: GameState, zone: string): Card | null {
  return s.decks[zone].draw.shift() ?? null;
}

/** Going deeper leaves the unturned cards behind for the rest of the trip. Deep finds were never in the deck. */
function leaveHidden(s: GameState, trip: ForageTrip) {
  for (const p of trip.patch) if (!p.flipped && !p.deep) s.decks[trip.zone].discard.push(p.card);
}

/** When a trip ends, every card goes back and the deck is shuffled, so the next trip walks the whole zone again. */
function restockDeck(s: GameState, trip: ForageTrip, rng: Rng) {
  const deck = s.decks[trip.zone];
  const unturned = trip.patch.filter((p) => !p.flipped && !p.deep).map((p) => p.card);
  deck.draw = rng.shuffle([...deck.draw, ...deck.discard, ...unturned]);
  deck.discard = [];
}

/** A rare find for a patch this deep: a wild species that is in season now, or a forager's cache of coins. */
function deepFind(s: GameState, zone: ZoneDef, rng: Rng, c: Content): Card | null {
  const season = seasonOf(s.round, c);
  const options = zone.deep.filter((card) => card.type !== 'specimen' || inSeason(card.species, season, c));
  return options.length ? { ...rng.pick(options) } : null;
}

function dealPatch(s: GameState, trip: ForageTrip, rng: Rng, c: Content) {
  const n = c.rules.patchSize * c.rules.patchSize;
  const zone = c.zones.find((z) => z.id === trip.zone)!;
  const deep = trip.depth >= c.rules.deepAt ? deepFind(s, zone, rng, c) : null;
  trip.patch = [];
  for (let i = 0; i < (deep ? n - 1 : n); i++) {
    const card = takeCard(s, trip.zone);
    if (!card) break;
    trip.patch.push({ card, flipped: false, outcome: null });
  }
  if (deep) trip.patch.splice(Math.floor(rng.next() * (trip.patch.length + 1)), 0, { card: deep, flipped: false, outcome: null, deep: true });
}

/** Hazards orthogonally beside a patch card: the rustle you notice once you've turned it. */
export function hazardsNear(trip: ForageTrip, index: number, c: Content = defaultContent): number {
  return neighbors(index, c.rules.patchSize).filter((n) => trip.patch[n]?.card.type === 'hazard').length;
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
  const s: GameState = structuredClone(prev);
  const rng = new Rng(s.rng);
  let result: ActionResult = { kind: 'none' };

  switch (action.type) {
    case 'forage': {
      guardIdle(s);
      guardFinale(s);
      if (s.forage) s.forage = null;
      const zone = c.zones.find((z) => z.id === action.zone) ?? fail('Unknown zone.');
      const status = zoneStatus(s, zone, c);
      if (!status.open) fail(status.reason);
      spendAction(s);
      s.market = null;
      // Saves from before trips were a single pass can still hold discards: shuffle them back in first.
      const deck = s.decks[zone.id];
      if (deck.discard.length) {
        deck.draw = rng.shuffle([...deck.draw, ...deck.discard]);
        deck.discard = [];
      }
      s.tripCount += 1;
      s.stats.trips += 1;
      s.forage = {
        id: s.tripCount,
        zone: zone.id,
        patch: [],
        depth: 1,
        drawn: [],
        hazards: 0,
        knifeUsed: false,
        picked: [],
        status: 'open',
        lost: [],
      };
      dealPatch(s, s.forage, rng, c);
      break;
    }

    case 'deeper': {
      const trip = s.forage;
      if (!trip || trip.status !== 'open') fail('You are not out foraging.');
      if (!s.decks[trip.zone].draw.length) fail("You've walked the whole zone. Time to head home.");
      leaveHidden(s, trip);
      trip.depth += 1;
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
      if (!spot.deep) s.decks[trip.zone].discard.push(card);
      let outcome: ActionResult & { kind: 'draw' } = { kind: 'draw', index: action.index, card, outcome: 'basket' };
      if (card.type === 'specimen') {
        const sp = c.species[card.species];
        if (sp.kind === 'wild' && !inSeason(sp.id, seasonOf(s.round, c), c)) {
          outcome.outcome = 'emptyPatch';
        } else if (s.basket.length >= basketCapacity(s, c)) {
          outcome.outcome = 'basketFull';
        } else if (masteryOf(s, sp.id) >= 2 && sp.kind === 'wild') {
          // An Expert recognizes it on sight; wild finds go straight to storage.
          addStorage(s, sp.id);
          s.stats.identified[sp.id] = (s.stats.identified[sp.id] ?? 0) + 1;
          outcome.outcome = 'known';
        } else {
          const uid = s.nextUid++;
          const known = masteryOf(s, sp.id) >= 2;
          s.basket.push({ uid, species: card.species, identified: known, trip: trip.id });
          trip.picked.push(uid);
          if (known) {
            s.stats.identified[sp.id] = (s.stats.identified[sp.id] ?? 0) + 1;
            outcome.outcome = 'known';
          }
        }
      } else if (card.type === 'coins') {
        s.coins += card.amount;
        s.stats.coinsEarned += card.amount;
        outcome.outcome = 'coins';
      } else if (card.type === 'substrate') {
        s.shed.push(card.substrate);
        outcome.outcome = 'substrate';
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
            trip.lost = trip.picked.slice(c.rules.bustKeep);
            s.basket = s.basket.filter((b) => !trip.lost.includes(b.uid));
            restockDeck(s, trip, rng);
          }
        }
      }
      spot.outcome = outcome.outcome;
      trip.drawn.push({ card, outcome: outcome.outcome });
      result = outcome;
      break;
    }

    case 'stopForage': {
      if (!s.forage || s.forage.status !== 'open') fail('You are not out foraging.');
      restockDeck(s, s.forage, rng);
      s.forage.status = 'stopped';
      break;
    }

    case 'closeTrip': {
      if (s.forage && s.forage.status === 'open') fail('Head home first.');
      s.forage = null;
      break;
    }

    case 'identify': {
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
      if (s.forage && s.forage.status === 'open') fail('Finish your forage trip first.');
      const spec = specimenFor(s, action.uid);
      s.basket = s.basket.filter((b) => b.uid !== spec.uid);
      s.compostPile.push(spec.species);
      s.stats.scraps += 1;
      break;
    }

    case 'compostBasket': {
      if (s.forage && s.forage.status === 'open') fail('Finish your forage trip first.');
      if (!s.basket.length) fail('Your basket is empty.');
      for (const spec of s.basket) s.compostPile.push(spec.species);
      s.stats.scraps += s.basket.length;
      s.basket = [];
      break;
    }

    case 'placeSubstrate': {
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
      guardIdle(s);
      if (s.finale?.harvested) fail("You've brought in the last harvest. Time for the festival.");
      const ready = s.grid.filter((sq) => sq.stage === 'F' && !sq.blight && sq.species);
      if (!ready.length) fail('Nothing is fruiting yet.');
      if (s.finale) s.finale.harvested = true;
      else spendAction(s);
      s.market = null;
      const gained: Record<string, number> = {};
      for (const sq of ready) {
        addStorage(s, sq.species!);
        gained[sq.species!] = (gained[sq.species!] ?? 0) + 1;
        sq.stage = 'C';
        sq.hold = 0;
      }
      result = { kind: 'harvest', gained };
      break;
    }

    case 'sell': {
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
      guardIdle(s);
      if (!s.orders.visible.includes(action.order)) fail('That order is not on the board.');
      if (s.market?.orderFilled) fail('One order per market visit.');
      const order = c.orders.find((o) => o.id === action.order)!;
      const pay = orderPayment(s.storage, order, c);
      if (!pay) fail("You don't have what this order needs.");
      openMarketVisit(s);
      for (const [id, n] of Object.entries(pay)) takeStorage(s, id, n);
      s.market!.orderFilled = true;
      s.orderPoints += order.points;
      s.orders.filled.push(order.id);
      s.orders.visible = s.orders.visible.filter((o) => o !== order.id);
      const next = s.orders.deck.shift();
      if (next) s.orders.visible.push(next);
      result = { kind: 'order', points: order.points };
      break;
    }

    case 'swapOrder': {
      guardIdle(s);
      if (!s.orders.visible.includes(action.order)) fail('That order is not on the board.');
      if (!s.orders.deck.length) fail('No other orders are waiting.');
      const cost = swapCost(s, c);
      if (s.coins < cost) fail(`Swapping an order costs ${cost} coins.`);
      openMarketVisit(s);
      s.coins -= cost;
      s.orderSwaps += 1;
      const at = s.orders.visible.indexOf(action.order);
      s.orders.visible[at] = s.orders.deck.shift()!;
      s.orders.deck.push(action.order);
      break;
    }

    case 'buySpawn': {
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
      guardIdle(s);
      guardFinale(s);
      const recipe = c.recipes.find((r) => r.id === action.recipe) ?? fail('Unknown dish.');
      if (s.meal) fail("You've already cooked this month.");
      if (!canCook(s, recipe)) fail(`${recipe.name} needs ${Object.entries(recipe.needs).map(([id, n]) => `${n} ${c.species[id].name}`).join(' and ')}.`);
      for (const [id, n] of Object.entries(recipe.needs)) takeStorage(s, id, n);
      s.meal = recipe.id;
      if (recipe.effect.type === 'actions') s.actionsLeft += recipe.effect.amount;
      if (recipe.effect.type === 'points') s.feastPoints += recipe.effect.amount;
      break;
    }

    case 'buyGear': {
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
      if (!s.gear.includes('growtent')) fail('You need the Grow Tent.');
      if (s.tentPlaced) fail('The tent is already pitched.');
      const sq = s.grid[action.square];
      if (!sq || sq.tree) fail('Pick a square for the tent.');
      sq.tent = true;
      s.tentPlaced = true;
      break;
    }

    case 'moveTent': {
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
        a.species && b.species && hybridFor(a.species, b.species, c) === cross.hybrid && !a.blight && !b.blight && other.species;
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
        for (const sq of s.grid) {
          if (sq.stage !== 'F' || sq.blight || !sq.species) continue;
          addStorage(s, sq.species);
          gained[sq.species] = (gained[sq.species] ?? 0) + 1;
          sq.stage = 'C';
          sq.hold = 0;
        }
        if (Object.keys(gained).length) report.events.push({ type: 'autoHarvest', gained });
      }
      if (final) {
        // No month 13: the morning after is the festival, with time for one last harvest and market visit.
        s.finale = { harvested: false, marketed: false };
        s.actionsLeft = 0;
        s.watered = false;
        s.weather = 'clear';
      } else {
        if (seasonTurns) report.events.push({ type: 'season', season: seasonOf(s.round + 1, c) });
        s.round += 1;
        s.actionsLeft = actionsPerMonth(s, c) - s.moldPenalty;
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
