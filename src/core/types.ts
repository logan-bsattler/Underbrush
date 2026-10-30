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
  /** Glows in the dark: a soft halo behind the mushroom. */
  glow?: boolean;
  /** A ball that sits in a star of split skin (an earthstar). */
  star?: boolean;
  /** Beads of red sap on the cap. */
  drops?: boolean;
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
  | { type: 'hazard'; name: string }
  | { type: 'artifact'; artifact: string }
  /** Plain forest floor: bare ground, brush or a tree. Nothing to take, but its number still tells. */
  | { type: 'ground'; name: string; look: 'ground' | 'brush' | 'tree' }
  /** The way down to a zone's next layer, dealt from outside the deck. Turn it to open the descent. */
  | { type: 'entrance'; zone: string; depth: number };

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

/** One level of a zone's underground: a small deck of its own, dealt as a single patch when you descend into it. */
export interface LayerDef {
  name: string;
  blurb: string;
  /** Family lore that hints at this layer before it opens... */
  clue: string;
  /** ...and the line that pays it off the first time the family reaches it. */
  payoff: string;
  /** Dealt into the layer's patch until it's found that year. Never part of the deck. */
  artifact: string;
  deck: { card: Card; copies: number }[];
}

export type SetEffect =
  | { type: 'coins'; amount: number }
  | { type: 'glint' }
  | { type: 'points'; amount: number }
  | { type: 'shortcut' }
  | { type: 'keep'; amount: number }
  | { type: 'basket'; amount: number };

/** A curiosity from the underground: festival points the year it comes home, and a place in the cabinet for good. */
export interface ArtifactDef {
  id: string;
  name: string;
  set: string;
  points: number;
  blurb: string;
  /** The founder's mark on it: one clue to where the Founder's Cellar lies. */
  inscription?: string;
  /** What the mark points to. The cellar opens only once the family's marks point to all three. */
  mark?: CacheMark;
}

export type CacheMark = 'tree' | 'place' | 'season';

/** The one puzzle of the saga: the artifacts' inscriptions point to a spot to dig, in one zone, in one season. */
export interface CacheDef {
  name: string;
  zone: string;
  /** The surface ground card to dig under. */
  card: string;
  season: Season;
  /** Festival points the year it's found. */
  points: number;
  premise: string;
  /** What a dig in the wrong spot turns up, once the family knows enough to look. */
  wrong: string;
  /** The place, as it's found... */
  place: string;
  /** ...and the family's story, ending. */
  ending: string;
}

