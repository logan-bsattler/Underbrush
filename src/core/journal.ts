import { content as defaultContent } from './content';
import { score } from './engine';
import type { Content, GameState } from './types';

/** The field journal carries over between years, like the tabletop journal pad. */
export interface Journal {
  version: 1;
  discovered: string[];
  lookalikes: string[];
  hybrids: string[];
  years: { finished: string; mode: GameState['mode']; seed: string; score: number; tier: string | null }[];
  best: number;
}

export function emptyJournal(): Journal {
  return { version: 1, discovered: [], lookalikes: [], hybrids: [], years: [], best: 0 };
}

/** Folds this year's finds into the journal. Returns the ids that are new to it. */
export function mergeDiscoveries(j: Journal, s: GameState): { journal: Journal; fresh: string[] } {
  const fresh: string[] = [];
  const add = (list: string[], ids: string[], tag = '') => {
    const out = list.slice();
    for (const id of ids) {
      if (!out.includes(id)) {
        out.push(id);
        fresh.push(tag + id);
      }
    }
    return out;
  };
  const journal: Journal = {
    ...j,
    discovered: add(j.discovered, s.discovered),
    hybrids: add(j.hybrids, s.hybridsMade, 'hybrid:'),
    lookalikes: add(j.lookalikes, s.lookalikesFound, 'lookalike:'),
  };
  return { journal, fresh };
}

export function recordYear(j: Journal, s: GameState, c: Content = defaultContent): Journal {
  const { journal } = mergeDiscoveries(j, s);
  const sc = score(s, c);
  if (journal.years.some((y) => y.seed === s.seed)) return journal;
  return {
    ...journal,
    years: [
      ...journal.years,
      { finished: new Date().toISOString(), mode: s.mode, seed: s.seed, score: sc.total, tier: sc.tier?.id ?? null },
    ],
    best: Math.max(journal.best, sc.total),
  };
}
