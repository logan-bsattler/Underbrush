import { content as defaultContent } from './content';
import type { BoardDef, Content, Season, Square } from './types';

export function seasonOf(round: number, c: Content = defaultContent): Season {
  const r = Math.min(Math.max(round, 1), c.rules.rounds);
  return c.rules.seasons[Math.floor((r - 1) / c.rules.roundsPerSeason)];
}

/** 0, 1 or 2: early, mid or late in the season. */
export function monthOfSeason(round: number, c: Content = defaultContent): number {
  return (round - 1) % c.rules.roundsPerSeason;
}

/** What a forest-floor card is called this season: some zones rename their hazards and ground through the year. Only the name changes. */
export function seasonalName(name: string, zone: string, season: Season, c: Content = defaultContent): string {
  return c.zones.find((z) => z.id === zone)?.seasonNames?.[season]?.[name] ?? name;
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

export function boardDef(id: string, c: Content = defaultContent): BoardDef {
  return c.boards.find((b) => b.id === id) ?? c.boards[0];
}

/** Trees, damp squares and starting beds for a board on a farm of this size; larger farms extend the 4×4 layout right and down. */
export function farmLayout(boardId: string, size: number, c: Content = defaultContent) {
  const board = boardDef(boardId, c);
  const base = c.rules.gridSize;
  const at = (i: number) => Math.floor(i / base) * size + (i % base);
  const trees = board.trees.map(at);
  if (size > base) for (const [r, col] of board.extraTrees) trees.push(r * size + col);
  const damp = board.springs.map(at);
  if (board.stream) for (let r = 0; r < size; r++) damp.push(r * size);
  const start = board.start.map((sq) => ({ ...sq, index: at(sq.index) }));
  return { trees, damp, start };
}

/** The hybrid these two species cross into, or null. A hybrid a level unlocks crosses only once it's in `unlocked`. */
export function hybridFor(a: string, b: string, c: Content = defaultContent, unlocked: string[] = []): string | null {
  for (const id of c.speciesOrder) {
    const p = c.species[id].parents;
    if (!p || !((p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))) continue;
    const gated = c.progression.levels.some((l) => l.unlocks.some((u) => u.type === 'hybrid' && u.id === id));
    return gated && !unlocked.includes(id) ? null : id;
  }
  return null;
}

export function crossKey(a: number, b: number, sa: string, sb: string) {
  return a < b ? `${a}:${sa}|${b}:${sb}` : `${b}:${sb}|${a}:${sa}`;
}
