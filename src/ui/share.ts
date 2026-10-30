import { content, score, type GameState } from '../core';

/** One emoji per square of the farm as the year ended, row by row. */
function farmGlyphs(g: GameState): string {
  const rows: string[] = [];
  for (let r = 0; r < g.size; r++) {
    let row = '';
    for (let c = 0; c < g.size; c++) {
      const sq = g.grid[r * g.size + c];
      row += sq.tree
        ? '🌳'
        : sq.blight
          ? '🥀'
          : sq.species && sq.stage === 'F'
            ? '🍄'
            : sq.species
              ? '🌱'
              : sq.substrate
                ? '🟫'
                : '🟩';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

/** A short, spoiler-free summary of a finished year to paste into a chat. */
export function shareText(g: GameState, url: string): string {
  const sc = score(g);
  const board = content.boards.find((b) => b.id === g.board)?.name ?? '';
  const day = g.mode === 'daily' ? g.seed.replace(/^daily-/, '') : null;
  const parts = [
    `Orders ${sc.orders}`,
    `Hybrids ${sc.hybrids}`,
    `Species ${sc.planted}`,
    `Coins ${sc.coins}`,
    ...(sc.feast ? [`Feast ${sc.feast}`] : []),
    ...(sc.artifacts ? [`Artifacts ${sc.artifacts}`] : []),
    ...(sc.family ? [`Family ${sc.family}`] : []),
    ...(sc.cache ? [`Cellar ${sc.cache}`] : []),
  ];
  return [
    day ? `Underbrush daily · ${day}` : 'Underbrush · story year',
    `${sc.tier ? sc.tier.name : 'A quiet year'} · ${sc.total} points · ${board}`,
    parts.join(' · '),
    farmGlyphs(g),
    url,
  ].join('\n');
}

/** Opens the phone's share sheet, or copies to the clipboard where there is none. */
export async function shareResult(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    // Closing the share sheet is not a failure worth falling back from.
    if ((e as Error)?.name === 'AbortError') return 'shared';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