/** Artifacts that belong together. A full set in the cabinet brings a small perk to every story year after. */
export interface ArtifactSetDef {
  id: string;
  name: string;
  rule: string;
  clue: string;
  payoff: string;
  effect: SetEffect;
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
  | { kind: 'distinct'; count: number }
  /** Any wild mushrooms that grow in a zone, on its forest floor or in its deep patches. */
  | { kind: 'zone'; zone: string; count: number }
  /** Any mushrooms from below ground. Only dealt once a generation has a layer open. */
  | { kind: 'below'; count: number };

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
  /**
   * What a bust below ground costs next month at the homestead: actions[d − 1] actions for a fall in
   * layer d, and the whole month away from layer awayFrom on.
   */
  recovery: { actions: number[]; awayFrom: number };
  /** When a deep species is in season, the chance a deep find is the zone's cache of coins instead. */
  deepCoinChance: number;
  /** With a Spade: digging under one of these ground cards, while the species is in season, turns it up this often. */
  dig: { hosts: string[]; species: string; chance: number };
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
  /** The first commission of a year costs this many coins... */
  commissionCost: number;
  /** ...and each one after costs this many times the one before. */
  commissionGrowth: number;
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
  | { type: 'generation'; count: number }
  /** Descend this many layers below a zone on one trip. */
  | { type: 'layer'; depth: number }
  /** Bring home this many artifacts in one year. */
  | { type: 'artifacts'; count: number };

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
  | { type: 'autoHarvest' }
  | { type: 'commissions' };

export interface LevelDef {
  level: number;
  title: string;
  renown: number;
  blurb: string;
  unlocks: Unlock[];
  /** How far every festival tier sits above the printed thresholds at this level, before any generation lift. */
  tierLift: number;
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
  /** The zone whose newly opened layer the family tells of as each generation begins, from generation 2. */
  lore: string[];
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
  /** Bigger orders a homestead can pay to take on at the market, one at a time, once a level stocks them. */
  commissions: OrderDef[];
  boards: BoardDef[];
  recipes: RecipeDef[];
  achievements: AchievementDef[];
  /** Each zone's underground layers, top down, by zone id. Generation 2 opens the first, and each one after opens one more. */
  underground: Record<string, LayerDef[]>;
  artifacts: ArtifactDef[];
  artifactSets: ArtifactSetDef[];
  cache: CacheDef;
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
  /** A deep find, or a layer's artifact: not from the deck, so it never goes back into it. */
  deep?: boolean;
}

export interface ForageTrip {
  id: number;
  zone: string;
  /** The patch of forest floor in front of you, row by row. */
  patch: PatchCard[];
  /** How many patches deep into the zone you've walked this trip (1 on arrival). */
  depth: number;
  /** How many layers below the zone you've descended (0 on the surface). */
  layer: number;
  /** Artifacts turned this trip: they count as finds, so a bust can cost them, and they're brought home when the trip ends. */
  relics: { uid: number; artifact: string }[];
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
  /** The trip ended in a dig: what it turned up. */
  dug?: DigFind;
}

/** A dig's find: the Founder's Cellar, a truffle (into the basket, or storage for an Expert), a truffle with no room for it, or nothing. */
export type DigFind = 'found' | 'truffle' | 'noRoom' | 'empty';

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
  | 'artifact'
  | 'nothing'
  | 'wayDown'
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
  | { type: 'autoHarvest'; gained: Record<string, number>; squares: number[] }
  /** Still sore from last month's fall below ground: the actions it costs this month, or the whole month away. */
  | { type: 'recovering'; zone: string; layer: number; actions: number | 'month' };

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
  /** Times you descended into a layer. */
  descents: number;
  /** Busts below ground by layer (index 1 to 3; index 0 is unused). */
  deepBusts: number[];
  /** Months spent out recovering from a fall in a third layer. */
  monthsAway: number;
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
  /** The homestead's level this year: higher levels raise the tier thresholds too. Daily years are level 1. */
  level: number;
  /** Legend challenges taken on this year. */
  challenges: string[];
  /** Artifact sets complete in the field journal's cabinet. */
  sets: string[];
  /** Artifacts in the cabinet, by id: their marks are the family's clues to the Founder's Cellar. */
  clues: string[];
  /** The family found the Founder's Cellar in an earlier year: there's nothing left to dig for. */
  cacheFound: boolean;
  /** The market takes commissions this year. */
  commissions: boolean;
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
  /** The commission on the board, if one has been taken and not yet delivered, and the ones still waiting. */
  commission: { open: string | null; deck: string[]; taken: number };
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
  /** Artifacts brought home this year. Each scores festival points; once found, it isn't dealt again this year. */
  artifacts: string[];
  /** Underground layers reached this year, as "zone:depth". */
  layersReached: string[];
  /** The Founder's Cellar was found this year. */
  cacheFound: boolean;
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
  /** A fall below ground this month, owed to next month's time at the homestead: the deepest one counts. */
  recovery: { zone: string; layer: number } | null;
  /** Out recovering this month from a fall in a third layer: no homestead moves until the month ends. */
  away: boolean;
  nextUid: number;
  tripCount: number;
  stats: Stats;
  over: boolean;
}

export type Action =
  | { type: 'forage'; zone: string }
  | { type: 'flip'; index: number }
  | { type: 'deeper' }
  /** Goes down into the next underground layer below the zone, from its deep patches or a layer above. */
  | { type: 'descend' }
  | { type: 'stopForage' }
  /** Digs under a turned surface ground card with the Spade, for a truffle or the Founder's Cellar. Either way, the trip ends. */
  | { type: 'dig'; index: number }
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
  | { type: 'takeCommission' }
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
  | { kind: 'night'; report: NightReport }
  | { kind: 'dig'; dug: DigFind; outcome?: DrawOutcome; dropped?: Specimen };
