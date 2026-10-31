import {
  artifactPoints,
  content,
  seasonOf,
  monthOfSeason,
  type Card,
  type DigFind,
  type DrawOutcome,
  type GameState,
  type NightEvent,
  type OrderProgress,
  type Season,
  type Specimen,
  type Stage,
  type Substrate,
  type TonightEvent,
} from '../core';

export const seasonName: Record<Season, string> = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };
export const stageName: Record<Stage, string> = { S: 'Spawn', C: 'Colonized', P: 'Pinning', F: 'Fruiting' };
export const substrateName: Record<Substrate, string> = { log: 'Log', straw: 'Straw', woodchip: 'Woodchip', compost: 'Compost' };
export const growthName = { fast: 'Fast', medium: 'Medium', slow: 'Slow', verySlow: 'Very slow', none: '—' } as const;

export function monthLabel(round: number) {
  return `${['Early', 'Mid', 'Late'][monthOfSeason(round)]} ${seasonName[seasonOf(round)].toLowerCase()}`;
}

export const name = (id: string) => content.species[id]?.name ?? id;

/** A name after "the": "the Hollow", not "the The Hollow". */
export const bare = (name: string) => name.replace(/^The /, '');

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The stakes of going down, named before descending: what a fall in the next layer would cost. */
export function fallText(cost: number | 'month'): string {
  if (cost === 'month') return 'A fall here: next month out recovering';
  if (!cost) return 'A fall here costs nothing more than a bust';
  return `A fall here: ${plural(cost, 'action')} next month`;
}

/** A bust: the finds kept, and below ground what the fall costs next month. Kept gentle: it's a scrape, not a disaster. */
export function bustText(keep: number, cost: number | 'month' = 0): string {
  const finds = `Bust! You scramble home with only your first ${plural(keep, 'find')}.`;
  if (cost === 'month') return `${finds} It was a hard fall: you'll spend next month out recovering.`;
  if (cost) return `${finds} You took a fall, too: next month you'll be ${plural(cost, 'action')} short.`;
  return finds;
}

/**
 * A spade's find. A miss under a truffle tree in season is just bad luck; anywhere else, once the family's
 * marks say enough, it's the founder's riddle.
 */
export function digText(dug: DigFind, at: { host: boolean; inSeason: boolean; cellarReady: boolean }): string {
  const { dig } = content.rules;
  const truffle = name(dig.species);
  switch (dug) {
    case 'found':
      return `The spade rings on oak, a hand's depth under the ${content.cache.card}.`;
    case 'truffle':
      return `A warty black knob among the roots: a ${truffle.toLowerCase()}!`;
    case 'noRoom':
      return `A ${truffle.toLowerCase()} among the roots, and no room in your basket for it. You leave it for the deer.`;
    case 'empty':
      if (at.host && at.inSeason) return `Nothing under this one. Roots and cold earth, and no ${truffle.toLowerCase()} today.`;
      if (at.cellarReady) return content.cache.wrong;
      if (!at.host) return `Roots and cold earth, and nothing else. ${truffle}s grow under ${hostNames()}.`;
      return `Roots and cold earth. ${truffle}s only come up in ${seasonsText(dig.species).toLowerCase()}.`;
  }
}

/** An order's progress in words, for the marks on its card: "Of 3: 1 stored, 1 in the basket, 1 growing." */
export function orderProgressText(p: OrderProgress): string {
  const parts = [p.stored && `${p.stored} stored`, p.basket && `${p.basket} in the basket`, p.growing && `${p.growing} growing`].filter(Boolean);
  return parts.length ? `Of ${p.need}: ${parts.join(', ')}.` : 'Nothing toward it yet.';
}

/** The trees a spade finds truffles under, as a forager would say them: "oak and hazel". */
export const hostNames = () => content.rules.dig.hosts.map((h) => h.replace(/ Scrub$/, '').toLowerCase()).join(' and ');

/**
 * An artifact turned up: what it is, what it's worth this year, and how far along its set is. One already
 * in the cabinet scores less (see `artifactPoints`), so it says so.
 */
export function artifactText(g: GameState, id: string): string {
  const a = content.artifacts.find((x) => x.id === id);
  if (!a) return 'An artifact: something old. It counts as a find, so get it home safe.';
  const points = artifactPoints(g, id);
  const head = `An artifact: ${a.name}. ${a.blurb}`;
  const tail = ' It counts as a find, so get it home safe.';
  if (g.perks.clues.includes(id)) return `${head} Already in the cabinet: worth ${plural(points, 'point')} this year, not ${a.points}.${tail}`;
  const trip = g.forage;
  const held = new Set([id, ...g.perks.clues, ...g.artifacts, ...(trip?.relics.filter((r) => !trip.lost.includes(r.uid)).map((r) => r.artifact) ?? [])]);
  const pieces = content.artifacts.filter((x) => x.set === a.set);
  const have = pieces.filter((x) => held.has(x.id)).length;
  const set = content.artifactSets.find((x) => x.id === a.set);
  const progress = !set
    ? ''
    : have === pieces.length
      ? ` It completes the ${bare(set.name)}, once it's home.`
      : ` That's ${have} of ${pieces.length} for the ${bare(set.name)}.`;
  return `${head} Worth ${plural(points, 'point')}.${progress}${tail}`;
}

