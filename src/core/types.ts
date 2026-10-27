export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Substrate = 'log' | 'straw' | 'woodchip' | 'compost';
export type GrowthRate = 'fast' | 'medium' | 'slow' | 'verySlow' | 'none';
export type Stage = 'S' | 'C' | 'P' | 'F';
export type SpeciesKind = 'cultivated' | 'wild' | 'hybrid';

export interface SpeciesArt {
  shape: 'shelf' | 'cap' | 'ball' | 'tooth' | 'kidney' | 'cluster' | 'funnel' | 'morel' | 'bolete';
  cap: string;
  shade: string;
  gill: string;
  stem: string;
  fringe?: boolean;
  gloss?: boolean;
}

export interface SpeciesTraits {
  spreader?: 'normal' | 'aggressive';
  needsShade?: boolean;
  coldHardy?: boolean;
  thirsty?: boolean;
  hungry?: boolean;
}

export interface SpeciesDef {
  id: string;
  name: string;
  latin?: string;
  kind: SpeciesKind;
  value: number;
  substrates: Substrate[];
  seasons: Season[] | 'any';
  growth: GrowthRate;
  /** What an unidentified specimen looks like, e.g. "Golden funnel". Hybrids have none. */
  group?: string;
  lookalike?: { name: string; on: number };
  parents?: [string, string];
  traits: SpeciesTraits;
  rule: string;
  blurb: string;
  art: SpeciesArt;
}

export type Card =
  | { type: 'specimen'; species: string }
  | { type: 'substrate'; substrate: Substrate }
  | { type: 'coins'; amount: number }
  | { type: 'hazard'; name: string };

export interface ZoneDef {
  id: string;
  name: string;
  unlock: string | null;
  seasons?: Season[];
  hazard: string;
  blurb: string;
  color: string;
  deck: { card: Card; copies: number }[];
  /** Rare finds dealt into each patch once a trip is rules.deepAt patches deep. Never part of the deck. */
  deep: Card[];
}

/** A farm layout to start the year on, written for the 4×4 farm; a 5×5 farm extends it right and down. */
export interface BoardDef {
  id: string;
  name: string;
  blurb: string;
  /** The stream runs down the left column: beds there never dry out. */
  stream: boolean;
  /** Other damp squares (a spring or pond), as 4×4 indices. */
  springs: number[];
  trees: number[];
  /** Extra trees on a 5×5 farm, as [row, col]. */
  extraTrees: [number, number][];
  start: { index: number; substrate: Substrate; species?: string; stage?: Stage }[];
}

export type MealEffect =
  | { type: 'actions'; amount: number }
  | { type: 'identify' }
  | { type: 'hazards'; amount: number }
  | { type: 'basket'; amount: number }
  | { type: 'market'; amount: number }
  | { type: 'water' }
  | { type: 'points'; amount: number };

/** A dish cooked from stored mushrooms: one a month, its effect lasts until the month ends. */
export interface RecipeDef {
  id: string;
  name: string;
  needs: Record<string, number>;
  effect: MealEffect;
  rule: string;
}

export interface GearDef {
  id: string;
  name: string;
  cost: number;
  use: string;
  rule: string;
}

export interface WeatherDef {
  id: string;
  name: string;
  from: number;
  to: number;
  rule: string;
  closes?: string[];
}

export type OrderNeed =
  | { kind: 'species'; items: Record<string, number> }
  | { kind: 'hybrids'; count: number }
  | { kind: 'distinct'; count: number };

export interface OrderDef {
  id: string;
  label: string;
  points: number;
  need: OrderNeed;
  /** Gear the shop must stock for this order to be dealt, so orders never ask for a zone you can't reach. */
  requires?: string;
}

export interface TierDef {
  id: string;
  name: string;
  min: number;
}

