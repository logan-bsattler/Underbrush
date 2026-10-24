import { content as defaultContent } from './content';
import type { Content, Season, Square } from './types';

export function seasonOf(round: number, c: Content = defaultContent): Season {
  const r = Math.min(Math.max(round, 1), c.rules.rounds);
  return c.rules.seasons[Math.floor((r - 1) / c.rules.roundsPerSeason)];
}

/** 0, 1 or 2: early, mid or late in the season. */
export function weekOfSeason(round: number, c: Content = defaultContent): number {
  return (round - 1) % c.rules.roundsPerSeason;
}

export function inSeason(speciesId: string, season: Season, c: Content = defaultContent): boolean {
  const s = c.species[speciesId];
  return s.seasons === 'any' || s.seasons.includes(season);
}

export function neighbors(index: number, c: Content = defaultContent): number[] {
  const n = c.rules.gridSize;
  const row = Math.floor(index / n);
  const col = index % n;
  const out: number[] = [];
  if (row > 0) out.push(index - n);
  if (col < n - 1) out.push(index + 1);
  if (row < n - 1) out.push(index + n);
  if (col > 0) out.push(index - 1);
  return out;
}

export function isShaded(grid: Square[], index: number, c: Content = defaultContent): boolean {
  return neighbors(index, c).some((i) => grid[i].tree);
}

export function inStream(index: number, c: Content = defaultContent): boolean {
  return index % c.rules.gridSize === c.rules.streamColumn;
}

export function hybridFor(a: string, b: string, c: Content = defaultContent): string | null {
  for (const id of c.speciesOrder) {
    const p = c.species[id].parents;
    if (p && ((p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))) return id;
  }
  return null;
}

export function crossKey(a: number, b: number, sa: string, sb: string) {
  return a < b ? `${a}:${sa}|${b}:${sb}` : `${b}:${sb}|${a}:${sa}`;
}