export function seasonsText(id: string) {
  const s = content.species[id].seasons;
  if (s === 'any') return 'Any season';
  return s.map((x) => seasonName[x]).join(', ');
}

export function masteryName(level: number) {
  return content.progression.mastery.find((m) => m.level === level)?.name ?? 'New';
}

export function squareName(i: number, n: number) {
  return `row ${Math.floor(i / n) + 1}, col ${(i % n) + 1}`;
}

export function cardTitle(card: Card) {
  switch (card.type) {
    case 'specimen':
      return content.species[card.species].group ?? name(card.species);
    case 'substrate':
      return `${substrateName[card.substrate]}`;
    case 'coins':
      return `${card.amount} coins`;
    case 'hazard':
      return card.name;
    case 'artifact':
      return content.artifacts.find((a) => a.id === card.artifact)?.name ?? 'Artifact';
    case 'ground':
      return card.name;
    case 'entrance':
      return 'Way down';
  }
}

export function outcomeText(o: DrawOutcome, card: Card, dropped?: Specimen) {
  switch (o) {
    case 'swapped': {
      const left = dropped ? (dropped.identified ? name(dropped.species) : (content.species[dropped.species].group ?? name(dropped.species))) : 'something';
      return `Your basket is full, so you leave the ${left} behind to make room. Identify it at home.`;
    }
    case 'basket':
      return 'Into the basket. What is it really? Identify it at home.';
    case 'known':
      return `You'd know ${card.type === 'specimen' ? name(card.species) : 'it'} anywhere. It comes home already identified.`;
    case 'basketFull':
      return 'Your basket is full, so you leave it be. Only a wild or rare find bumps something out.';
    case 'emptyPatch':
      return `An empty patch: ${card.type === 'specimen' ? name(card.species) : 'it'} isn't fruiting this season.`;
    case 'coins':
      return 'Someone dropped a purse on the trail.';
    case 'substrate':
      return 'Good substrate. It goes to your shed.';
    case 'hazard':
      return 'A hazard. One more this trip and you bust.';
    case 'hazardIgnored':
      return 'Your knife gets you through it. No harm done.';
    case 'artifact': {
      const a = card.type === 'artifact' ? content.artifacts.find((x) => x.id === card.artifact) : null;
      return `An artifact: ${a?.name ?? 'something old'}. ${a?.blurb ?? ''} It counts as a find, so get it home safe.`;
    }
    case 'nothing':
      return `Nothing here but ${card.type === 'ground' ? card.name.toLowerCase() : 'the forest floor'}.`;
    case 'wayDown': {
      const layer = card.type === 'entrance' ? content.underground[card.zone]?.[card.depth - 1] : null;
      return `A way down${layer ? ` to the ${layer.name.replace(/^The /, '')}` : ''}! Tap it to go down, or turn more cards first.`;
    }
    case 'bust':
      return bustText(content.rules.bustKeep);
  }
}

/**
 * One line per night event, or null for events the summary folds together. `picked` is the beds the
 * apprentice harvested at first light, which no longer need harvesting; `finale` is festival morning.
 */
