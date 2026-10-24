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

export function neighbors(index: number, n: number): number[] {
  const row = Math.floor(index / n);
  const col = index % n;
  const out: number[] = [];
  if (row > 0) out.push(index - n);
  if (col < n - 1) out.push(index + 1);
  if (row < n - 1) out.push(index + n);
  if (col > 0) out.push(index - 1);
  return out;
}

export function isShaded(grid: Square[], index: number, size: number): boolean {
  return neighbors(index, size).some((i) => grid[i].tree);
}

export function inStream(index: number, size: number, c: Content = defaultContent): boolean {
  return index % size === c.rules.streamColumn;
}

/** Tree squares and starting beds for a farm of this size; larger farms extend the 4×4 layout right and down. */
export function farmLayout(size: number, c: Content = defaultContent) {
  const base = c.rules.gridSize;
  const at = (i: number) => Math.floor(i / base) * size + (i % base);
  const trees = c.rules.trees.map(at);
  if (size === c.rules.largeFarm.size) for (const [r, col] of c.rules.largeFarm.extraTrees) trees.push(r * size + col);
  const start = c.rules.start.squares.map((sq) => ({ ...sq, index: at(sq.index) }));
  return { trees, start };
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
