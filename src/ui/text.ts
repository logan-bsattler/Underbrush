import { content, seasonOf, weekOfSeason, type Card, type DrawOutcome, type NightEvent, type Season, type Stage, type Substrate } from '../core';

export const seasonName: Record<Season, string> = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };
export const stageName: Record<Stage, string> = { S: 'Spawn', C: 'Colonized', P: 'Pinning', F: 'Fruiting' };
export const substrateName: Record<Substrate, string> = { log: 'Log', straw: 'Straw', woodchip: 'Woodchip', compost: 'Compost' };
export const growthName = { fast: 'Fast', medium: 'Medium', slow: 'Slow', verySlow: 'Very slow', none: '—' } as const;

export function weekLabel(round: number) {
  return `${['Early', 'Mid', 'Late'][weekOfSeason(round)]} ${seasonName[seasonOf(round)].toLowerCase()}`;
}

export const name = (id: string) => content.species[id]?.name ?? id;

export function seasonsText(id: string) {
  const s = content.species[id].seasons;
  if (s === 'any') return 'Any season';
  return s.map((x) => seasonName[x]).join(', ');
}

export function squareName(i: number) {
  const n = content.rules.gridSize;
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
  }
}

export function outcomeText(o: DrawOutcome, card: Card) {
  switch (o) {
    case 'basket':
      return 'Into the basket. What is it really? Identify it at home.';
    case 'basketFull':
      return 'Your basket is full, so you leave it be.';
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
    case 'bust':
      return 'Bust! You scramble home with only your first two finds.';
  }
}

/** One line per night event, or null for events the summary folds together. */
export function eventText(e: NightEvent, grid: { species: string | null }[]): string | null {
  const sp = (i: number) => name(grid[i]?.species ?? '');
  switch (e.type) {
    case 'grow':
      return e.to === 'F' ? `${sp(e.square)} is fruiting. Harvest it this week.` : null;
    case 'blight':
      return {
        dry: `${sp(e.square)} dried out and caught blight.`,
        crowding: `${sp(e.square)} was too crowded and caught blight.`,
        spread: `Blight crept into a neighboring ${sp(e.square)} bed.`,
      }[e.cause];
    case 'overripe':
      return `${sp(e.square)} went overripe unpicked.`;
    case 'spread':
      return `${name(e.species)} spread to a new square.`;
    case 'takeover':
      return `${name(e.species)} smothered a Puffball bed.`;
    case 'eat':
      return 'Ember Puff ate an empty square of substrate.';
    case 'moldBloom':
      return `Mold bloom: ${e.count} beds are blighted. You lose an action next week.`;
    case 'spoil': {
      const n = Object.values(e.lost).reduce((a, b) => a + b, 0);
      return `The season turned and ${n} stored mushroom${n === 1 ? '' : 's'} spoiled.`;
    }
    case 'season':
      return `${seasonName[e.season]} arrives.`;
    case 'windfall':
      return 'A windfall log landed in your shed.';
    default:
      return null;
  }
}

export const waitText = {
  season: 'out of season',
  shade: 'needs shade',
  cold: 'cold snap',
  dryspell: 'dry spell',
  blight: 'blighted',
  slow: 'slow and steady',
} as const;