export interface RulesDef {
  rounds: number;
  roundsPerSeason: number;
  seasons: Season[];
  actionsPerRound: number;
  basketSize: number;
  biggerBasketSize: number;
  startCoins: number;
  gridSize: number;
  ordersVisible: number;
  /** Swapping a festival order costs this many coins, plus 1 for every swap already made this year. */
  swapCost: number;
  /** Spawn of a species costs its value plus this many coins at the market. */
  spawnMarkup: number;
  /** Hiring a hand for +1 action costs this many coins, plus hireStep for every hand already hired this year. */
  hireCost: number;
  hireStep: number;
  /** The second order delivered on one market visit costs this many coins... */
  extraDeliveryCost: number;
  /** ...and each one after that costs this many times the one before. */
  extraDeliveryGrowth: number;
  /** What a substrate tile costs at the market stall. */
  substrateCost: Record<Substrate, number>;
  /** A forage patch is patchSize × patchSize face-down cards dealt from the zone deck. */
  patchSize: number;
  /** From this many patches deep, every patch dealt holds one of the zone's deep finds. */
  deepAt: number;
  bustAt: number;
  bustKeep: number;
  /** When a deep species is in season, the chance a deep find is the zone's cache of coins instead. */
  deepCoinChance: number;
  /** Discarded specimens on the compost pile that rot into one Compost tile overnight. */
  scrapsPerCompost: number;
  /** Coins a Compost tile from the shed sells for at the market. */
  compostValue: number;
  dryMarksToBlight: number;
  crowdingAt: number;
  moldBloomAt: number;
  moldBloomPenalty: number;
  hybridPoints: number;
  plantedPoints: number;
  /** Coins left over at the festival score 1 point per this many, rounded down. */
  coinsPerPoint: number;
  /** The most festival points leftover coins can score. */
  maxCoinPoints: number;
  tiers: TierDef[];
}

export type AchievementCheck =
  /** Turn every non-hazard card in a zone's deck on one trip: in a given zone, or in any zone when none is named. */
  | { type: 'clearZone'; zone?: string }
  /** Make this many different hybrids in one year. */
  | { type: 'hybrids'; count: number }
  /** Deliver this many festival orders in one year. */
  | { type: 'orders'; count: number }
  /** Reach this festival tier (or a higher one) at the festival. */
  | { type: 'tier'; tier: string }
  /** Pick this many rare mushrooms from deep finds in one year. */
  | { type: 'rareFinds'; count: number }
  /** Cook this many different dishes in one year. */
  | { type: 'dishes'; count: number }
  /** Finish a year with at least this many forage trips and no busts. */
  | { type: 'cleanYear'; trips: number }
  /** Every square of the farm but the trees growing a mushroom at once. */
  | { type: 'fullFarm' }
  /** Rot this many Compost tiles from the compost pile in one year. */
  | { type: 'compost'; count: number }
  /** Earn this many coins in one year. */
  | { type: 'coinsEarned'; amount: number }
  /** Reach a festival tier with at least this many Legend challenges taken on. */
  | { type: 'challenges'; count: number }
  /** Work the homestead as this generation or a later one. */
  | { type: 'generation'; count: number };

/** A feat the field journal remembers across years. Earned once, from any story or daily year. */
export interface AchievementDef {
  id: string;
  name: string;
  rule: string;
  check: AchievementCheck;
}

export type Unlock =
  | { type: 'gear'; id: string }
  | { type: 'heirloomSlot' }
  | { type: 'farmSize'; size: number }
  | { type: 'startCoins'; amount: number }
  | { type: 'actions'; amount: number }
  | { type: 'board'; id: string }
  | { type: 'autoHarvest' };

export interface LevelDef {
  level: number;
  title: string;
  renown: number;
  blurb: string;
  unlocks: Unlock[];
}

export interface MasteryDef {
  level: number;
  name: string;
  /** Real identifications of a species, across all years, to reach this level. */
  ids: number;
  rule: string;
}

export type ChallengeEffect = { type: 'actions'; amount: number } | { type: 'basket'; amount: number } | { type: 'lean' };

/** A handicap a Legend can take on for a story year, for more renown. */
export interface ChallengeDef {
  id: string;
  name: string;
  rule: string;
  /** Extra renown, as a fraction of the festival score. */
  renownBonus: number;
  effect: ChallengeEffect;
}

/** What passing the homestead on carries down each generation. */
export interface LegacyDef {
  /** Every tier's threshold rises by this much per generation after the first. */
  tierStep: number;
  /** Extra starting coins per generation after the first: the family's mark. */
  startCoins: number;
}

export interface ProgressionDef {
  levels: LevelDef[];
  mastery: MasteryDef[];
  legacy: LegacyDef;
  challenges: ChallengeDef[];
}

export interface Content {
  rules: RulesDef;
  progression: ProgressionDef;
  species: Record<string, SpeciesDef>;
  speciesOrder: string[];
  zones: ZoneDef[];
  gear: GearDef[];
  weather: WeatherDef[];
  orders: OrderDef[];
  boards: BoardDef[];
  recipes: RecipeDef[];
  achievements: AchievementDef[];
}

// ── State ────────────────────────────────────────────────────────────────

