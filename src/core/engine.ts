import { content as defaultContent } from './content';
import { Rng, hashSeed } from './rng';
import { runGrowth } from './growth';
import { crossKey, hybridFor, inSeason, seasonOf } from './board';

export * from './board';
import type {
  Action,
  ActionResult,
  Card,
  Content,
  GameState,
  OrderDef,
  Square,
  Substrate,
  ZoneDef,
} from './types';

export class GameError extends Error {}

function fail(message: string): never {
  throw new GameError(message);
}

// ── Queries ──────────────────────────────────────────────────────────────

export function basketCapacity(s: GameState, c: Content = defaultContent): number {
  const base = s.gear.includes('biggerbasket') ? c.rules.biggerBasketSize : c.rules.basketSize;
  return base + (s.weather === 'goodseason' ? 1 : 0);
}

export type ZoneStatus = { open: true } | { open: false; reason: string };

export function zoneStatus(s: GameState, zone: ZoneDef, c: Content = defaultContent): ZoneStatus {
  if (zone.unlock && !s.gear.includes(zone.unlock)) {
    const gear = c.gear.find((g) => g.id === zone.unlock);
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
  const total = s.orderPoints + hybrids + planted;
  const tier = [...c.rules.tiers].reverse().find((t) => total >= t.min) ?? null;
  return { orders: s.orderPoints, hybrids, planted, total, tier };
}

// ── Setup ────────────────────────────────────────────────────────────────

export interface NewGameOptions {
  seed?: string;
  mode?: GameState['mode'];
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
  const grid: Square[] = Array.from({ length: r.gridSize * r.gridSize }, (_, i) => ({
    tree: r.trees.includes(i),
    substrate: null,
    species: null,
    stage: null,
    hold: 0,
    dry: 0,
    blight: false,
    tent: false,
  }));
  for (const sq of r.start.squares) {
    grid[sq.index].substrate = sq.substrate;
    if (sq.species) {
      grid[sq.index].species = sq.species;
      grid[sq.index].stage = sq.stage ?? 'S';
    }
  }
  const decks: GameState['decks'] = {};
  for (const z of c.zones) decks[z.id] = { draw: rng.shuffle(buildDeck(z)), discard: [] };
  const orderDeck = rng.shuffle(c.orders.map((o) => o.id));

  const s: GameState = {
    version: 1,
    mode: opts.mode ?? 'story',
    seed,
    rng: 0,
    round: 1,
    actionsLeft: r.actionsPerRound,
    weather: 'clear',
    coins: r.startCoins,
    grid,
    basket: [],
    shed: [],
    storage: {},
    gear: [],
    tentPlaced: false,
    decks,
    orders: { visible: orderDeck.slice(0, r.ordersVisible), deck: orderDeck.slice(r.ordersVisible), filled: [] },
    orderPoints: 0,
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
    nextUid: 1,
    tripCount: 0,
    stats: { tendActions: [0], idleActions: [], busts: 0, trips: 0, lookalikes: 0, coinsEarned: 0 },
    over: false,
  };
  rollWeather(s, rng, c);
  s.rng = rng.state;
  return s;
}

// ── Actions ──────────────────────────────────────────────────────────────

function spendAction(s: GameState) {
  if (s.actionsLeft <= 0) fail('No actions left this week. End the week to rest.');
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
  if (!s.market) {
    spendAction(s);
    s.market = { orderFilled: false };
  }
}

function drawCard(s: GameState, zone: string, rng: Rng): Card {
  const deck = s.decks[zone];
  if (deck.draw.length === 0) {
    deck.draw = rng.shuffle(deck.discard);
    deck.discard = [];
  }
  const card = deck.draw.shift();
  if (!card) fail('This deck is empty.');
  deck.discard.push(card);
  return card;
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
      if (s.forage) s.forage = null;
      const zone = c.zones.find((z) => z.id === action.zone) ?? fail('Unknown zone.');
      const status = zoneStatus(s, zone, c);
      if (!status.open) fail(status.reason);
      spendAction(s);
      s.market = null;
      s.tripCount += 1;
      s.stats.trips += 1;
      s.forage = { id: s.tripCount, zone: zone.id, drawn: [], hazards: 0, knifeUsed: false, picked: [], status: 'open', lost: [] };
      break;
    }

    case 'draw': {
      const trip = s.forage;
      if (!trip || trip.status !== 'open') fail('You are not out foraging.');
      const card = drawCard(s, trip.zone, rng);
      let outcome: ActionResult & { kind: 'draw' } = { kind: 'draw', card, outcome: 'basket' };
      if (card.type === 'specimen') {
        const sp = c.species[card.species];
        if (sp.kind === 'wild' && !inSeason(sp.id, seasonOf(s.round, c), c)) {
          outcome.outcome = 'emptyPatch';
        } else if (s.basket.length >= basketCapacity(s, c)) {
          outcome.outcome = 'basketFull';
        } else {
          const uid = s.nextUid++;
          s.basket.push({ uid, species: card.species, identified: false, trip: trip.id });
          trip.picked.push(uid);
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
          if (trip.hazards >= c.rules.bustAt) {
            outcome.outcome = 'bust';
            trip.status = 'busted';
            s.stats.busts += 1;
            trip.lost = trip.picked.slice(c.rules.bustKeep);
            s.basket = s.basket.filter((b) => !trip.lost.includes(b.uid));
          }
        }
      }
      trip.drawn.push({ card, outcome: outcome.outcome });
      result = outcome;
      break;
    }

    case 'stopForage': {
      if (!s.forage || s.forage.status !== 'open') fail('You are not out foraging.');
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
      const spec = specimenFor(s, action.uid);
      if (spec.identified) fail('Already identified.');
      spendAction(s);
      s.market = null;
      const sp = c.species[spec.species];
      const rolls = s.gear.includes('fieldguide') ? [rng.die(6), rng.die(6)] : [rng.die(6)];
      const kept = Math.max(...rolls);
      const real = kept > (sp.lookalike?.on ?? 1);
      if (real) {
        spec.identified = true;
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
      result = { kind: 'identify', uid: spec.uid, species: sp.id, real, rolls, kept };
      break;
    }

    case 'plant': {
      guardIdle(s);
      const spec = specimenFor(s, action.uid);
      if (!spec.identified) fail('Identify it before you plant it.');
      if (c.species[spec.species].kind !== 'cultivated') fail("That one can't be planted.");
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
      if (s.watered) fail('Already watered this week.');
      spendAction(s);
      s.market = null;
      s.watered = true;
      noteTend(s);
      break;
    }

    case 'clearBlight': {
      guardIdle(s);
      const sq = s.grid[action.square];
      if (!sq?.blight) fail('That bed has no blight.');
      spendAction(s);
      s.market = null;
      sq.blight = false;
      sq.dry = 0;
      noteTend(s);
      break;
    }

    case 'harvest': {
      guardIdle(s);
      const ready = s.grid.filter((sq) => sq.stage === 'F' && !sq.blight && sq.species);
      if (!ready.length) fail('Nothing is fruiting yet.');
      spendAction(s);
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
      const each = c.species[action.species].value + (s.weather === 'marketday' ? 1 : 0);
      takeStorage(s, action.species, n);
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

    case 'buyGear': {
      guardIdle(s);
      const gear = c.gear.find((g) => g.id === action.gear) ?? fail('Unknown gear.');
      if (s.gear.includes(gear.id)) fail('You already own that.');
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

    case 'endWeek': {
      guardIdle(s);
      s.forage = null;
      s.market = null;
      s.stats.idleActions[s.round - 1] = s.actionsLeft;
      const report = runGrowth(s, rng, c);
      if (s.round >= c.rules.rounds) {
        s.over = true;
        s.pendingCrosses = [];
      } else {
        if (s.round % c.rules.roundsPerSeason === 0) {
          if (!s.gear.includes('dehydrator') && Object.keys(s.storage).length) {
            report.events.push({ type: 'spoil', lost: { ...s.storage } });
            s.storage = {};
          }
          report.events.push({ type: 'season', season: seasonOf(s.round + 1, c) });
        }
        s.round += 1;
        s.actionsLeft = c.rules.actionsPerRound - s.moldPenalty;
        s.watered = false;
        s.stats.tendActions[s.round - 1] = 0;
        rollWeather(s, rng, c);
        if (s.weather === 'windfall') report.events.push({ type: 'windfall' });
      }
      s.night = report;
      result = { kind: 'night', report };
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