export function eventText(
  e: NightEvent,
  grid: { species: string | null }[],
  night: { picked?: number[]; finale?: boolean } = {},
): string | null {
  const sp = (i: number) => name(grid[i]?.species ?? '');
  switch (e.type) {
    case 'grow':
      return e.to === 'F' && !night.picked?.includes(e.square) ? `${sp(e.square)} is fruiting. Harvest it this month.` : null;
    case 'recovering': {
      const layer = content.underground[e.zone]?.[e.layer - 1];
      const where = layer ? `the ${bare(layer.name)}` : 'the layers below';
      if (e.actions === 'month')
        return night.finale
          ? `Still out recovering from your fall in ${where}, so there's no last harvest. The festival comes anyway.`
          : `You're out recovering from your fall in ${where}. The homestead will keep until next month.`;
      return `Still stiff from your fall in ${where}: ${plural(e.actions, 'action')} fewer this month.`;
    }
    case 'blight':
      return {
        dry: `${sp(e.square)} dried out and caught blight.`,
        crowding: `${sp(e.square)} was too crowded and caught blight.`,
        spread: `Blight crept into a neighboring ${sp(e.square)} bed.`,
      }[e.cause];
    case 'overripe':
      return `${sp(e.square)} went overripe unpicked; the fruit went on the compost pile.`;
    case 'spread':
      return `${name(e.species)} spread to a new square.`;
    case 'takeover':
      return `${name(e.species)} smothered a Puffball bed.`;
    case 'eat':
      return 'Ember Puff ate an empty square of substrate.';
    case 'feed':
      return `The ${sp(e.from)} fed the ${sp(e.to)} beside it.`;
    case 'moldBloom':
      return `Mold bloom: ${e.count} beds are blighted. You lose an action next month.`;
    case 'spoil': {
      const n = Object.values(e.lost).reduce((a, b) => a + b, 0);
      return `The season turned and ${n} stored mushroom${n === 1 ? '' : 's'} spoiled onto the compost pile.`;
    }
    case 'season':
      return `${seasonName[e.season]} arrives.`;
    case 'windfall':
      return 'A windfall log landed in your shed.';
    case 'compost':
      return `The compost pile rotted down into ${e.tiles === 1 ? 'a Compost tile' : `${e.tiles} Compost tiles`} in your shed.`;
    case 'autoHarvest':
      return `Your apprentice picked ${Object.entries(e.gained)
        .map(([id, n]) => `${n} ${name(id)}`)
        .join(', ')} at first light.`;
    default:
      return null;
  }
}

/** A line of the tonight preview: what will happen, the beds it names, and the sheet that can stop it. */
export interface TonightLine {
  text: string;
  squares: number[];
  fix: 'water' | 'clear' | 'harvest' | 'market' | null;
  /** Good news (a cross on offer) rather than a warning. */
  good?: boolean;
}

/** The tonight preview in future tense, worst first, with like events folded into one line. */
export function tonightLines(events: TonightEvent[], grid: { species: string | null }[]): TonightLine[] {
  const sp = (i: number) => name(grid[i]?.species ?? '');
  const beds = (sq: number[]) => (sq.length === 1 ? sp(sq[0]) : `${sq.length} beds`);
  const will = (sq: number[]) => `${beds(sq)} will`;
  const lines: TonightLine[] = [];
  const of = <T extends TonightEvent['type']>(type: T) => events.filter((e): e is Extract<TonightEvent, { type: T }> => e.type === type);
  const blight = (cause: 'dry' | 'crowding' | 'spread') => of('blight').filter((e) => e.cause === cause).map((e) => e.square);

  for (const e of of('moldBloom'))
    lines.push({ text: `Mold bloom: ${e.count} beds blighted. You'd lose an action next month.`, squares: [], fix: 'clear' });
  const dried = blight('dry');
  if (dried.length) lines.push({ text: `${will(dried)} dry out and catch blight.`, squares: dried, fix: 'water' });
  const crowded = blight('crowding');
  if (crowded.length)
    lines.push({ text: `${crowded.length === 1 ? `${sp(crowded[0])} is` : `${crowded.length} beds are`} too crowded and will catch blight.`, squares: crowded, fix: null });
  const crept = blight('spread');
  if (crept.length)
    lines.push({
      text: crept.length === 1 ? `Blight will creep into a neighboring ${sp(crept[0])} bed.` : `Blight will creep into ${crept.length} neighboring beds.`,
      squares: crept,
      fix: 'clear',
    });
  const ripe = of('overripe').map((e) => e.square);
  if (ripe.length) lines.push({ text: `${will(ripe)} go overripe unpicked.`, squares: ripe, fix: 'harvest' });
  for (const e of of('spoil')) {
    const n = Object.values(e.lost).reduce((a, b) => a + b, 0);
    lines.push({ text: `The season turns: ${plural(n, 'stored mushroom')} will spoil.`, squares: [], fix: 'market' });
  }
  const marked = of('dry').map((e) => e.square).filter((i) => !dried.includes(i));
  if (marked.length) lines.push({ text: `${will(marked)} take a dry mark.`, squares: marked, fix: 'water' });
  const eaters = [...new Set(of('eat').map((e) => e.from))];
  if (eaters.length) lines.push({ text: `${name('emberpuff')} will eat a tile beside it.`, squares: eaters, fix: null });
  for (const e of of('cross'))
    lines.push({ text: `${sp(e.a)} and ${sp(e.b)} will offer a cross.`, squares: [e.a, e.b], fix: null, good: true });
  return lines;
}

export const waitText = {
  season: 'out of season',
  shade: 'needs shade',
  cold: 'cold snap',
  dryspell: 'dry spell',
  blight: 'blighted',
  slow: 'slow and steady',
} as const;