export interface Square {
  tree: boolean;
  substrate: Substrate | null;
  species: string | null;
  stage: Stage | null;
  /** Growth phases already spent waiting at the current stage (slow species). */
  hold: number;
  dry: number;
  blight: boolean;
  tent: boolean;
  /** Beside the stream or a spring: never takes dry marks. */
  damp: boolean;
}

export interface Specimen {
  uid: number;
  species: string;
  identified: boolean;
  /** Round it was picked, so a bust can tell this trip's finds from older ones. */
  trip: number;
  /** A deep find. */
  rare?: boolean;
}

/** One face-down card on the forest floor. */
export interface PatchCard {
  card: Card;
  flipped: boolean;
  outcome: DrawOutcome | null;
  /** A deep find: not from the deck, so it never goes back into it. */
  deep?: boolean;
}

export interface ForageTrip {
  id: number;
  zone: string;
  /** The patch of forest floor in front of you, row by row. */
  patch: PatchCard[];
  /** How many patches deep into the zone you've walked this trip (1 on arrival). */
  depth: number;
  /** Every card turned this trip, in order, with what a find bumped out of a full basket. */
  drawn: { card: Card; outcome: DrawOutcome; dropped?: Specimen }[];
  hazards: number;
  knifeUsed: boolean;
  /** uids of specimens picked on this trip, in draw order. */
  picked: number[];
  status: 'open' | 'stopped' | 'busted';
  lost: number[];
  /** Non-hazard cards left face down when you went deeper: any at all and the zone can't be cleared this trip. */
  missed: number;
  /** Every non-hazard card in the zone's deck has been turned this trip. */
  cleared: boolean;
}

export type DrawOutcome =
  | 'basket'
  | 'known'
  | 'basketFull'
  | 'swapped'
  | 'emptyPatch'
  | 'coins'
  | 'substrate'
  | 'hazard'
  | 'hazardIgnored'
  | 'bust';

export interface Cross {
  a: number;
  b: number;
  hybrid: string;
}

export type NightEvent =
  | { type: 'dry'; square: number }
  | { type: 'blight'; square: number; cause: 'dry' | 'crowding' | 'spread' }
  | { type: 'grow'; square: number; from: Stage; to: Stage }
  | { type: 'wait'; square: number; reason: 'season' | 'shade' | 'cold' | 'dryspell' | 'blight' | 'slow' }
  | { type: 'overripe'; square: number }
  | { type: 'spread'; from: number; to: number; species: string }
  | { type: 'takeover'; from: number; to: number; species: string }
  | { type: 'eat'; from: number; to: number }
  | { type: 'cross'; a: number; b: number; hybrid: string }
  | { type: 'moldBloom'; count: number }
  | { type: 'spoil'; lost: Record<string, number> }
  | { type: 'season'; season: Season }
  | { type: 'windfall' }
  | { type: 'compost'; tiles: number }
  /** Beds picked at first light, and the squares they were on. */
  | { type: 'autoHarvest'; gained: Record<string, number>; squares: number[] };

export interface NightReport {
  round: number;
  events: NightEvent[];
}

export interface Stats {
  /** Real identifications per species this year; feeds species mastery. */
  identified: Record<string, number>;
  tendActions: number[];
  idleActions: number[];
  busts: number;
  trips: number;
  lookalikes: number;
  coinsEarned: number;
  /** Scraps that reached the compost pile, and the Compost tiles they rotted into. */
  scraps: number;
  compostTiles: number;
  /** Rare mushrooms picked from deep finds. */
  rareFinds: number;
  /** Different dishes cooked this year. */
  dishes: string[];
}

/** What the homestead's progression brings into a year. Daily years use the standard kit. */
export interface Perks {
  /** Gear the market stocks this year. */
  shop: string[];
  /** Gear you own from the first month. */
  heirlooms: string[];
  /** Species mastery level by species id (0 when absent). */
  mastery: Record<string, number>;
  bonusCoins: number;
  bonusActions: number;
  size: number;
  /** Fruiting beds are picked into storage each morning. */
  autoHarvest: boolean;
  /** Cultivated species the market sells spawn of from the first month: those in the field journal. */
  spawn: string[];
  /** How many times the homestead has been passed on, plus one. Raises the tier thresholds. */
  generation: number;
  /** Legend challenges taken on this year. */
  challenges: string[];
}

