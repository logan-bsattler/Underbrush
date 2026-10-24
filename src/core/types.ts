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
  trees: number[];
  streamColumn: number;
  /** The farm after the "Grower" unlock: the 4×4 layout plus a row and column, and these extra trees as [row, col]. */
  largeFarm: { size: number; extraTrees: [number, number][] };
  start: { squares: { index: number; substrate: Substrate; species?: string; stage?: Stage }[] };
  ordersVisible: number;
  /** A forage patch is patchSize × patchSize face-down cards dealt from the zone deck. */
  patchSize: number;
  bustAt: number;
  bustKeep: number;
  /** Discarded specimens on the compost pile that rot into one Compost tile overnight. */
  scrapsPerCompost: number;
  dryMarksToBlight: number;
  crowdingAt: number;
  moldBloomAt: number;
  moldBloomPenalty: number;
  hybridPoints: number;
  plantedPoints: number;
  tiers: TierDef[];
}

export type Unlock =
  | { type: 'gear'; id: string }
  | { type: 'heirloomSlot' }
  | { type: 'farmSize'; size: number }
  | { type: 'startCoins'; amount: number }
  | { type: 'actions'; amount: number };

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

export interface ProgressionDef {
  levels: LevelDef[];
  mastery: MasteryDef[];
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
}

export interface Specimen {
  uid: number;
  species: string;
  identified: boolean;
  /** Round it was picked, so a bust can tell this trip's finds from older ones. */
  trip: number;
}

/** One face-down card on the forest floor. */
export interface PatchCard {
  card: Card;
  flipped: boolean;
  outcome: DrawOutcome | null;
}

export interface ForageTrip {
  id: number;
  zone: string;
  /** The patch of forest floor in front of you, row by row. */
  patch: PatchCard[];
  /** How many patches deep into the zone you've walked this trip (1 on arrival). */
  depth: number;
  /** Every card turned this trip, in order. */
  drawn: { card: Card; outcome: DrawOutcome }[];
  hazards: number;
  knifeUsed: boolean;
  /** uids of specimens picked on this trip, in draw order. */
  picked: number[];
  status: 'open' | 'stopped' | 'busted';
  lost: number[];
}

export type DrawOutcome =
  | 'basket'
  | 'known'
  | 'basketFull'
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
  | { type: 'compost'; tiles: number };

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
}

/** What the homestead's progression brings into a year. Daily years use the standard kit. */
export interface Perks {
  /** Gear the market stocks this year. */
  shop: string[];
  /** Gear you own from the first week. */
  heirlooms: string[];
  /** Species mastery level by species id (0 when absent). */
  mastery: Record<string, number>;
  bonusCoins: number;
  bonusActions: number;
  size: number;
}

export interface GameState {
  version: 1;
  mode: 'story' | 'daily';
  seed: string;
  /** Farm width and height in squares. */
  size: number;
  perks: Perks;
  rng: number;
  round: number;
  actionsLeft: number;
  weather: string;
  coins: number;
  grid: Square[];
  basket: Specimen[];
  shed: Substrate[];
  /** Species ids of specimens you've discarded; they rot into Compost tiles overnight. */
  compostPile: string[];
  storage: Record<string, number>;
  gear: string[];
  tentPlaced: boolean;
  decks: Record<string, { draw: Card[]; discard: Card[] }>;
  orders: { visible: string[]; deck: string[]; filled: string[] };
  orderPoints: number;
  planted: string[];
  hybridsMade: string[];
  discovered: string[];
  lookalikesFound: string[];
  watered: boolean;
  market: { orderFilled: boolean } | null;
  forage: ForageTrip | null;
  pendingCrosses: Cross[];
  declinedCrosses: string[];
  night: NightReport | null;
  /**
   * The morning after week 12: one last harvest and one market visit, free of actions, before the
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
  | { type: 'identify'; uid: number }
  | { type: 'plant'; uid: number; square: number }
  | { type: 'discard'; uid: number }
  | { type: 'placeSubstrate'; index: number; square: number }
  | { type: 'water' }
  | { type: 'clearBlight'; square: number }
  | { type: 'harvest' }
  | { type: 'sell'; species: string; count: number }
  | { type: 'fillOrder'; order: string }
  | { type: 'buyGear'; gear: string }
  | { type: 'leaveMarket' }
  | { type: 'placeTent'; square: number }
  | { type: 'resolveCross'; index: number; replace: 'a' | 'b' | null }
  | { type: 'endWeek' }
  | { type: 'festival' }
  | { type: 'dismissNight' };

/** What the UI may want to animate after an action. */
export type ActionResult =
  | { kind: 'none' }
  | { kind: 'identify'; uid: number; species: string; real: boolean; rolls: number[]; kept: number }
  | { kind: 'draw'; index: number; card: Card; outcome: DrawOutcome }
  | { kind: 'harvest'; gained: Record<string, number> }
  | { kind: 'sell'; coins: number }
  | { kind: 'order'; points: number }
  | { kind: 'night'; report: NightReport };