export interface GameState {
  version: 1;
  mode: 'story' | 'daily';
  seed: string;
  /** Farm width and height in squares. */
  size: number;
  /** The farm layout the year started on. */
  board: string;
  perks: Perks;
  rng: number;
  round: number;
  actionsLeft: number;
  weather: string;
  coins: number;
  grid: Square[];
  basket: Specimen[];
  shed: Substrate[];
  /** Scraps on the pile: discarded and spoiled species ids, and composted substrate tiles. They rot into Compost tiles overnight. */
  compostPile: string[];
  storage: Record<string, number>;
  gear: string[];
  tentPlaced: boolean;
  decks: Record<string, { draw: Card[]; discard: Card[] }>;
  orders: { visible: string[]; deck: string[]; filled: string[] };
  orderPoints: number;
  /** Orders swapped off the board this year; each swap costs a coin more than the last. */
  orderSwaps: number;
  /** Hands hired this year; each costs more than the last. */
  hires: number;
  /** The month a hand was last hired (0 if never): one a month. */
  hiredRound: number;
  /** The dish eaten this month, if any; it lasts until the month ends. */
  meal: string | null;
  /** Festival points from dishes that the judges remember. */
  feastPoints: number;
  planted: string[];
  hybridsMade: string[];
  discovered: string[];
  lookalikesFound: string[];
  /** Zones cleared this year: every card but the hazards turned on one trip. */
  zonesCleared: string[];
  watered: boolean;
  /** An open market visit and the orders delivered on it so far. */
  market: { deliveries: number } | null;
  forage: ForageTrip | null;
  pendingCrosses: Cross[];
  declinedCrosses: string[];
  night: NightReport | null;
  /**
   * The morning after month 12: one last harvest and one market visit, free of actions, before the
   * festival. Null during the year and after the festival.
   */
  finale: { harvested: boolean; marketed: boolean } | null;
  moldPenalty: number;
  nextUid: number;
  tripCount: number;
  stats: Stats;
  over: boolean;
}

export type Action =
  | { type: 'forage'; zone: string }
  | { type: 'flip'; index: number }
  | { type: 'deeper' }
  | { type: 'stopForage' }
  | { type: 'closeTrip' }
  /** Identifies every unidentified specimen in the basket, for one action. */
  | { type: 'identify' }
  | { type: 'plant'; uid: number; square: number }
  | { type: 'discard'; uid: number }
  /** Composts every specimen in the basket, identified or not. */
  | { type: 'compostBasket' }
  | { type: 'placeSubstrate'; index: number; square: number }
  | { type: 'water' }
  | { type: 'clearBlight'; square: number }
  | { type: 'compostSquare'; square: number }
  | { type: 'harvest' }
  | { type: 'sell'; species: string; count: number }
  /** Sells Compost tiles from the shed. */
  | { type: 'sellCompost'; count: number }
  | { type: 'fillOrder'; order: string }
  /** Sends a festival order to the bottom of the deck and deals the next, for coins. */
  | { type: 'swapOrder'; order: string }
  /** Hires a hand for the month: +1 action, for coins. One a month; no market visit needed. */
  | { type: 'hireHand' }
  /** Buys a substrate tile for the shed. */
  | { type: 'buySubstrate'; substrate: Substrate }
  /** Buys spawn of a cultivated species you've identified: an identified specimen for your basket. */
  | { type: 'buySpawn'; species: string }
  /** Takes one stored cultivated or hybrid mushroom back out as spawn to plant. Free. */
  | { type: 'saveSpawn'; species: string }
  /** Cooks a dish from stored mushrooms. Free, one a month. */
  | { type: 'cook'; recipe: string }
  | { type: 'buyGear'; gear: string }
  | { type: 'leaveMarket' }
  | { type: 'placeTent'; square: number }
  /** Re-pitches the grow tent on another square: a Tend action. */
  | { type: 'moveTent'; square: number }
  | { type: 'resolveCross'; index: number; replace: 'a' | 'b' | null }
  | { type: 'endMonth' }
  | { type: 'festival' }
  | { type: 'dismissNight' };

export interface IdentifyResult {
  uid: number;
  species: string;
  real: boolean;
  rolls: number[];
  kept: number;
}

/** What the UI may want to animate after an action. */
export type ActionResult =
  | { kind: 'none' }
  | { kind: 'identify'; results: IdentifyResult[] }
  | { kind: 'draw'; index: number; card: Card; outcome: DrawOutcome; dropped?: Specimen; cleared?: boolean }
  | { kind: 'harvest'; gained: Record<string, number>; squares: number[] }
  | { kind: 'sell'; coins: number }
  | { kind: 'order'; points: number }
  | { kind: 'night'; report: NightReport };
